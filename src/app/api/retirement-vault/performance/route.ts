import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getOpenVaultForUser } from '@/lib/vault/vault-utils';
import { generateReportCards } from '@/lib/vault/report-card';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Windows the member can switch between, in days. null = since inception. */
const RANGES: Record<string, number | null> = {
  '1M': 30,
  '3M': 90,
  '1Y': 365,
  ALL: null,
};

/**
 * The performance series and quarterly report cards.
 *
 * Reads stored daily valuations rather than recomputing from prices, so the
 * chart shows what the vault was actually worth on each day, including days
 * whose prices have since been corrected.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const vault = await getOpenVaultForUser(auth.user.userId);
    if (vault === null) {
      return NextResponse.json({ success: false, error: 'No vault found.' }, { status: 404 });
    }

    const rangeKey = new URL(request.url).searchParams.get('range') ?? 'ALL';
    const days = RANGES[rangeKey] ?? null;

    const since =
      days === null ? undefined : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const valuations = await prisma.vaultValuation.findMany({
      where: { vaultId: vault.id, ...(since ? { valuationDate: { gte: since } } : {}) },
      orderBy: { valuationDate: 'asc' },
      select: {
        valuationDate: true,
        totalValue: true,
        contributedToDate: true,
        benchmarkValue: true,
      },
    });

    // Refresh cards before reading them, so a member who has not visited in a
    // while still sees the latest quarter.
    await generateReportCards(vault.id).catch((e) =>
      console.error('[Vault Performance] report cards failed:', e),
    );

    const reportCards = await prisma.vaultReportCard.findMany({
      where: { vaultId: vault.id },
      orderBy: { periodStart: 'desc' },
      take: 8,
    });

    const series = valuations.map((v) => ({
      date: v.valuationDate.toISOString().slice(0, 10),
      vault: Number(v.totalValue.toFixed(2)),
      benchmark: v.benchmarkValue === null ? null : Number(v.benchmarkValue.toFixed(2)),
      contributed: Number(v.contributedToDate.toFixed(2)),
    }));

    const first = series[0];
    const last = series[series.length - 1];

    return NextResponse.json({
      success: true,
      range: rangeKey,
      ranges: Object.keys(RANGES),
      // One point cannot describe a trend. The UI uses this to show an honest
      // empty state instead of a chart with a single dot on it.
      hasTrend: series.length >= 2,
      pointCount: series.length,
      series,
      summary:
        first === undefined || last === undefined
          ? null
          : {
              startValue: first.vault,
              endValue: last.vault,
              changeValue: last.vault - first.vault,
              changePercent:
                first.vault > 0 ? ((last.vault - first.vault) / first.vault) * 100 : 0,
              benchmarkEnd: last.benchmark,
              outperformanceValue:
                last.benchmark === null ? null : last.vault - last.benchmark,
            },
      reportCards: reportCards.map((c) => ({
        quarterLabel: c.quarterLabel,
        periodStart: c.periodStart,
        periodEnd: c.periodEnd,
        openingBalance: c.openingBalance,
        closingBalance: c.closingBalance,
        contributionsInPeriod: c.contributionsInPeriod,
        withdrawalsInPeriod: c.withdrawalsInPeriod,
        returnPercent: c.returnPercent,
        benchmarkReturnPercent: c.benchmarkReturnPercent,
        outperformancePercent: c.outperformancePercent,
        rebalanceCount: c.rebalanceCount,
        summary: c.summary,
      })),
    });
  } catch (error) {
    console.error('[Vault Performance] error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load performance.' },
      { status: 500 },
    );
  }
}
