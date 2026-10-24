import { Prisma, VaultAssetClass, VaultAssetRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AllocationMap, getAllAssetClasses } from './allocation-model';
import { getPricesAsOf, valueVault } from './valuation';

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

/* ===========================================================================
 * MEMBER-DIRECTED INVESTING
 *
 * With the Expert Allocator off, the member decides how much goes into each
 * asset class rather than the system spreading a deposit automatically. The
 * target percentage becomes a CEILING: a class targeted at 5% may not exceed
 * 5% of the vault's total value, which is how the crypto cap keeps holding
 * when a member is placing the trades themselves.
 *
 * Investing moves cash into holdings, so the vault's total value does not
 * change during the operation. That is what makes the ceiling stable while a
 * member fills in several classes at once.
 * ======================================================================== */

export interface ClassCapacity {
  assetClass: VaultAssetClass;
  targetPercent: number;
  /** Most this class may ever be worth, given the vault's total value. */
  capValue: number;
  currentValue: number;
  currentPercent: number;
  /** Most the member may add to this class right now. */
  headroom: number;
  /** True when the class is already at or above its ceiling. */
  atCap: boolean;
}

export interface InvestmentCapacity {
  vaultId: string;
  /** Holdings at market plus uninvested cash. */
  vaultTotalValue: number;
  investableCash: number;
  complete: boolean;
  missingPrices: string[];
  classes: ClassCapacity[];
  /** Sum of every class's headroom, capped by the cash actually available. */
  totalInvestable: number;
}

/**
 * What the member may invest, and where.
 *
 * Returns headroom per class rather than a single number, because the limit
 * that matters is per-class: someone with plenty of cash may still be unable
 * to add anything to crypto.
 */
export async function getInvestmentCapacity(
  vaultId: string,
  asOf: Date = new Date(),
): Promise<InvestmentCapacity | null> {
  const vault = await prisma.retirementVault.findUnique({
    where: { id: vaultId },
    include: { allocations: true },
  });
  if (vault === null) return null;

  const valuation = await valueVault(vaultId, asOf);
  if (valuation === null) return null;

  const vaultTotalValue = valuation.holdingsValue + vault.cashBalance;

  const valueByClass = new Map<VaultAssetClass, number>();
  for (const holding of valuation.holdings) {
    valueByClass.set(
      holding.assetClass,
      (valueByClass.get(holding.assetClass) ?? 0) + holding.value,
    );
  }

  const classes: ClassCapacity[] = getAllAssetClasses().map((assetClass) => {
    const targetPercent =
      vault.allocations.find((a) => a.assetClass === assetClass)?.targetPercent ?? 0;
    const capValue = (vaultTotalValue * targetPercent) / 100;
    const currentValue = valueByClass.get(assetClass) ?? 0;
    const headroom = Math.max(0, capValue - currentValue);

    return {
      assetClass,
      targetPercent,
      capValue,
      currentValue,
      currentPercent:
        valuation.holdingsValue > 0 ? (currentValue / valuation.holdingsValue) * 100 : 0,
      headroom,
      // A hair of tolerance so floating point does not report a class as
      // over its cap when it is exactly on it.
      atCap: headroom <= 0.01,
    };
  });

  const headroomTotal = classes.reduce((sum, c) => sum + c.headroom, 0);

  return {
    vaultId,
    vaultTotalValue,
    investableCash: vault.cashBalance,
    complete: valuation.complete,
    missingPrices: valuation.missingPrices,
    classes,
    totalInvestable: Math.min(vault.cashBalance, headroomTotal),
  };
}

export interface ManualAllocationInput {
  assetClass: VaultAssetClass;
  amount: number;
}

export interface ManualPlanResult {
  plan: AllocationPlan | null;
  errors: string[];
}

/**
 * Build a plan from amounts the member chose per class.
 *
 * Every class is checked against its own ceiling AND the total against the
 * cash available, and the whole request is refused if any line fails. A
 * partial fill would leave the member believing they invested an amount they
 * did not, which matters more here than the convenience of salvaging the
 * valid lines.
 */
export async function buildManualAllocationPlan(
  vaultId: string,
  inputs: ManualAllocationInput[],
  asOf: Date = new Date(),
): Promise<ManualPlanResult> {
  const errors: string[] = [];

  const capacity = await getInvestmentCapacity(vaultId, asOf);
  if (capacity === null) return { plan: null, errors: ['Vault not found.'] };

  if (!capacity.complete) {
    return {
      plan: null,
      errors: [
        `Live prices are unavailable for ${capacity.missingPrices.join(', ')}, so your ` +
          `investment limits cannot be calculated right now.`,
      ],
    };
  }

  const lines = inputs.filter((i) => Number(i.amount) > 0);
  if (lines.length === 0) {
    return { plan: null, errors: ['Enter an amount for at least one asset class.'] };
  }

  let total = 0;
  for (const input of lines) {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(`Invalid amount for ${input.assetClass}.`);
      continue;
    }
    total += amount;

    const capacityForClass = capacity.classes.find((c) => c.assetClass === input.assetClass);
    if (capacityForClass === undefined) {
      errors.push(`Unknown asset class: ${input.assetClass}`);
      continue;
    }

    if (capacityForClass.targetPercent <= 0) {
      errors.push(
        `${input.assetClass.replace(/_/g, ' ').toLowerCase()} is not part of your target ` +
          `allocation, so nothing can be invested there.`,
      );
      continue;
    }

    if (amount > capacityForClass.headroom + 0.01) {
      errors.push(
        `You can add at most $${capacityForClass.headroom.toFixed(2)} to ` +
          `${input.assetClass.replace(/_/g, ' ').toLowerCase()}, which is capped at ` +
          `${capacityForClass.targetPercent}% of your vault.`,
      );
    }
  }

  if (total > capacity.investableCash + 0.01) {
    errors.push(
      `You are investing $${total.toFixed(2)} but only have ` +
        `$${capacity.investableCash.toFixed(2)} in uninvested cash.`,
    );
  }

  if (errors.length > 0) return { plan: null, errors };

  // Split each class's amount across its instruments by sleeve weight, the
  // same rule the automatic path uses.
  const assets = await prisma.vaultAsset.findMany({
    where: { isActive: true, role: { not: VaultAssetRole.BENCHMARK } },
    orderBy: { displayOrder: 'asc' },
  });
  const prices = await getPricesAsOf(asOf);

  const planLines: AllocationLine[] = [];
  const missingPrices: string[] = [];
  let totalAllocated = 0;

  for (const input of lines) {
    const classAssets = assets.filter((a) => a.assetClass === input.assetClass);
    if (classAssets.length === 0) {
      errors.push(`No instruments available for ${input.assetClass}.`);
      continue;
    }

    const weightTotal = classAssets.reduce((sum, a) => sum + a.sleeveWeight, 0);

    for (const asset of classAssets) {
      const price = prices.get(asset.id);
      if (price === undefined || price.close <= 0) {
        missingPrices.push(asset.symbol);
        continue;
      }

      const share =
        weightTotal > 0 ? asset.sleeveWeight / weightTotal : 1 / classAssets.length;
      const amount = Number(input.amount) * share;
      if (amount <= 0) continue;

      planLines.push({
        assetId: asset.id,
        symbol: asset.symbol,
        assetClass: input.assetClass,
        amount,
        price: price.close,
        units: amount / price.close,
      });
      totalAllocated += amount;
    }
  }

  if (errors.length > 0) return { plan: null, errors };

  return {
    plan: {
      vaultId,
      cashAmount: total,
      complete: missingPrices.length === 0,
      missingPrices,
      unbackedClasses: [],
      lines: planLines,
      totalAllocated,
      residualCash: Math.max(0, total - totalAllocated),
    },
    errors: [],
  };
}

/**
 * Invest an amount TOWARD the target, respecting what is already held.
 *
 * The plain percentage split is only correct for an empty vault. Once money
 * arrives in stages it breaks the ceiling: a member who has already filled
 * crypto to 5% and then hands a total to the Expert Allocator would get a
 * further 5% of that total in crypto, taking the vault past the cap. Observed
 * at 7% against a 5% cap before this existed.
 *
 * Distributing in proportion to each class's HEADROOM instead fixes it and is
 * the better behaviour anyway: new money flows to whatever is furthest below
 * target, which is how a contribution should rebalance a portfolio.
 *
 * Total headroom is always at least the cash available — the ceilings sum to
 * the vault's whole value — so there is never too little room to place it.
 */
export async function buildTargetingAllocationPlan(
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

  const capacity = await getInvestmentCapacity(vaultId, asOf);
  if (capacity === null) return empty;
  if (!capacity.complete) {
    return { ...empty, missingPrices: capacity.missingPrices };
  }

  const headroomTotal = capacity.classes.reduce((sum, c) => sum + c.headroom, 0);
  if (headroomTotal <= 0) {
    return { ...empty, complete: true, residualCash: cashAmount };
  }

  // Never place more than the room available, even though that should not
  // arise given the ceilings sum to the vault's value.
  const placeable = Math.min(cashAmount, headroomTotal);

  const inputs: ManualAllocationInput[] = capacity.classes
    .filter((c) => c.headroom > 0)
    .map((c) => ({
      assetClass: c.assetClass,
      // Proportional to headroom, then clamped so rounding cannot nudge a
      // class past its ceiling.
      amount: Math.min(c.headroom, (placeable * c.headroom) / headroomTotal),
    }))
    .filter((i) => i.amount > 0);

  const { plan } = await buildManualAllocationPlan(vaultId, inputs, asOf);
  if (plan === null) return empty;

  return { ...plan, cashAmount, residualCash: Math.max(0, cashAmount - plan.totalAllocated) };
}
