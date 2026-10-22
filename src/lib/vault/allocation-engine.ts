import { Prisma, VaultAssetClass, VaultAssetRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AllocationMap, getAllAssetClasses } from './allocation-model';
import { getPricesAsOf } from './valuation';

/**
 * Turns cash into holdings.
 *
 * Given a vault's target allocation and an amount of cash, works out how many
 * units of each instrument to buy and at what price. Two stages on purpose:
 *
 *   buildAllocationPlan  - reads prices and targets, computes the trades
 *   applyAllocationPlan  - writes holdings inside a caller's transaction
 *
 * Splitting them means the plan can be inspected, refused, or shown to a
 * member before anything is written, and the write stays short enough to sit
 * inside the same transaction as the wallet debit.
 */

export interface AllocationLine {
  assetId: string;
  symbol: string;
  assetClass: VaultAssetClass;
  /** Cash directed at this instrument. */
  amount: number;
  price: number;
  units: number;
}

export interface AllocationPlan {
  vaultId: string;
  cashAmount: number;
  /** False when a target class could not be priced; nothing should be bought. */
  complete: boolean;
  missingPrices: string[];
  /** Classes with a target but no active instrument behind them. */
  unbackedClasses: VaultAssetClass[];
  lines: AllocationLine[];
  totalAllocated: number;
  /**
   * Cash left unallocated after rounding, or because a class had no
   * instrument. Stays in the vault's cash balance rather than being forced
   * into an asset the member did not ask for.
   */
  residualCash: number;
}

/**
 * Work out what to buy with `cashAmount`, following the vault's stored targets.
 *
 * Allocation is two-level: the target percentage decides how much goes to each
 * ASSET CLASS, then sleeveWeight splits that across the instruments inside the
 * class — which is how the crypto sleeve divides across BTC, ETH and XRP
 * without the class target itself ever changing.
 */
export async function buildAllocationPlan(
  vaultId: string,
  cashAmount: number,
  asOf: Date = new Date(),
): Promise<AllocationPlan> {
  const empty: AllocationPlan = {
    vaultId,
    cashAmount,
    complete: false,
    missingPrices: [],
    unbackedClasses: [],
    lines: [],
    totalAllocated: 0,
    residualCash: cashAmount,
  };

  if (!Number.isFinite(cashAmount) || cashAmount <= 0) {
    return { ...empty, complete: true, residualCash: 0 };
  }

  const allocations = await prisma.vaultAllocation.findMany({ where: { vaultId } });
  if (allocations.length === 0) return empty;

  const targets: AllocationMap = getAllAssetClasses().reduce((map, assetClass) => {
    map[assetClass] = allocations.find((a) => a.assetClass === assetClass)?.targetPercent ?? 0;
    return map;
  }, {} as AllocationMap);

  // Benchmark-only instruments are never bought: they exist to draw the
  // comparison line, not to be held.
  const assets = await prisma.vaultAsset.findMany({
    where: { isActive: true, role: { not: VaultAssetRole.BENCHMARK } },
    orderBy: { displayOrder: 'asc' },
  });

  const prices = await getPricesAsOf(asOf);

  const lines: AllocationLine[] = [];
  const missingPrices: string[] = [];
  const unbackedClasses: VaultAssetClass[] = [];
  let totalAllocated = 0;

  for (const assetClass of getAllAssetClasses()) {
    const targetPercent = targets[assetClass];
    if (targetPercent <= 0) continue;

    const classCash = cashAmount * (targetPercent / 100);
    const classAssets = assets.filter((a) => a.assetClass === assetClass);

    if (classAssets.length === 0) {
      // A target with nothing to buy: hold the cash rather than silently
      // pushing it into another class.
      unbackedClasses.push(assetClass);
      continue;
    }

    // Normalise sleeve weights across the instruments ACTUALLY available. If
    // an asset were deactivated, the remaining weights would no longer total
    // 1 and the class would be under-bought without this.
    const weightTotal = classAssets.reduce((sum, a) => sum + a.sleeveWeight, 0);

    for (const asset of classAssets) {
      const price = prices.get(asset.id);
      if (price === undefined || price.close <= 0) {
        missingPrices.push(asset.symbol);
        continue;
      }

      const share = weightTotal > 0 ? asset.sleeveWeight / weightTotal : 1 / classAssets.length;
      const amount = classCash * share;
      if (amount <= 0) continue;

      lines.push({
        assetId: asset.id,
        symbol: asset.symbol,
        assetClass,
        amount,
        price: price.close,
        units: amount / price.close,
      });
      totalAllocated += amount;
    }
  }

  const complete = missingPrices.length === 0;

  return {
    vaultId,
    cashAmount,
    complete,
    missingPrices,
    unbackedClasses,
    lines,
    totalAllocated,
    // Floating point leaves fractions of a cent; they stay as cash rather than
    // being forced into a holding.
    residualCash: Math.max(0, cashAmount - totalAllocated),
  };
}

/**
 * Write a plan's trades as holdings, inside the caller's transaction.
 *
 * Units and cost basis accumulate: a second deposit adds to an existing
 * holding rather than replacing it, so cost basis stays meaningful for
 * gain/loss across a member's whole contribution history.
 *
 * The caller is responsible for refusing an incomplete plan — this function
 * writes whatever it is given.
 */
export async function applyAllocationPlan(
  tx: Prisma.TransactionClient,
  plan: AllocationPlan,
): Promise<void> {
  // Every existing holding is read in ONE query rather than one per line.
  // This runs inside an interactive transaction against a remote database, so
  // each extra round-trip costs ~300ms against the transaction timeout --
  // per-line reads alone were enough to blow a 5s budget and roll back an
  // otherwise valid deposit.
  const existingHoldings = await tx.vaultHolding.findMany({
    where: { vaultId: plan.vaultId },
  });
  const byAssetId = new Map(existingHoldings.map((h) => [h.assetId, h]));

  for (const line of plan.lines) {
    const existing = byAssetId.get(line.assetId) ?? null;

    if (existing === null) {
      await tx.vaultHolding.create({
        data: {
          vaultId: plan.vaultId,
          assetId: line.assetId,
          units: line.units,
          costBasis: line.amount,
          averageCost: line.price,
        },
      });
      continue;
    }

    const units = existing.units + line.units;
    const costBasis = existing.costBasis + line.amount;

    await tx.vaultHolding.update({
      where: { id: existing.id },
      data: {
        units,
        costBasis,
        // Weighted average across every purchase, not just the latest price.
        averageCost: units > 0 ? costBasis / units : 0,
      },
    });
  }
}

/** Human-readable summary of a plan, for notifications and API responses. */
export function summarisePlan(plan: AllocationPlan): string {
  if (plan.lines.length === 0) return 'No holdings were purchased.';
  const parts = plan.lines
    .slice()
    .sort((a, b) => b.amount - a.amount)
    .map((l) => `${l.symbol} $${l.amount.toFixed(2)}`);
  return parts.join(', ');
}
