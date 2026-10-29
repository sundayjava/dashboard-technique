import { ContributionStatus, VaultWithdrawalStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Quarterly report cards.
 *
 * Built from stored daily valuations rather than recomputed from prices, so a
 * card always reflects what the member actually saw at the time.
 *
 * Returns are TIME-WEIGHTED against contributions, not a naive
 * (close - open) / open. A member who contributed heavily mid-quarter would
 * otherwise appear to have earned a spectacular return simply for paying money
 * in, which is the single most common way a performance figure lies.
 */

export interface QuarterBounds {
  label: string;
  start: Date;
  end: Date;
}

/** Calendar quarter containing a date, in UTC. */
export function getQuarter(date: Date): QuarterBounds {
  const year = date.getUTCFullYear();
  const quarter = Math.floor(date.getUTCMonth() / 3);
  const start = new Date(Date.UTC(year, quarter * 3, 1));
  const end = new Date(Date.UTC(year, quarter * 3 + 3, 0, 23, 59, 59, 999));
  return { label: `${year} Q${quarter + 1}`, start, end };
}

/** The quarter immediately before the one containing `date`. */
export function getPreviousQuarter(date: Date): QuarterBounds {
  const current = getQuarter(date);
  const dayBefore = new Date(current.start.getTime() - 1);
  return getQuarter(dayBefore);
}

export interface ReportCardData {
  quarterLabel: string;
  periodStart: Date;
  periodEnd: Date;
  openingBalance: number;
  closingBalance: number;
  contributionsInPeriod: number;
  withdrawalsInPeriod: number;
  returnPercent: number;
  benchmarkReturnPercent: number | null;
  outperformancePercent: number | null;
  rebalanceCount: number;
  summary: string;
}

/**
 * Build a report card for one quarter, or null when there is too little data.
 *
 * Needs at least two valuations in the period: one point cannot describe a
 * change, and inventing a return from a single observation would be fiction.
 */
export async function buildReportCard(
  vaultId: string,
  quarter: QuarterBounds,
): Promise<ReportCardData | null> {
  const valuations = await prisma.vaultValuation.findMany({
    where: {
      vaultId,
      valuationDate: { gte: quarter.start, lte: quarter.end },
    },
    orderBy: { valuationDate: 'asc' },
  });

  if (valuations.length < 2) return null;

  const first = valuations[0]!;
  const last = valuations[valuations.length - 1]!;

  const [contributions, withdrawals, rebalanceCount] = await Promise.all([
    prisma.vaultContribution.findMany({
      where: {
        vaultId,
        status: ContributionStatus.COMPLETED,
        processedAt: { gte: quarter.start, lte: quarter.end },
      },
      select: { amount: true },
    }),
    prisma.vaultWithdrawalRequest.findMany({
      where: {
        vaultId,
        status: VaultWithdrawalStatus.PAID,
        processedAt: { gte: quarter.start, lte: quarter.end },
      },
      select: { amount: true },
    }),
    prisma.vaultRebalanceEvent.count({
      where: {
        vaultId,
        status: 'APPLIED',
        executedAt: { gte: quarter.start, lte: quarter.end },
      },
    }),
  ]);

  const contributionsInPeriod = contributions.reduce((s, c) => s + c.amount, 0);
  const withdrawalsInPeriod = withdrawals.reduce((s, w) => s + w.amount, 0);

  const openingBalance = first.totalValue;
  const closingBalance = last.totalValue;

  // Strip external cashflow out of the change, then express what is left
  // against the average capital that was actually at work. Dividing by the
  // opening balance alone would overstate a quarter with a late contribution.
  const netFlow = contributionsInPeriod - withdrawalsInPeriod;
  const investmentGain = closingBalance - openingBalance - netFlow;
  const averageCapital = openingBalance + netFlow / 2;

  const returnPercent = averageCapital > 0 ? (investmentGain / averageCapital) * 100 : 0;

  // The benchmark is already a like-for-like comparator (same cashflows), so
  // its return is computed the same way.
  let benchmarkReturnPercent: number | null = null;
  if (first.benchmarkValue !== null && last.benchmarkValue !== null) {
    const benchGain = last.benchmarkValue - first.benchmarkValue - netFlow;
    const benchAverage = first.benchmarkValue + netFlow / 2;
    benchmarkReturnPercent = benchAverage > 0 ? (benchGain / benchAverage) * 100 : null;
  }

  const outperformancePercent =
    benchmarkReturnPercent === null ? null : returnPercent - benchmarkReturnPercent;

  return {
    quarterLabel: quarter.label,
    periodStart: quarter.start,
    periodEnd: quarter.end,
    openingBalance,
    closingBalance,
    contributionsInPeriod,
    withdrawalsInPeriod,
    returnPercent,
    benchmarkReturnPercent,
    outperformancePercent,
    rebalanceCount,
    summary: buildSummary({
      quarterLabel: quarter.label,
      openingBalance,
      closingBalance,
      contributionsInPeriod,
      withdrawalsInPeriod,
      returnPercent,
      benchmarkReturnPercent,
      outperformancePercent,
      rebalanceCount,
      days: valuations.length,
    }),
  };
}

function buildSummary(p: {
  quarterLabel: string;
  openingBalance: number;
  closingBalance: number;
  contributionsInPeriod: number;
  withdrawalsInPeriod: number;
  returnPercent: number;
  benchmarkReturnPercent: number | null;
  outperformancePercent: number | null;
  rebalanceCount: number;
  days: number;
}): string {
  const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const parts: string[] = [];

  parts.push(
    `Your vault ${p.returnPercent >= 0 ? 'returned' : 'fell'} ` +
      `${Math.abs(p.returnPercent).toFixed(2)}% in ${p.quarterLabel}, moving from ` +
      `${money(p.openingBalance)} to ${money(p.closingBalance)}.`,
  );

  if (p.contributionsInPeriod > 0) {
    parts.push(
      `You contributed ${money(p.contributionsInPeriod)}, which is excluded from the ` +
        `return figure so it reflects investment performance rather than deposits.`,
    );
  }

  if (p.withdrawalsInPeriod > 0) {
    parts.push(`You withdrew ${money(p.withdrawalsInPeriod)}.`);
  }

  if (p.outperformancePercent !== null && p.benchmarkReturnPercent !== null) {
    // "returned -5%" reads awkwardly; a fall is described as a fall.
    const bench = p.benchmarkReturnPercent;
    const benchPhrase =
      bench >= 0
        ? `returned ${bench.toFixed(2)}%`
        : `fell ${Math.abs(bench).toFixed(2)}%`;

    parts.push(
      p.outperformancePercent >= 0
        ? `That is ${p.outperformancePercent.toFixed(2)} points ahead of a traditional ` +
          `60/40 401k, which ${benchPhrase}.`
        : `A traditional 60/40 401k ${benchPhrase} over the same period, ` +
          `${Math.abs(p.outperformancePercent).toFixed(2)} points ahead of your vault.`,
    );
  }

  if (p.rebalanceCount > 0) {
    parts.push(
      `Your allocation was rebalanced ${p.rebalanceCount} time${p.rebalanceCount > 1 ? 's' : ''} this quarter.`,
    );
  }

  // Stated plainly: a quarter built from a handful of observations is not a
  // meaningful performance record, and the member should know that.
  if (p.days < 30) {
    parts.push(
      `This card is based on ${p.days} day(s) of valuations, so treat it as indicative ` +
        `rather than a full quarter's record.`,
    );
  }

  return parts.join(' ');
}

/**
 * Generate and store any missing report cards for a vault.
 *
 * Idempotent on (vaultId, quarterLabel): an existing card is refreshed rather
 * than duplicated, so a late valuation correction flows through.
 */
export async function generateReportCards(
  vaultId: string,
  asOf: Date = new Date(),
): Promise<number> {
  const earliest = await prisma.vaultValuation.findFirst({
    where: { vaultId },
    orderBy: { valuationDate: 'asc' },
    select: { valuationDate: true },
  });

  if (earliest === null) return 0;

  const quarters: QuarterBounds[] = [];
  let cursor = getQuarter(earliest.valuationDate);
  const currentQuarter = getQuarter(asOf);

  // Walk forward through every quarter the vault has existed in, including the
  // one in progress: a member should not wait three months to see anything.
  for (let guard = 0; guard < 200; guard += 1) {
    quarters.push(cursor);
    if (cursor.label === currentQuarter.label) break;
    cursor = getQuarter(new Date(cursor.end.getTime() + 1));
  }

  let written = 0;
  for (const quarter of quarters) {
    const card = await buildReportCard(vaultId, quarter);
    if (card === null) continue;

    await prisma.vaultReportCard.upsert({
      where: { vaultId_quarterLabel: { vaultId, quarterLabel: card.quarterLabel } },
      create: {
        vaultId,
        quarterLabel: card.quarterLabel,
        periodStart: card.periodStart,
        periodEnd: card.periodEnd,
        openingBalance: card.openingBalance,
        closingBalance: card.closingBalance,
        contributionsInPeriod: card.contributionsInPeriod,
        withdrawalsInPeriod: card.withdrawalsInPeriod,
        returnPercent: card.returnPercent,
        benchmarkReturnPercent: card.benchmarkReturnPercent,
        outperformancePercent: card.outperformancePercent,
        summary: card.summary,
        rebalanceCount: card.rebalanceCount,
      },
      update: {
        openingBalance: card.openingBalance,
        closingBalance: card.closingBalance,
        contributionsInPeriod: card.contributionsInPeriod,
        withdrawalsInPeriod: card.withdrawalsInPeriod,
        returnPercent: card.returnPercent,
        benchmarkReturnPercent: card.benchmarkReturnPercent,
        outperformancePercent: card.outperformancePercent,
        summary: card.summary,
        rebalanceCount: card.rebalanceCount,
        generatedAt: new Date(),
      },
    });
    written += 1;
  }

  return written;
}
