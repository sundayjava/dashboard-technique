import { PriceProvider, PriceSyncStatus, PriceSyncTrigger } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { TWELVE_DATA_CREDIT_CEILING } from './asset-registry';
import { AssetFeedRequest, fetchPricesForAssets } from './price-providers';
import { invalidatePriceCaches } from './valuation';

/**
 * Price synchronisation engine.
 *
 * Fetches every active asset's price from its configured feed and writes the
 * result into `asset_price_snapshots` (immutable daily history) and onto the
 * `vault_assets` row (fast-read latest price). Every run is recorded in
 * `price_sync_runs` so staleness is observable rather than guessed at.
 *
 * Design rules this module upholds:
 *
 *  - Idempotent. Snapshots upsert on (assetId, priceDate), so re-running a
 *    day's sync corrects that day instead of duplicating it. Duplicate closes
 *    would silently corrupt every return calculation downstream.
 *
 *  - Partial success is success. One dead feed must not blank a dashboard, so
 *    assets are written independently and the run is marked PARTIAL.
 *
 *  - Single-flight. Concurrent runs would double-spend a per-minute credit
 *    budget that only allows one sync, so an in-flight run blocks new ones.
 *
 * ---------------------------------------------------------------------------
 * IMPORTANT FOR VALUATION CODE — trading calendars differ by asset class.
 *
 * Crypto trades continuously, so its snapshots are dated the current UTC day.
 * Equities, bonds, commodities and REITs are dated by the exchange's last
 * close, which on a weekend or holiday can be several days earlier. The two
 * only coincide intraday on a trading day.
 *
 * Consequently NO SINGLE `priceDate` IS GUARANTEED TO HOLD EVERY ASSET, and a
 * valuation that inner-joins all assets on one `priceDate` will silently value
 * a partial portfolio — understating a vault by whatever it failed to match.
 *
 * Valuation and benchmark series must instead take, per asset, the most recent
 * close ON OR BEFORE the valuation date (a forward fill). That is the standard
 * treatment for mixed 24/7 and exchange-hours portfolios, and it is why
 * snapshots keep the vendor's own trading date rather than being rewritten to
 * a common one — rewriting would file a Friday close as Sunday's price.
 * ---------------------------------------------------------------------------
 */

/** A run still marked RUNNING after this long is treated as crashed, not live. */
const STALE_RUN_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * How old prices may be before a read treats them as stale.
 *
 * Must exceed the cron interval, or a HEALTHY system looks stale for part of
 * every day. The nightly cron runs once every 24h and Vercel Hobby fires it on
 * a best-effort schedule that can drift by up to an hour, so anything at or
 * under 24 would make `syncIfStale` fire on ordinary dashboard reads and drain
 * the 800/day provider budget.
 *
 * 26h = 24h cycle + an hour of scheduling drift + an hour of margin. A sync is
 * then triggered by a genuinely MISSED run, which is exactly the failure this
 * self-heal exists to cover.
 */
export const DEFAULT_STALE_THRESHOLD_HOURS = 26;

export interface PriceSyncResult {
  runId: string | null;
  status: PriceSyncStatus;
  attempted: number;
  succeeded: number;
  failed: number;
  durationMs: number;
  /**
   * True when this call declined to do any work (another run in flight, no
   * assets, or a misconfigured registry).
   *
   * Monitoring needs this as a distinct signal: a declined call reports
   * zero priced assets, which must not be mistaken for either a successful
   * sync or a failing one.
   */
  skipped: boolean;
  /** Set when the run was declined rather than executed. */
  skippedReason?: string;
  failures: Array<{ symbol: string; message: string }>;
}

/**
 * Run a price sync.
 *
 * `force` bypasses the single-flight guard; reserve it for admin-triggered
 * runs where a human has decided a stuck run should be overridden.
 */
export async function syncAssetPrices(
  trigger: PriceSyncTrigger,
  options: { force?: boolean } = {},
): Promise<PriceSyncResult> {
  const startedAt = Date.now();

  // --- single-flight guard -------------------------------------------------
  if (options.force !== true) {
    const inFlight = await prisma.priceSyncRun.findFirst({
      where: {
        status: PriceSyncStatus.RUNNING,
        startedAt: { gte: new Date(Date.now() - STALE_RUN_TIMEOUT_MS) },
      },
      orderBy: { startedAt: 'desc' },
    });

    if (inFlight !== null) {
      return {
        runId: inFlight.id,
        status: PriceSyncStatus.RUNNING,
        attempted: 0,
        succeeded: 0,
        failed: 0,
        durationMs: Date.now() - startedAt,
        skipped: true,
        skippedReason: `A sync started at ${inFlight.startedAt.toISOString()} is still running.`,
        failures: [],
      };
    }
  }

  // --- load the universe ---------------------------------------------------
  const assets = await prisma.vaultAsset.findMany({
    where: {
      isActive: true,
      // MANUAL assets are admin-priced; a feed must never overwrite them.
      provider: { not: PriceProvider.MANUAL },
    },
    orderBy: { displayOrder: 'asc' },
  });

  if (assets.length === 0) {
    return {
      runId: null,
      status: PriceSyncStatus.SUCCESS,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      durationMs: Date.now() - startedAt,
      skipped: true,
      skippedReason: 'No active assets to price. Run db:seed:vault-assets first.',
      failures: [],
    };
  }

  // --- credit budget guard -------------------------------------------------
  // Enforced against what is actually ACTIVE IN THE DATABASE, not against the
  // registry file — an asset added or reactivated directly in the DB would
  // otherwise bypass the registry's own validation.
  //
  // This aborts rather than proceeding because exceeding the window makes the
  // adapter wait a full minute between batches, which outlives the function
  // and would leave the run stuck in RUNNING, blocking every later sync until
  // STALE_RUN_TIMEOUT_MS expires.
  const twelveDataCount = assets.filter(
    (asset) => asset.provider === PriceProvider.TWELVE_DATA,
  ).length;

  if (twelveDataCount > TWELVE_DATA_CREDIT_CEILING) {
    return {
      runId: null,
      status: PriceSyncStatus.FAILED,
      attempted: assets.length,
      succeeded: 0,
      failed: 0,
      durationMs: Date.now() - startedAt,
      skipped: true,
      skippedReason:
        `${twelveDataCount} active TWELVE_DATA assets exceeds the ` +
        `${TWELVE_DATA_CREDIT_CEILING}-credit/minute free tier. Deactivate an asset, ` +
        `or use role BOTH to stop a symbol being fetched twice.`,
      failures: [],
    };
  }

  const run = await prisma.priceSyncRun.create({
    data: {
      trigger,
      status: PriceSyncStatus.RUNNING,
      assetsAttempted: assets.length,
    },
  });

  // --- race narrowing ------------------------------------------------------
  // The guard above is check-then-act and therefore not atomic: two callers
  // can both observe no in-flight run and both create one, double-spending a
  // per-minute credit window that only affords a single sync.
  //
  // Re-checking AFTER our own insert closes most of that window, because by
  // now any competing run is visible. The loser yields to the run that started
  // first. A fully atomic fix needs a database-level lock or a partial unique
  // index on status = RUNNING; this is deliberately the cheaper mitigation,
  // since the realistic callers are one nightly cron and a self-heal that only
  // fires after 26h of staleness.
  if (options.force !== true) {
    const competitor = await prisma.priceSyncRun.findFirst({
      where: {
        id: { not: run.id },
        status: PriceSyncStatus.RUNNING,
        startedAt: { gte: new Date(Date.now() - STALE_RUN_TIMEOUT_MS) },
      },
      orderBy: { startedAt: 'asc' },
    });

    if (competitor !== null && competitor.startedAt <= run.startedAt) {
      await prisma.priceSyncRun
        .update({
          where: { id: run.id },
          data: {
            status: PriceSyncStatus.FAILED,
            errors: JSON.stringify([
              { symbol: '*', message: 'Yielded to a concurrent sync.' },
            ]),
            completedAt: new Date(),
            durationMs: Date.now() - startedAt,
          },
        })
        .catch(() => undefined);

      return {
        runId: run.id,
        status: PriceSyncStatus.RUNNING,
        attempted: 0,
        succeeded: 0,
        failed: 0,
        durationMs: Date.now() - startedAt,
        skipped: true,
        skippedReason: `Yielded to concurrent sync ${competitor.id}.`,
        failures: [],
      };
    }
  }

  try {
    const requests: AssetFeedRequest[] = assets.map((asset) => ({
      assetId: asset.id,
      symbol: asset.symbol,
      provider: asset.provider,
      providerSymbol: asset.providerSymbol,
      fallbackProvider: asset.fallbackProvider,
      fallbackSymbol: asset.fallbackSymbol,
    }));

    const { quotes, failures } = await fetchPricesForAssets(requests);

    const symbolById = new Map(assets.map((a) => [a.id, a.symbol]));
    const recordedFailures: Array<{ symbol: string; message: string }> = [];
    let succeeded = 0;

    // --- persist successes -------------------------------------------------
    for (const [assetId, quote] of quotes) {
      const symbol = symbolById.get(assetId) ?? assetId;

      try {
        // Snapshot and latest-price update move together: a snapshot without
        // its asset row updated would make the dashboard disagree with history.
        await prisma.$transaction([
          prisma.assetPriceSnapshot.upsert({
            where: {
              assetId_priceDate: { assetId, priceDate: quote.priceDate },
            },
            create: {
              assetId,
              priceDate: quote.priceDate,
              open: quote.open ?? null,
              high: quote.high ?? null,
              low: quote.low ?? null,
              close: quote.close,
              volume: quote.volume ?? null,
              changePercent: quote.changePercent ?? null,
              source: quote.source,
            },
            update: {
              open: quote.open ?? null,
              high: quote.high ?? null,
              low: quote.low ?? null,
              close: quote.close,
              volume: quote.volume ?? null,
              changePercent: quote.changePercent ?? null,
              source: quote.source,
            },
          }),
          prisma.vaultAsset.update({
            where: { id: assetId },
            data: {
              currentPrice: quote.close,
              // Only overwrite when the vendor actually supplied a value.
              // Coercing a missing field to 0 would destroy a previously good
              // figure and make downstream (close - prev)/prev divide by zero,
              // as well as disagreeing with the NULL stored in the snapshot.
              ...(quote.previousClose !== undefined
                ? { previousClose: quote.previousClose }
                : {}),
              ...(quote.changePercent !== undefined
                ? { priceChange24h: quote.changePercent }
                : {}),
              lastSyncedAt: new Date(),
              lastSyncError: null,
              consecutiveFailures: 0,
            },
          }),
        ]);

        succeeded += 1;
      } catch (error) {
        // A write failure is a failure for this asset, even though the fetch
        // worked — otherwise the run would over-report its own success.
        const message = error instanceof Error ? error.message : String(error);
        recordedFailures.push({ symbol, message: `Database write failed: ${message}` });
      }
    }

    // --- record failures ---------------------------------------------------
    for (const [assetId, error] of failures) {
      const symbol = symbolById.get(assetId) ?? assetId;
      recordedFailures.push({ symbol, message: error.message });

      try {
        await prisma.vaultAsset.update({
          where: { id: assetId },
          data: {
            lastSyncError: error.message,
            // Drives the stale-data warning in admin: one blip is noise,
            // a rising count is an outage worth acting on.
            consecutiveFailures: { increment: 1 },
          },
        });
      } catch {
        // Recording a failure must never itself fail the run.
      }
    }

    const failed = recordedFailures.length;
    const status =
      failed === 0
        ? PriceSyncStatus.SUCCESS
        : succeeded === 0
          ? PriceSyncStatus.FAILED
          : PriceSyncStatus.PARTIAL;

    const durationMs = Date.now() - startedAt;

    await prisma.priceSyncRun.update({
      where: { id: run.id },
      data: {
        status,
        assetsSucceeded: succeeded,
        assetsFailed: failed,
        errors: failed > 0 ? JSON.stringify(recordedFailures) : null,
        completedAt: new Date(),
        durationMs,
      },
    });

    // Prices just changed, so anything cached against them is now wrong.
    // Cleared even on a PARTIAL run, which still wrote some of them.
    invalidatePriceCaches();

    return {
      runId: run.id,
      status,
      attempted: assets.length,
      succeeded,
      failed,
      durationMs,
      skipped: false,
      failures: recordedFailures,
    };
  } catch (error) {
    // An unexpected throw must still close out the run, or the single-flight
    // guard would block every future sync for STALE_RUN_TIMEOUT_MS.
    const message = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - startedAt;

    await prisma.priceSyncRun
      .update({
        where: { id: run.id },
        data: {
          status: PriceSyncStatus.FAILED,
          errors: JSON.stringify([{ symbol: '*', message }]),
          completedAt: new Date(),
          durationMs,
        },
      })
      .catch(() => undefined);

    // A run that threw partway may still have written prices.
    invalidatePriceCaches();

    return {
      runId: run.id,
      status: PriceSyncStatus.FAILED,
      attempted: assets.length,
      succeeded: 0,
      failed: assets.length,
      durationMs,
      skipped: false,
      failures: [{ symbol: '*', message }],
    };
  }
}

export interface PriceFreshness {
  isStale: boolean;
  /** Oldest `lastSyncedAt` across active assets — the weakest link. */
  oldestSyncedAt: Date | null;
  ageHours: number | null;
  neverSyncedCount: number;
  /** Assets failing repeatedly, worth surfacing in admin. */
  failingSymbols: string[];
}

/**
 * Report how fresh stored prices are.
 *
 * Measures the OLDEST asset rather than the newest: a vault valued from one
 * stale leg is wrong even if every other price updated a minute ago.
 */
export async function getPriceFreshness(
  thresholdHours: number = DEFAULT_STALE_THRESHOLD_HOURS,
): Promise<PriceFreshness> {
  const assets = await prisma.vaultAsset.findMany({
    where: { isActive: true, provider: { not: PriceProvider.MANUAL } },
    select: { symbol: true, lastSyncedAt: true, consecutiveFailures: true },
  });

  if (assets.length === 0) {
    return {
      isStale: false,
      oldestSyncedAt: null,
      ageHours: null,
      neverSyncedCount: 0,
      failingSymbols: [],
    };
  }

  const neverSynced = assets.filter((a) => a.lastSyncedAt === null);
  const synced = assets.filter(
    (a): a is typeof a & { lastSyncedAt: Date } => a.lastSyncedAt !== null,
  );

  const oldestSyncedAt =
    synced.length > 0
      ? synced.reduce(
          (oldest, a) => (a.lastSyncedAt < oldest ? a.lastSyncedAt : oldest),
          synced[0]!.lastSyncedAt,
        )
      : null;

  const ageHours =
    oldestSyncedAt !== null
      ? (Date.now() - oldestSyncedAt.getTime()) / (1000 * 60 * 60)
      : null;

  return {
    // Never-synced assets are stale by definition, whatever the clock says.
    isStale: neverSynced.length > 0 || (ageHours !== null && ageHours > thresholdHours),
    oldestSyncedAt,
    ageHours,
    neverSyncedCount: neverSynced.length,
    failingSymbols: assets.filter((a) => a.consecutiveFailures > 0).map((a) => a.symbol),
  };
}

/**
 * Refresh prices only if they have gone stale.
 *
 * This is the self-heal behind vault dashboard reads. It exists because the
 * free Vercel plan runs crons on a best-effort schedule with no guarantee a
 * given night's run fired — without it, a skipped cron would quietly serve
 * yesterday's valuations.
 */
export async function syncIfStale(
  thresholdHours: number = DEFAULT_STALE_THRESHOLD_HOURS,
): Promise<PriceSyncResult | null> {
  const freshness = await getPriceFreshness(thresholdHours);
  if (!freshness.isStale) return null;
  return syncAssetPrices(PriceSyncTrigger.ON_DEMAND);
}
