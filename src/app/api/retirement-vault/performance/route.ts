import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getOpenVaultForUser } from '@/lib/vault/vault-utils';
import {
  buildPerformanceStatement,
  StatementPeriod,
} from '@/lib/vault/performance-statement';
import { withDbRetry } from '@/lib/vault/db-retry';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

    const params = new URL(request.url).searchParams;

    // The statement drives the whole screen: period switch, tiles, per-class
    // table and the chart all come from one build, so they cannot disagree.
    const periodParam = (params.get('period') ?? '').toUpperCase();
    const period: StatementPeriod =
      periodParam === 'QUARTER' || periodParam === 'YEAR' || periodParam === 'MONTH'
        ? periodParam
        : 'MONTH';
    // Retried once: this database drops idle connections, and a blip here
    // was reaching the member as a 500 on a page that otherwise works.
    const statement = await withDbRetry(() => buildPerformanceStatement(vault.id, period));

    /*
     * Report cards are READ here, not generated.
     *
     * generateReportCards() walks every quarter the vault has existed in and
     * cost 464ms on every single page view, for data that changes once a
     * quarter. It now runs in the nightly job, beside the valuations it
     * depends on.
     *
     * The separate range query that used to live here fetched the same
     * valuations the statement already had, and fed a `series`/`summary` block
     * no client reads -- the chart takes statement.series.
     */
    const reportCards = await withDbRetry(() =>
      prisma.vaultReportCard.findMany({
        where: { vaultId: vault.id },
        orderBy: { periodStart: 'desc' },
        take: 8,
      }),
    );

    return NextResponse.json({
      success: true,
      statement,
      periods: ['MONTH', 'QUARTER', 'YEAR'],
      profile: vault.riskProfile,
      vaultNumber: vault.vaultNumber,
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
