import 'dotenv/config';
import { PriceSyncTrigger } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { getPriceFreshness, syncAssetPrices } from '../src/lib/vault/price-sync';

/**
 * Manual verification harness for the price sync.
 *
 * Runs a real sync, prints what landed in the database, then re-runs to prove
 * the (assetId, priceDate) upsert is idempotent — that the second run updates
 * the same rows instead of duplicating a trading day's history.
 */
async function main() {
  console.log('=== RUN 1 ===');
  const first = await syncAssetPrices(PriceSyncTrigger.MANUAL);
  console.log(
    `status=${first.status} attempted=${first.attempted} ok=${first.succeeded} ` +
      `failed=${first.failed} in ${first.durationMs}ms`,
  );
  if (first.skippedReason) console.log(`skipped: ${first.skippedReason}`);
  for (const f of first.failures) console.log(`  FAIL ${f.symbol}: ${f.message}`);

  const assets = await prisma.vaultAsset.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
    select: {
      symbol: true,
      assetClass: true,
      role: true,
      currentPrice: true,
      previousClose: true,
      priceChange24h: true,
      sleeveWeight: true,
      consecutiveFailures: true,
      lastSyncedAt: true,
    },
  });

  console.log('\n=== STORED PRICES ===');
  console.log(
    'SYM   CLASS            ROLE       SLEEVE    PRICE         PREV        24H%    FAILS',
  );
  for (const a of assets) {
    console.log(
      `${a.symbol.padEnd(5)} ${a.assetClass.padEnd(16)} ${a.role.padEnd(10)} ` +
        `${(a.sleeveWeight * 100).toFixed(0).padStart(4)}%  ` +
        `${('$' + a.currentPrice.toLocaleString()).padEnd(13)} ` +
        `${('$' + a.previousClose.toFixed(2)).padEnd(11)} ` +
        `${a.priceChange24h.toFixed(2).padStart(6)}%  ${String(a.consecutiveFailures).padStart(5)}`,
    );
  }

  const snapCount1 = await prisma.assetPriceSnapshot.count();
  console.log(`\nsnapshots after run 1: ${snapCount1}`);

  // Twelve Data allows 8 credits per minute and a full sync spends 7, so two
  // back-to-back syncs would 429 the second one. That is correct provider
  // behaviour, not a bug — but it would make this idempotency check measure
  // rate limiting instead of upsert semantics. Wait out the window.
  console.log('\nwaiting 65s for the Twelve Data credit window to reset...');
  await new Promise((resolve) => setTimeout(resolve, 65000));

  console.log('\n=== RUN 2 (idempotency check) ===');
  const second = await syncAssetPrices(PriceSyncTrigger.MANUAL, { force: true });
  console.log(
    `status=${second.status} ok=${second.succeeded} failed=${second.failed} ` +
      `in ${second.durationMs}ms`,
  );

  const snapCount2 = await prisma.assetPriceSnapshot.count();
  console.log(`snapshots after run 2: ${snapCount2}`);
  console.log(
    snapCount1 === snapCount2
      ? `IDEMPOTENT: snapshot count unchanged at ${snapCount2}`
      : `NOT IDEMPOTENT: ${snapCount1} -> ${snapCount2} (duplicate history!)`,
  );

  const freshness = await getPriceFreshness();
  console.log('\n=== FRESHNESS ===');
  console.log(
    `stale=${freshness.isStale} age=${freshness.ageHours?.toFixed(2) ?? 'n/a'}h ` +
      `neverSynced=${freshness.neverSyncedCount} failing=[${freshness.failingSymbols.join(', ')}]`,
  );

  const runs = await prisma.priceSyncRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 5,
    select: {
      trigger: true,
      status: true,
      assetsSucceeded: true,
      assetsFailed: true,
      durationMs: true,
    },
  });
  console.log('\n=== AUDIT TRAIL ===');
  for (const r of runs) {
    console.log(
      `  ${r.trigger.padEnd(10)} ${r.status.padEnd(8)} ok=${r.assetsSucceeded} ` +
        `failed=${r.assetsFailed} ${r.durationMs ?? '?'}ms`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    // Keep-alive sockets from the price providers hold the event loop open
    // otherwise; irrelevant in a serverless request, but it hangs a script.
    process.exit(0);
  });
