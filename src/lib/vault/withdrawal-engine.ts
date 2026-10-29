import {
  LockInPreference,
  Prisma,
  RetirementHorizon,
  VaultWithdrawalStatus,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { VaultPolicy } from './allocation-model';
import { valueVault } from './valuation';

/**
 * Withdrawal rules.
 *
 * Deliberate friction, modelled on 401k behaviour: a notice period before
 * funds move and a penalty on leaving early. The point is to discourage
 * short-termism in a vehicle whose returns depend on staying invested, not to
 * trap anyone — the notice can be cancelled at any time before payout.
 */

/** Years until retirement implied by each horizon. */
const HORIZON_YEARS: Record<RetirementHorizon, number> = {
  [RetirementHorizon.YEARS_10]: 10,
  [RetirementHorizon.YEARS_15]: 15,
  [RetirementHorizon.YEARS_20]: 20,
  [RetirementHorizon.YEARS_25_PLUS]: 25,
};

/**
 * The date a vault's horizon is reached, measured from activation.
 *
 * Returns null for a vault that never activated: it has no horizon to have
 * reached, so any withdrawal from it is early by definition.
 */
export function getMaturityDate(
  horizon: RetirementHorizon,
  activatedAt: Date | null,
): Date | null {
  if (activatedAt === null) return null;
  const maturity = new Date(activatedAt);
  maturity.setFullYear(maturity.getFullYear() + HORIZON_YEARS[horizon]);
  return maturity;
}

export interface WithdrawalQuote {
  amount: number;
  isEarly: boolean;
  maturityDate: Date | null;
  penaltyPercent: number;
  penaltyAmount: number;
  netAmount: number;
  noticePeriodDays: number;
  noticeEndsAt: Date;
  /** Member-facing explanation of the cost, shown before they confirm. */
  explanation: string;
}

/**
 * Price a withdrawal before it is requested.
 *
 * Quoted up front and then STORED on the request, so a later change to the
 * penalty policy cannot alter a figure the member already agreed to.
 */
export function quoteWithdrawal(params: {
  amount: number;
  horizon: RetirementHorizon;
  activatedAt: Date | null;
  lockInPreference: LockInPreference;
  policy: VaultPolicy;
  now?: Date;
}): WithdrawalQuote {
  const now = params.now ?? new Date();
  const maturityDate = getMaturityDate(params.horizon, params.activatedAt);
  const isEarly = maturityDate === null || now < maturityDate;

  const basePenalty =
    params.lockInPreference === LockInPreference.SOFT_LOCK
      ? params.policy.softLockPenaltyPercent
      : params.policy.flexiblePenaltyPercent;

  // Reaching the horizon is the vault working as intended, so no penalty.
  const penaltyPercent = isEarly ? basePenalty : 0;
  const penaltyAmount = (params.amount * penaltyPercent) / 100;
  const netAmount = params.amount - penaltyAmount;

  const noticePeriodDays = params.policy.withdrawalNoticeDays;
  const noticeEndsAt = new Date(now.getTime() + noticePeriodDays * 24 * 60 * 60 * 1000);

  const explanation = isEarly
    ? `This is an early withdrawal. A ${penaltyPercent}% penalty of ` +
      `$${penaltyAmount.toFixed(2)} applies, leaving $${netAmount.toFixed(2)}. ` +
      `Funds are released after a ${noticePeriodDays}-day notice period, and you can ` +
      `cancel at any point before then.`
    : `You have reached your retirement horizon, so no penalty applies. ` +
      `Funds are released after a ${noticePeriodDays}-day notice period.`;

  return {
    amount: params.amount,
    isEarly,
    maturityDate,
    penaltyPercent,
    penaltyAmount,
    netAmount,
    noticePeriodDays,
    noticeEndsAt,
    explanation,
  };
}

export interface LiquidationLine {
  assetId: string;
  symbol: string;
  unitsSold: number;
  price: number;
  proceeds: number;
  /** Cost basis released with those units, for realised gain/loss. */
  costBasisReleased: number;
}

export interface LiquidationPlan {
  vaultId: string;
  /** Gross amount to raise, including any penalty. */
  targetAmount: number;
  complete: boolean;
  reason?: string;
  /** Cash taken from the vault's uninvested balance before selling. */
  fromCash: number;
  lines: LiquidationLine[];
  /**
   * Credited performance released per class, mirroring the units sold.
   *
   * A class is worth its principal plus the performance credited to it, and
   * the two live in different places: principal on the holdings, the accrual
   * on the allocation row. Selling units alone would pay the member for
   * performance and then leave it sitting in the vault -- money out of thin
   * air. This is what the sale takes back out.
   */
  accruedReleased: Array<{ assetClass: string; amount: number }>;
  totalRaised: number;
}

/**
 * Work out what to sell to raise an amount.
 *
 * Sells PROPORTIONALLY across every holding rather than draining one asset.
 * Selling a single class to fund a withdrawal would silently rebalance the
 * vault away from its target, leaving the member with an allocation they never
 * chose and a drift event they did not cause.
 *
 * Uninvested cash is used first, since spending it costs nothing to realise.
 */
export async function buildLiquidationPlan(
  vaultId: string,
  targetAmount: number,
  asOf: Date = new Date(),
): Promise<LiquidationPlan> {
  const base: LiquidationPlan = {
    vaultId,
    targetAmount,
    complete: false,
    fromCash: 0,
    lines: [],
    accruedReleased: [],
    totalRaised: 0,
  };

  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return { ...base, complete: false, reason: 'Invalid amount.' };
  }

  const valuation = await valueVault(vaultId, asOf);
  if (valuation === null) return { ...base, reason: 'Vault not found.' };

  if (!valuation.complete) {
    // Selling against an incomplete valuation would misprice the units sold.
    return {
      ...base,
      reason: `Live prices unavailable for ${valuation.missingPrices.join(', ')}.`,
    };
  }

  if (valuation.totalValue + 1e-6 < targetAmount) {
    return {
      ...base,
      reason: `Vault holds $${valuation.totalValue.toFixed(2)}, less than the $${targetAmount.toFixed(2)} requested.`,
    };
  }

  const fromCash = Math.min(valuation.cashBalance, targetAmount);
  let remaining = targetAmount - fromCash;

  const lines: LiquidationLine[] = [];
  const accruedReleased: Array<{ assetClass: string; amount: number }> = [];
  // Performance credited to a class the member has already sold out of. It is
  // part of the vault's value, so it has to be sellable -- otherwise a full
  // withdrawal would leave an unreachable balance behind.
  let orphanProceeds = 0;

  if (remaining > 1e-9 && valuation.holdingsValue > 0) {
    // Each holding contributes in proportion to its share of invested value,
    // which leaves the allocation unchanged after the sale.
    const fraction = Math.min(1, remaining / valuation.holdingsValue);

    for (const holding of valuation.holdings) {
      const unitsSold = holding.units * fraction;
      if (unitsSold <= 0) continue;

      lines.push({
        assetId: holding.assetId,
        symbol: holding.symbol,
        unitsSold,
        price: holding.price,
        // Proceeds come from the holding's VALUE, not units x price. A class's
        // worth is now its principal plus the performance credited to it (see
        // class-performance.ts), so pricing the sale off the market would raise
        // a different figure from the balance the member was shown and leave
        // the withdrawal short or over.
        proceeds: holding.value * fraction,
        costBasisReleased: holding.costBasis * fraction,
      });
    }
    // The accrual goes out at the same fraction as the units, so each class
    // falls by fraction x (principal + accrued) -- exactly its share of value.
    for (const [assetClass, position] of Object.entries(valuation.classValues)) {
      if (position.accrued === 0) continue;
      const amount = position.accrued * fraction;
      accruedReleased.push({ assetClass, amount });
      // A class with no principal has no holding line to carry its share, so
      // it is counted here instead of being quietly left out of the total.
      if (position.principal <= 0) orphanProceeds += amount;
    }

    remaining = 0;
  }

  const totalRaised =
    fromCash + lines.reduce((sum, l) => sum + l.proceeds, 0) + orphanProceeds;

  return {
    vaultId,
    targetAmount,
    complete: true,
    fromCash,
    lines,
    accruedReleased,
    totalRaised,
  };
}

/**
 * Apply a liquidation inside the caller's transaction.
 *
 * Holdings are read in one query for the same reason the deposit engine does:
 * each extra round-trip to a remote database eats the transaction budget.
 */
export async function applyLiquidationPlan(
  tx: Prisma.TransactionClient,
  plan: LiquidationPlan,
): Promise<void> {
  const holdings = await tx.vaultHolding.findMany({ where: { vaultId: plan.vaultId } });
  const byAssetId = new Map(holdings.map((h) => [h.assetId, h]));

  for (const line of plan.lines) {
    const holding = byAssetId.get(line.assetId);
    if (holding === undefined) continue;

    const units = Math.max(0, holding.units - line.unitsSold);
    const costBasis = Math.max(0, holding.costBasis - line.costBasisReleased);

    await tx.vaultHolding.update({
      where: { id: holding.id },
      data: {
        units,
        costBasis,
        // Average cost is unchanged by a proportional sale, but recompute so a
        // rounding drift cannot accumulate across many withdrawals.
        averageCost: units > 0 ? costBasis / units : 0,
      },
    });
  }

  // Take the sold performance back off the allocation rows. Without this the
  // member is paid for a gain the vault still believes it holds.
  for (const released of plan.accruedReleased) {
    if (released.amount === 0) continue;
    await tx.vaultAllocation.updateMany({
      where: { vaultId: plan.vaultId, assetClass: released.assetClass },
      data: { accruedPerformance: { decrement: released.amount } },
    });
  }
}

/**
 * Move requests whose notice has elapsed from PENDING_NOTICE to NOTICE_SERVED.
 *
 * Run from the nightly cron. Separating "notice elapsed" from "paid" means an
 * admin sees a queue of requests that are genuinely ready, rather than having
 * to check dates themselves.
 */
export async function serveElapsedNotices(now: Date = new Date()): Promise<number> {
  const result = await prisma.vaultWithdrawalRequest.updateMany({
    where: {
      status: VaultWithdrawalStatus.PENDING_NOTICE,
      noticeEndsAt: { lte: now },
    },
    data: { status: VaultWithdrawalStatus.NOTICE_SERVED },
  });
  return result.count;
}

/** Statuses where the member's money is still committed to a request. */
export const OPEN_WITHDRAWAL_STATUSES: VaultWithdrawalStatus[] = [
  VaultWithdrawalStatus.PENDING_NOTICE,
  VaultWithdrawalStatus.NOTICE_SERVED,
  VaultWithdrawalStatus.PENDING_ADMIN,
  VaultWithdrawalStatus.APPROVED,
];

/**
 * Total already committed to open withdrawal requests.
 *
 * Without this a member could file several requests that each pass the balance
 * check individually but together exceed the vault.
 */
export async function getCommittedWithdrawalAmount(vaultId: string): Promise<number> {
  const open = await prisma.vaultWithdrawalRequest.findMany({
    where: { vaultId, status: { in: OPEN_WITHDRAWAL_STATUSES } },
    select: { amount: true },
  });
  return open.reduce((sum, r) => sum + r.amount, 0);
}
