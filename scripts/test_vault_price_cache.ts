import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import {
  getBenchmarkIndex, getPricesAsOf, invalidatePriceCaches, valueVault,
} from '../src/lib/vault/valuation';

/**
 * The cache must make valuation faster WITHOUT ever showing stale numbers.
 * Speed is the easy half; the checks that matter are the staleness ones.
 */

let passed = 0, failed = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label} ${detail}`); }
}

async function main() {
  const vault = await prisma.retirementVault.findFirst();
  if (vault === null) {
    console.log('No vault present to measure against.');
    return;
  }

  console.log('=== 1. It is actually faster ===');
  invalidatePriceCaches();
  const t0 = Date.now();
  await valueVault(vault.id);
  const cold = Date.now() - t0;

  const t1 = Date.now();
  await valueVault(vault.id);
  const warm = Date.now() - t1;

  console.log(`  cold ${cold}ms -> warm ${warm}ms  (${(cold / Math.max(1, warm)).toFixed(1)}x)`);
  check('warm valuation is faster than cold', warm < cold, `${cold} -> ${warm}`);
  // Not an arbitrary target: this database answers a trivial query in ~170ms
  // and does NOT run queries concurrently, so a handful of round-trips is the
  // floor. Measured at ~725ms warm; 1200 leaves room for a noisy run without
  // letting a real regression through.
  check('warm valuation is under 1200ms', warm < 1200, `got ${warm}ms`);
  check('caching removes at least a third of the work', warm < cold * 0.7,
    `cold ${cold}ms, warm ${warm}ms`);

  console.log('\n=== 2. Cached values are IDENTICAL, not approximate ===');
  invalidatePriceCaches();
  const fresh = await valueVault(vault.id);
  const cached = await valueVault(vault.id);
  check('total value identical', fresh?.totalValue === cached?.totalValue,
    `${fresh?.totalValue} vs ${cached?.totalValue}`);
  check('holdings count identical', fresh?.holdings.length === cached?.holdings.length);
  check('benchmark identical', fresh?.benchmarkValue === cached?.benchmarkValue,
    `${fresh?.benchmarkValue} vs ${cached?.benchmarkValue}`);

  console.log('\n=== 3. A price change is visible IMMEDIATELY after invalidation ===');
  const asset = await prisma.vaultAsset.findFirstOrThrow({
    where: { isActive: true, role: { not: 'BENCHMARK' } },
    orderBy: { displayOrder: 'asc' },
  });
  const snapshot = await prisma.assetPriceSnapshot.findFirst({
    where: { assetId: asset.id },
    orderBy: { priceDate: 'desc' },
  });
  if (snapshot === null) {
    console.log('  (no snapshot to perturb — skipping)');
  } else {
    const original = snapshot.close;
    const before = (await getPricesAsOf())?.get(asset.id)?.close;

    // Change the stored price behind the cache's back.
    await prisma.assetPriceSnapshot.update({
      where: { id: snapshot.id },
      data: { close: original * 2 },
    });

    const stillCached = (await getPricesAsOf())?.get(asset.id)?.close;
    check('cache does hold the old value until invalidated', stillCached === before,
      `${before} -> ${stillCached}`);

    invalidatePriceCaches();
    const afterInvalidate = (await getPricesAsOf())?.get(asset.id)?.close;
    check('invalidation exposes the new price at once',
      Math.abs((afterInvalidate ?? 0) - original * 2) < 0.01,
      `expected ${original * 2}, got ${afterInvalidate}`);

    // Put it back exactly as it was.
    await prisma.assetPriceSnapshot.update({
      where: { id: snapshot.id },
      data: { close: original },
    });
    invalidatePriceCaches();
    const restored = (await getPricesAsOf())?.get(asset.id)?.close;
    check('restored to the original price', Math.abs((restored ?? 0) - original) < 0.01,
      `${restored} vs ${original}`);
  }

  console.log('\n=== 4. Member data is NEVER cached ===');
  // Change cash and confirm the next valuation reflects it without any
  // invalidation call: only prices are cached, never balances.
  const v = await prisma.retirementVault.findUniqueOrThrow({ where: { id: vault.id } });
  const originalCash = v.cashBalance;
  await prisma.retirementVault.update({
    where: { id: vault.id },
    data: { cashBalance: originalCash + 1234 },
  });
  const afterCash = await valueVault(vault.id);
  check('a cash change shows up with no invalidation',
    Math.abs((afterCash?.cashBalance ?? 0) - (originalCash + 1234)) < 0.01,
    `got ${afterCash?.cashBalance}`);
  await prisma.retirementVault.update({
    where: { id: vault.id },
    data: { cashBalance: originalCash },
  });

  console.log('\n=== 5. Different dates are cached separately ===');
  invalidatePriceCaches();
  const today = await getBenchmarkIndex(new Date());
  const old = await getBenchmarkIndex(new Date('2020-01-01T00:00:00Z'));
  check('a historical date is not served today\'s index', today !== old || old === null,
    `today=${today} old=${old}`);
}

main()
  .catch((e) => { console.error('FATAL', e); failed++; })
  .finally(async () => {
    console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
    await prisma.$disconnect();
    process.exit(failed === 0 ? 0 : 1);
  });
