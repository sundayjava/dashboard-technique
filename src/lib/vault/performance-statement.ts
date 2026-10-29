import { ContributionStatus, VaultAssetRole, VaultWithdrawalStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getQuarter } from './report-card';
import { valueVault } from './valuation';

/**
 * The performance statement: one period's figures, whole.
 *
 * Everything on the screen is derived here from one set of reads, so the
 * headline, the per-class table and the total cannot disagree. The mock this
 * was built from had class balances summing to $84,733.80 under a stated total
 * of $84,320.00 -- a statement that does not foot is worse than no statement,
 * and deriving every figure from a single source is what prevents it.
 */

export type StatementPeriod = 'MONTH' | 'QUARTER' | 'YEAR';

export interface PeriodBounds {
  period: StatementPeriod;
  label: string;
  start: Date;
  end: Date;
}

/** The calendar window for a period, in UTC. */
export function getPeriodBounds(period: StatementPeriod, asOf: Date = new Date()): PeriodBounds {
  const year = asOf.getUTCFullYear();

  if (period === 'YEAR') {
    return {
      period,
      label: String(year),
      start: new Date(Date.UTC(year, 0, 1)),
      end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
    };
  }

  if (period === 'QUARTER') {
    const q = getQuarter(asOf);
    // "Q4 2026" reads better on a tile than the report card's "2026 Q4".
    const [y, quarter] = q.label.split(' ');
    return { period, label: `${quarter} ${y}`, start: q.start, end: q.end };
  }

  const month = asOf.getUTCMonth();
  return {
    period,
    label: new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-GB', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    start: new Date(Date.UTC(year, month, 1)),
    end: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
  };
}

export interface ClassRow {
  assetClass: string;
  /** "BTC 3% · ETH 2% · XRP 1%", built from live sleeve weights. */
  instruments: string;
  allocationPercent: number;
  gain: number;
  closeBalance: number;
  returnPercent: number;
}

export interface StatementTiles {
  balance: number;
  balanceChange: number;
  returnPercent: number | null;
  benchmarkReturnPercent: number | null;
  contributions: number;
  contributionCount: number;
  gain: number;
  gainPercentOfContributed: number | null;
  totalContributed: number;
  allTimeGain: number;
}

export interface PerformanceStatement {
  period: StatementPeriod;
  periodLabel: string;
  /** False when the period holds too little history to describe a change. */
  available: boolean;
  unavailableReason: string | null;
  tiles: StatementTiles;
  classes: ClassRow[];
  total: { allocationPercent: number; gain: number; closeBalance: number; returnPercent: number | null };
  contributionNote: string | null;
  series: Array<{ date: string; vault: number; benchmark: number | null; contributed: number }>;
  /** One sentence naming what drove the period, or null when nothing did. */
  verdict: string | null;
  outperformancePoints: number | null;
}

/** Modified Dietz: strips cashflow, then divides by the capital actually at work. */
function periodReturn(opening: number, closing: number, netFlow: number): number | null {
  const averageCapital = opening + netFlow / 2;
  if (averageCapital <= 0) return null;
  return ((closing - opening - netFlow) / averageCapital) * 100;
}

export async function buildPerformanceStatement(
  vaultId: string,
  period: StatementPeriod,
  asOf: Date = new Date(),
): Promise<PerformanceStatement> {
  const bounds = getPeriodBounds(period, asOf);

  const [valuationsInPeriod, openingRow, contributions, withdrawals, accruals, assets, valuation] =
    await Promise.all([
      prisma.vaultValuation.findMany({
        where: { vaultId, valuationDate: { gte: bounds.start, lte: bounds.end } },
        orderBy: { valuationDate: 'asc' },
        select: {
          valuationDate: true,
          totalValue: true,
          benchmarkValue: true,
          contributedToDate: true,
        },
      }),
      // The last valuation BEFORE the period opens. A period's opening balance
      // is where the previous one closed, not its own first reading -- using
      // the latter would silently discard the first day's movement.
      prisma.vaultValuation.findFirst({
        where: { vaultId, valuationDate: { lt: bounds.start } },
        orderBy: { valuationDate: 'desc' },
        select: { totalValue: true, benchmarkValue: true },
      }),
      prisma.vaultContribution.findMany({
        where: {
          vaultId,
          status: ContributionStatus.COMPLETED,
          processedAt: { gte: bounds.start, lte: bounds.end },
        },
        select: { amount: true, processedAt: true },
        orderBy: { processedAt: 'asc' },
      }),
      prisma.vaultWithdrawalRequest.findMany({
        where: {
          vaultId,
          status: VaultWithdrawalStatus.PAID,
          processedAt: { gte: bounds.start, lte: bounds.end },
        },
        select: { amount: true },
      }),
      prisma.vaultClassAccrual.findMany({
        where: { vaultId, accrualDate: { gte: bounds.start, lte: bounds.end } },
        select: { assetClass: true, amount: true },
      }),
      prisma.vaultAsset.findMany({
        where: { isActive: true, role: { not: VaultAssetRole.BENCHMARK } },
        orderBy: { sleeveWeight: 'desc' },
        select: { symbol: true, assetClass: true, sleeveWeight: true },
      }),
      valueVault(vaultId, asOf),
    ]);

  const contributionsInPeriod = contributions.reduce((s, c) => s + c.amount, 0);
  const withdrawalsInPeriod = withdrawals.reduce((s, w) => s + w.amount, 0);

  const latest = valuationsInPeriod[valuationsInPeriod.length - 1];
  const closing = latest?.totalValue ?? valuation?.totalValue ?? 0;
  const opening = openingRow?.totalValue ?? valuationsInPeriod[0]?.totalValue ?? closing;

  /*
   * CASHFLOW IS COUNTED FROM THE OPENING READING, NOT THE CALENDAR START.
   *
   * When a vault has no valuation before the period opens -- which is every
   * vault's first month -- the opening balance is its first reading INSIDE the
   * period, and that reading already contains the money paid in up to that
   * point. Subtracting the whole period's contributions anyway removes it a
   * second time: a vault that took $15,000 in its first month reported a
   * -65% return on a month it actually gained.
   *
   * So the flow window starts where the opening balance was measured.
   */
  const openingDate =
    openingRow !== null
      ? bounds.start
      : (valuationsInPeriod[0]?.valuationDate ?? bounds.start);

  const flowContributions =
    openingRow !== null
      ? contributionsInPeriod
      : contributions
          .filter((c) => c.processedAt !== null && c.processedAt > openingDate)
          .reduce((s, c) => s + c.amount, 0);

  const netFlow = flowContributions - withdrawalsInPeriod;

  // A period needs a before and an after. One reading cannot describe a
  // change, and inventing one from a single observation would be fiction.
  const available = openingRow !== null ? valuationsInPeriod.length >= 1 : valuationsInPeriod.length >= 2;

  const returnPercent = available ? periodReturn(opening, closing, netFlow) : null;

  let benchmarkReturnPercent: number | null = null;
  const benchOpen = openingRow?.benchmarkValue ?? valuationsInPeriod[0]?.benchmarkValue ?? null;
  const benchClose = latest?.benchmarkValue ?? null;
  if (available && benchOpen !== null && benchClose !== null) {
    benchmarkReturnPercent = periodReturn(benchOpen, benchClose, netFlow);
  }

  /* ------------------------------------------------------------ per class */

  const classValues = valuation?.classValues ?? {};

  const gainByClass = new Map<string, number>();
  for (const accrual of accruals) {
    gainByClass.set(accrual.assetClass, (gainByClass.get(accrual.assetClass) ?? 0) + accrual.amount);
  }

  // Close balances come from the valuation, so the rows foot to the same
  // holdings total the tiles use.
  const holdingsTotal = Object.values(classValues).reduce((s, c) => s + c.value, 0);

  const classes: ClassRow[] = Object.entries(classValues)
    .filter(([, position]) => position.value > 0.005 || (gainByClass.get('') ?? 0) !== 0)
    .map(([assetClass, position]) => {
      const gain = gainByClass.get(assetClass) ?? 0;
      const allocationPercent = holdingsTotal > 0 ? (position.value / holdingsTotal) * 100 : 0;
      const openingValue = position.value - gain;

      const sleeve = assets.filter((a) => a.assetClass === assetClass);
      const sleeveTotal = sleeve.reduce((s, a) => s + a.sleeveWeight, 0);
      const instruments = sleeve
        .map((a) => {
          const share = sleeveTotal > 0 ? a.sleeveWeight / sleeveTotal : 0;
          return `${a.symbol} ${(share * allocationPercent).toFixed(0)}%`;
        })
        .join(' · ');

      return {
        assetClass,
        instruments,
        allocationPercent,
        gain,
        closeBalance: position.value,
        returnPercent: openingValue > 0 ? (gain / openingValue) * 100 : 0,
      };
    })
    .sort((a, b) => b.closeBalance - a.closeBalance);

  const classGainTotal = classes.reduce((s, c) => s + c.gain, 0);
  const classBalanceTotal = classes.reduce((s, c) => s + c.closeBalance, 0);

  /* -------------------------------------------------------------- verdict */

  let verdict: string | null = null;
  const outperformancePoints =
    returnPercent !== null && benchmarkReturnPercent !== null
      ? returnPercent - benchmarkReturnPercent
      : null;

  if (classes.length > 0 && available) {
    const ranked = [...classes].sort((a, b) => b.returnPercent - a.returnPercent);
    const best = ranked[0]!;
    const worst = ranked[ranked.length - 1]!;
    const parts: string[] = [];

    if (outperformancePoints !== null) {
      parts.push(
        outperformancePoints >= 0
          ? `Ahead of the 60/40 blend by ${outperformancePoints.toFixed(2)} pp.`
          : `Behind the 60/40 blend by ${Math.abs(outperformancePoints).toFixed(2)} pp.`,
      );
    }
    if (best.gain !== 0) {
      parts.push(
        `Led by ${labelFor(best.assetClass)} (${best.returnPercent >= 0 ? '+' : ''}${best.returnPercent.toFixed(2)}%).`,
      );
    }
    if (worst.gain < 0 && worst.assetClass !== best.assetClass) {
      parts.push(`${labelFor(worst.assetClass)} was the only drag.`);
    }
    verdict = parts.length > 0 ? parts.join(' ') : null;
  }

  /* --------------------------------------------------------- contribution */

  const contributionNote =
    contributions.length > 0
      ? `${contributions.length} contribution${contributions.length === 1 ? '' : 's'} ` +
        `totalling ${contributionsInPeriod.toFixed(2)} applied in ${bounds.label}, ` +
        `distributed pro-rata across asset classes`
      : null;

  const totalContributed = valuation?.contributedToDate ?? 0;
  const allTimeGain = valuation?.unrealisedGainLoss ?? 0;

  return {
    period,
    periodLabel: bounds.label,
    available,
    unavailableReason: available
      ? null
      : `This vault has ${valuationsInPeriod.length} valuation${
          valuationsInPeriod.length === 1 ? '' : 's'
        } in ${bounds.label}. A period needs an opening and a closing figure before a return means anything.`,
    tiles: {
      balance: valuation?.totalValue ?? closing,
      balanceChange: available ? closing - opening : 0,
      returnPercent,
      benchmarkReturnPercent,
      contributions: contributionsInPeriod,
      contributionCount: contributions.length,
      gain: available ? closing - opening - netFlow : 0,
      gainPercentOfContributed:
        totalContributed > 0 ? (allTimeGain / totalContributed) * 100 : null,
      totalContributed,
      allTimeGain,
    },
    classes,
    total: {
      allocationPercent: classes.length > 0 ? 100 : 0,
      gain: classGainTotal,
      closeBalance: classBalanceTotal,
      returnPercent:
        classBalanceTotal - classGainTotal > 0
          ? (classGainTotal / (classBalanceTotal - classGainTotal)) * 100
          : null,
    },
    contributionNote,
    series: valuationsInPeriod.map((v) => ({
      date: v.valuationDate.toISOString().slice(0, 10),
      vault: Number(v.totalValue.toFixed(2)),
      benchmark: v.benchmarkValue === null ? null : Number(v.benchmarkValue.toFixed(2)),
      contributed: Number(v.contributedToDate.toFixed(2)),
    })),
    verdict,
    outperformancePoints,
  };
}

/** Readable class name without pulling the client-side label map in. */
function labelFor(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}
