import { NextRequest, NextResponse } from 'next/server';
import { PriceSyncTrigger } from '@prisma/client';
import { getPriceFreshness, syncAssetPrices } from '@/lib/vault/price-sync';

export const dynamic = 'force-dynamic';

/**
 * Vercel Hobby allows up to 60s; the default 10s is not enough headroom for a
 * cold start that pays DNS and TLS per provider before any price arrives.
 * Without this, a slow vendor truncates the sync midway and leaves prices
 * half-written.
 */
export const maxDuration = 60;

/**
 * Retirement Vault price sync.
 *
 * The Hobby plan allows only two cron entries and both are already used, so
 * the nightly run is folded into /api/cron/check-investments. This endpoint
 * exists for:
 *
 *   - an external scheduler (e.g. a free GitHub Actions workflow) when
 *     intraday drift detection is added, which Hobby crons cannot do
 *   - admin-triggered manual refreshes
 *   - monitoring, via GET with ?check=1, which reports freshness without
 *     spending any API credits
 *
 * Auth matches the existing cron routes: a CRON_SECRET bearer token when the
 * secret is configured.
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

    // Read-only health probe: costs no provider credits, so it is safe to
    // poll frequently from uptime monitoring.
    if (searchParams.get('check') === '1') {
      const freshness = await getPriceFreshness();
      return NextResponse.json({
        success: true,
        mode: 'check',
        isStale: freshness.isStale,
        oldestSyncedAt: freshness.oldestSyncedAt,
        ageHours: freshness.ageHours,
        neverSyncedCount: freshness.neverSyncedCount,
        failingSymbols: freshness.failingSymbols,
      });
    }

    // `force` overrides the single-flight guard and so can spend provider
    // credits on every call. It therefore requires a configured CRON_SECRET
    // and a matching token — without that, an unauthenticated loop could
    // exhaust the 800/day budget and fill price_sync_runs without bound.
    const forceRequested = searchParams.get('force') === '1';

    if (forceRequested && !authenticated) {
      return NextResponse.json(
        {
          success: false,
          error:
            'force=1 requires CRON_SECRET to be configured and supplied as a bearer token.',
        },
        { status: 403 },
      );
    }

    const trigger = forceRequested ? PriceSyncTrigger.MANUAL : PriceSyncTrigger.CRON;
    const result = await syncAssetPrices(trigger, { force: forceRequested });

    // A declined run priced nothing, which is neither success nor failure.
    // Reporting it as 409 keeps monitoring able to tell the three apart.
    const httpStatus = result.skipped ? 409 : result.status === 'FAILED' ? 500 : 200;

    return NextResponse.json(
      {
        success: !result.skipped && result.status !== 'FAILED',
        skipped: result.skipped,
        runId: result.runId,
        status: result.status,
        attempted: result.attempted,
        succeeded: result.succeeded,
        failed: result.failed,
        durationMs: result.durationMs,
        skippedReason: result.skippedReason,
        failures: result.failures,
      },
      { status: httpStatus },
    );
  } catch (error) {
    console.error('[Vault Price Sync] Unhandled error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Price sync failed',
      },
      { status: 500 },
    );
  }
}
