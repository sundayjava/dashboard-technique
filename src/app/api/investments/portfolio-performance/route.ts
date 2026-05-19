import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a Date as "YYYY-MM-DD" in UTC (consistent with how Prisma stores times) */
function toUTCKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

type TxRow = {
  transactionType: string;
  amount: number;
  balanceAfter: number;
  createdAt: Date;
  investmentId?: string | null;
};

type CompletedInvestment = {
  id: string;
  amount: number;
  profitEarned: number;
  completedAt: Date;
  planName: string;
};

// ─── Merge helper ─────────────────────────────────────────────────────────────
/**
 * Merges real InvestmentTransaction rows (anchors – they SET the balance via
 * balanceAfter) with synthetic rows for Investment completions that never had a
 * linked InvestmentTransaction (deltas – they ADD to the running balance).
 *
 * Walking events in chronological order:
 *   anchor → runningBalance = tx.balanceAfter
 *   delta  → runningBalance += return amount; emit a synthetic TxRow
 *
 * This correctly handles interleaved real and synthetic events so that every
 * investment profit appears on the chart on its completedAt day.
 */
function buildMergedTxRows(
  realTxRows: TxRow[],
  uncovered: CompletedInvestment[],
): TxRow[] {
  if (uncovered.length === 0) return realTxRows;

  type AnchorEvent = { kind: 'anchor'; date: number; row: TxRow };
  type DeltaEvent  = { kind: 'delta';  date: number; inv: CompletedInvestment };
  type Event = AnchorEvent | DeltaEvent;

  const events: Event[] = [
    ...realTxRows.map(row  => ({ kind: 'anchor' as const, date: row.createdAt.getTime(), row })),
    ...uncovered.map(inv => ({ kind: 'delta'  as const, date: inv.completedAt.getTime(), inv })),
  ];

  events.sort((a, b) => a.date - b.date);

  let running = 0;
  const result: TxRow[] = [];

  for (const ev of events) {
    if (ev.kind === 'anchor') {
      running = ev.row.balanceAfter;
      result.push(ev.row);
    } else {
      const total = ev.inv.amount + ev.inv.profitEarned;
      running += total;
      result.push({
        transactionType: 'INVESTMENT_RETURN',
        amount: total,
        balanceAfter: running,
        createdAt: ev.inv.completedAt,
        investmentId: ev.inv.id,
      });
    }
  }

  return result;
}

// ─── Daily series builder ─────────────────────────────────────────────────────
/**
 * Returns one data point per calendar day (UTC).
 * Each day carries the end-of-day balance (last transaction's balanceAfter).
 * Days with no activity carry the previous day's balance forward.
 */
function buildDailyData(
  allTx: TxRow[],
  currentBalance: number,
  period: string,
): { date: string; value: number }[] {
  const now = new Date();

  // Determine window start
  let windowStart: Date;
  switch (period) {
    case '1W':
      windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '1M':
      windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '3M':
      windowStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default: {
      // ALL: start from the day of the first transaction
      const first = allTx[0];
      windowStart = first ? new Date(first.createdAt) : now;
    }
  }
  // Align to UTC midnight
  windowStart = new Date(
    Date.UTC(
      windowStart.getUTCFullYear(),
      windowStart.getUTCMonth(),
      windowStart.getUTCDate(),
    ),
  );

  // Balance at the start of the window (last tx strictly before windowStart)
  let runningBalance =
    allTx.filter((t) => t.createdAt < windowStart).at(-1)?.balanceAfter ?? 0;

  // Group transactions by UTC date key
  const txByDay = new Map<string, TxRow[]>();
  for (const tx of allTx) {
    if (tx.createdAt < windowStart) continue;
    const key = toUTCKey(tx.createdAt);
    if (!txByDay.has(key)) txByDay.set(key, []);
    txByDay.get(key)!.push(tx);
  }

  // Walk day by day from windowStart to today
  const result: { date: string; value: number }[] = [];
  const cursor = new Date(windowStart);
  const endUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  while (cursor <= endUTC) {
    const key = toUTCKey(cursor);
    const dayTxs = txByDay.get(key);
    if (dayTxs?.length) {
      // End-of-day balance = last transaction's balanceAfter
      runningBalance = dayTxs.at(-1)!.balanceAfter;
    }

    // Only start the series once the user has a non-zero balance
    if (runningBalance > 0 || result.length > 0) {
      result.push({ date: key, value: runningBalance });
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // Force the very last point to reflect the live balance
  if (result.length > 0) {
    result[result.length - 1].value = currentBalance;
  }

  return result;
}

// ─── Hourly series builder (for 1D) ──────────────────────────────────────────
/**
 * Returns one data point per hour over the last 24 hours.
 * Hours with no activity carry the previous hour's balance forward.
 */
function buildHourlyData(
  allTx: TxRow[],
  currentBalance: number,
): { date: string; value: number }[] {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Balance just before the 24-hour window
  let runningBalance =
    allTx.filter((t) => t.createdAt < windowStart).at(-1)?.balanceAfter ?? 0;

  // Group by UTC hour key (ISO string rounded to the hour)
  const toHourKey = (d: Date) => {
    const h = new Date(d);
    h.setMinutes(0, 0, 0);
    return h.toISOString();
  };

  const txByHour = new Map<string, TxRow[]>();
  for (const tx of allTx) {
    if (tx.createdAt < windowStart || tx.createdAt > now) continue;
    const key = toHourKey(tx.createdAt);
    if (!txByHour.has(key)) txByHour.set(key, []);
    txByHour.get(key)!.push(tx);
  }

  // Build 25 hourly points (0 h ago → now)
  const result: { date: string; value: number }[] = [];
  const hourCursor = new Date(windowStart);
  hourCursor.setMinutes(0, 0, 0);

  for (let i = 0; i <= 24; i++) {
    const key = hourCursor.toISOString();
    const hourTxs = txByHour.get(key);
    if (hourTxs?.length) {
      runningBalance = hourTxs.at(-1)!.balanceAfter;
    }
    result.push({ date: key, value: runningBalance });
    hourCursor.setHours(hourCursor.getHours() + 1);
  }

  if (result.length > 0) {
    result[result.length - 1].value = currentBalance;
  }

  return result;
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const period = searchParams.get('period') || 'ALL';

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const [allTransactions, completedInvestments, user] = await Promise.all([
      prisma.investmentTransaction.findMany({
        where: { userId, status: 'COMPLETED' },
        orderBy: { createdAt: 'asc' },
        select: { transactionType: true, amount: true, balanceAfter: true, createdAt: true, investmentId: true },
      }),
      // Fetch completed investments so we can synthesise profit events for those
      // that were completed before INVESTMENT_RETURN transactions were recorded.
      prisma.investment.findMany({
        where: {
          userId,
          status: 'COMPLETED',
          completedAt: { not: null },
          profitEarned: { gt: 0 },
        },
        select: {
          id: true,
          amount: true,
          profitEarned: true,
          completedAt: true,
          plan: { select: { planName: true } },
        },
        orderBy: { completedAt: 'asc' },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { investmentBalance: true },
      }),
    ]);

    const currentBalance = user?.investmentBalance ?? 0;

    // Investments that already have a linked InvestmentTransaction (via investmentId)
    const coveredIds = new Set(
      allTransactions
        .filter(t => t.investmentId != null)
        .map(t => t.investmentId as string),
    );

    // Investments whose profit has NOT yet been captured as an InvestmentTransaction
    const uncoveredCompletions: CompletedInvestment[] = completedInvestments
      .filter(inv => !coveredIds.has(inv.id) && inv.completedAt != null)
      .map(inv => ({
        id: inv.id,
        amount: inv.amount,
        profitEarned: inv.profitEarned,
        completedAt: inv.completedAt as Date,
        planName: inv.plan.planName,
      }));

    // Merge real transactions with synthetic completion rows
    const mergedTxRows = buildMergedTxRows(allTransactions, uncoveredCompletions);

    if (mergedTxRows.length === 0) {
      return NextResponse.json({
        success: true,
        hasData: false,
        chartData: [],
        period,
        summary: {
          totalInvestment: 0,
          currentValue: currentBalance,
          totalProfit: 0,
          profitPercentage: 0,
          allTimeHigh: currentBalance,
          annualizedReturns: 0,
        },
        initialDeposit: null,
      });
    }

    // ─── Summary stats (always over ALL transactions) ─────────────────────
    const totalDeposited = allTransactions
      .filter((t) => t.transactionType === 'DEPOSIT')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalWithdrawn = allTransactions
      .filter((t) => t.transactionType === 'WITHDRAWAL')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalInvestment = Math.max(totalDeposited - totalWithdrawn, 0);
    // allTimeHigh uses the merged rows so synthetic profit events are included
    const allTimeHigh = Math.max(...mergedTxRows.map((t) => t.balanceAfter), currentBalance);
    const totalProfit = currentBalance - totalInvestment;
    const profitPercentage = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;

    const now = new Date();
    const daysDiff = Math.max(
      (now.getTime() - mergedTxRows[0].createdAt.getTime()) / (1000 * 60 * 60 * 24),
      1,
    );
    const annualizedReturns = totalInvestment > 0 ? (profitPercentage / daysDiff) * 365 : 0;
    const firstDeposit = allTransactions.find((t) => t.transactionType === 'DEPOSIT');

    // ─── Build chart data (use merged rows so profits appear on their day) ──
    const chartData =
      period === '1D'
        ? buildHourlyData(mergedTxRows, currentBalance)
        : buildDailyData(mergedTxRows, currentBalance, period);

    return NextResponse.json({
      success: true,
      hasData: true,
      chartData,
      period,
      summary: { totalInvestment, currentValue: currentBalance, totalProfit, profitPercentage, allTimeHigh, annualizedReturns },
      initialDeposit: firstDeposit
        ? { date: firstDeposit.createdAt.toISOString(), amount: firstDeposit.amount }
        : null,
    });
  } catch (error) {
    console.error('Error fetching portfolio performance:', error);
    return NextResponse.json({ error: 'Failed to fetch portfolio performance data' }, { status: 500 });
  }
}
