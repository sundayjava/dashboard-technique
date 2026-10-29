import { NextRequest, NextResponse } from 'next/server';
import { computeClassRates, runDailyClassPerformance } from '@/lib/vault/class-performance';
import { loadVaultPolicy } from '@/lib/vault/policy-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Close a day's class performance and credit every member.
 *
 * The nightly run is folded into /api/cron/check-investments, because the
 * Vercel Hobby plan allows only two cron entries and both are taken. This
 * endpoint exists for the cases that one cannot serve:
 *
 *   - re-running a night that failed, which is safe: a day already credited is
 *     recognised by its unique key and left alone
 *   - closing a specific date with ?date=YYYY-MM-DD, for backfilling
 *   - previewing what a day WOULD pay, with ?dry=1, which writes nothing
 *
 * Auth matches the other cron routes: a CRON_SECRET bearer token when the
 * secret is configured. Unlike the price sync, there is no read-only mode that
 * needs no token -- every path here either moves money or discloses the rates
 * that will.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const authenticated = cronSecret !== undefined && authHeader === `Bearer ${cronSecret}`;

    if (cronSecret && !authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // An explicit date is parsed strictly. Date's own parser would read
    // nonsense as Invalid Date and then silently credit the epoch.
    const dateParam = searchParams.get('date');
    let asOf = new Date();
    if (dateParam !== null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return NextResponse.json(
          { success: false, error: 'date must be YYYY-MM-DD.' },
          { status: 400 },
        );
      }
      asOf = new Date(`${dateParam}T00:00:00.000Z`);
      if (Number.isNaN(asOf.getTime())) {
        return NextResponse.json(
          { success: false, error: 'date is not a real date.' },
          { status: 400 },
        );
      }
    }

    const policy = await loadVaultPolicy();

    if (searchParams.get('dry') === '1') {
      const rates = await computeClassRates(asOf, policy);
      return NextResponse.json({
        success: true,
        mode: 'dry',
        date: asOf.toISOString().slice(0, 10),
        rateCapPercent: policy.dailyRateCapPercent,
        rates,
      });
    }

    const result = await runDailyClassPerformance(asOf, policy);

    return NextResponse.json({
      success: result.failures.length === 0,
      date: result.date.toISOString().slice(0, 10),
      rateCapPercent: policy.dailyRateCapPercent,
      rates: result.rates,
      vaultsConsidered: result.vaultsConsidered,
      vaultsCredited: result.vaultsCredited,
      creditsWritten: result.creditsWritten,
      alreadyCredited: result.alreadyCredited,
      netAmount: result.netAmount,
      failures: result.failures,
    });
  } catch (error) {
    console.error('[Vault Class Performance] Unhandled error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Class performance failed',
      },
      { status: 500 },
    );
  }
}
