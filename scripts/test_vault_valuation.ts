import 'dotenv/config';
import {
  AllocationMode,
  ContributionStatus,
  ContributionType,
  LockInPreference,
  RetirementHorizon,
  RiskProfile,
  VaultStatus,
  VehicleType,
} from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import {
  getBenchmarkIndex,
  getPricesAsOf,
  recordVaultValuation,
  resetBenchmarkBaseCache,
  valueVault,
} from '../src/lib/vault/valuation';
import { sumAllocation } from '../src/lib/vault/allocation-model';
import { BENCHMARK_BLEND } from '../src/lib/vault/asset-registry';

/**
 * Valuation harness.
 *
 * Creates a throwaway user and vault, exercises the valuation paths against
 * real stored prices, then deletes everything it made. Existing accounts are
 * never touched.
 */

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label} ${detail}`);
  }
}

const STAMP = Date.now();
let testUserId: string | null = null;
let testVaultId: string | null = null;

async function main() {
  resetBenchmarkBaseCache();

  console.log('=== 0. Setup: throwaway user + vault ===');
  const user = await prisma.user.create({
    data: {
      email: `vault-valuation-test-${STAMP}@internal.test`,
      name: 'Vault Valuation Test',
      password: 'not-a-real-login',
      transactionPin: '0000',
      phoneNumber: '0000000000',
      countryCode: 'NG',
      currency: 'USD',
      authorizationCode: `VVT-${STAMP}`,
    },
  });
  testUserId = user.id;
  console.log(`  created test user ${user.email}`);

  const vault = await prisma.retirementVault.create({
    data: {
      userId: user.id,
      vaultNumber: `RV-TEST-${STAMP}`,
      ageAtOnboarding: 35,
      countryOfResidence: 'NG',
      horizon: RetirementHorizon.YEARS_25_PLUS,
      vehicleType: VehicleType.PRIMARY,
      riskProfile: RiskProfile.BALANCED,
      allocationMode: AllocationMode.DIVERSIFIED,
      initialDeposit: 10000,
      lockInPreference: LockInPreference.SOFT_LOCK,
      status: VaultStatus.ACTIVE,
      activatedAt: new Date(),
      cashBalance: 500,
      totalContributed: 10000,
    },
  });
  testVaultId = vault.id;
  console.log(`  created test vault ${vault.vaultNumber}`);

  // Buy units with 9,500 of the 10,000, leaving 500 as cash, roughly on the
  // Balanced targets.
  const prices = await getPricesAsOf(new Date());
  check('prices available for valuation', prices.size > 0, `got ${prices.size}`);

  const assets = await prisma.vaultAsset.findMany({
    where: { isActive: true, role: { not: 'BENCHMARK' } },
  });

  const targets: Record<string, number> = {
    VT: 3325, BND: 2375, GLD: 1140, SLV: 760, VNQ: 950, DBC: 475,
    BTC: 237.5, ETH: 142.5, XRP: 95,
  };

  let expectedHoldingsValue = 0;
  for (const asset of assets) {
    const spend = targets[asset.symbol];
    const price = prices.get(asset.id);
    if (spend === undefined || price === undefined) continue;
    const units = spend / price.close;
    await prisma.vaultHolding.create({
      data: {
        vaultId: vault.id,
        assetId: asset.id,
        units,
        costBasis: spend,
        averageCost: price.close,
      },
    });
    expectedHoldingsValue += units * price.close;
  }
  console.log(`  bought units across ${Object.keys(targets).length} assets`);

  await prisma.vaultContribution.create({
    data: {
      vaultId: vault.id,
      type: ContributionType.INITIAL,
      amount: 10000,
      status: ContributionStatus.COMPLETED,
      processedAt: new Date(),
      allocatedAt: new Date(),
    },
  });

  console.log('\n=== 1. Valuation arithmetic ===');
  const valuation = await valueVault(vault.id);
  if (valuation === null) throw new Error('valueVault returned null');

  check('valuation is complete', valuation.complete, valuation.missingPrices.join(', '));
  check(
    'holdings value = sum(units x price)',
    Math.abs(valuation.holdingsValue - expectedHoldingsValue) < 0.01,
    `${valuation.holdingsValue} vs ${expectedHoldingsValue}`,
  );
  check(
    'total = holdings + cash',
    Math.abs(valuation.totalValue - (valuation.holdingsValue + 500)) < 0.01,
    `${valuation.totalValue}`,
  );
  console.log(
    `  holdings $${valuation.holdingsValue.toFixed(2)} + cash $${valuation.cashBalance.toFixed(2)} ` +
      `= $${valuation.totalValue.toFixed(2)}  (G/L ${valuation.unrealisedGainLossPercent.toFixed(2)}%)`,
  );

  console.log('\n=== 2. Allocation by class ===');
  const allocTotal = sumAllocation(valuation.currentAllocation);
  check('current allocation totals 100%', Math.abs(allocTotal - 100) < 0.01, `got ${allocTotal}`);
  for (const [cls, pct] of Object.entries(valuation.currentAllocation)) {
    if (pct > 0) console.log(`  ${cls.padEnd(16)} ${pct.toFixed(2)}%`);
  }
  const crypto = valuation.currentAllocation.CRYPTO;
  check('crypto sits at ~5% as bought', crypto > 4.5 && crypto < 5.5, `got ${crypto.toFixed(2)}`);

  console.log('\n=== 3. Per-holding detail ===');
  for (const h of valuation.holdings) {
    console.log(
      `  ${h.symbol.padEnd(5)} ${h.units.toFixed(6).padStart(14)} units @ $${h.price.toFixed(2).padStart(9)} ` +
        `= $${h.value.toFixed(2).padStart(9)}  (${h.priceDate.toISOString().slice(0, 10)})`,
    );
  }
  check('every holding priced', valuation.holdings.length === Object.keys(targets).length);

  console.log('\n=== 4. Forward fill ===');
  const future = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
  const futureValuation = await valueVault(vault.id, future);
  check('values 4 days ahead using the last known close', futureValuation?.complete === true);
  check(
    'forward-filled price date precedes the valuation date',
    (futureValuation?.holdings[0]?.priceDate.getTime() ?? 0) < future.getTime(),
  );
  check(
    'forward-filled value matches today',
    Math.abs((futureValuation?.totalValue ?? 0) - valuation.totalValue) < 0.01,
  );

  console.log('\n=== 5. Benchmark index ===');
  const index = await getBenchmarkIndex();
  console.log(`  benchmark index today: ${index === null ? 'null' : index.toFixed(4)}`);
  check('benchmark index computes', index !== null);
  // Was: "rebased near 100 on day one". That only held while the database
  // contained a single day of prices, so it went permanently red the moment a
  // second day synced -- it was asserting the fixture, not the behaviour.
  //
  // The real invariant is the one the engine exists to get right: the index
  // weights each leg's RETURN since the base date, not its share price. A
  // 60/40 split of raw share counts would put a $765 ETF and a $71 one at
  // 94/6 by value, and this recomputes the blend from the snapshots to catch
  // exactly that.
  const benchRows = await prisma.$queryRaw<Array<{ symbol: string; d: Date; close: number }>>`
    SELECT a."symbol" AS symbol, s."priceDate" AS d, s."close" AS close
    FROM asset_price_snapshots s
    JOIN vault_assets a ON a."id" = s."assetId"
    ORDER BY s."priceDate" ASC
  `;

  const bySymbol = new Map<string, Array<{ d: Date; close: number }>>();
  for (const row of benchRows) {
    const list = bySymbol.get(row.symbol) ?? [];
    list.push({ d: row.d, close: Number(row.close) });
    bySymbol.set(row.symbol, list);
  }

  // The base is the first date on which EVERY leg has a close.
  const legDates = BENCHMARK_BLEND.map(
    (leg) => new Set((bySymbol.get(leg.symbol) ?? []).map((r) => r.d.toISOString().slice(0, 10))),
  );
  const baseDay = [...(legDates[0] ?? [])]
    .sort()
    .find((day) => legDates.every((set) => set.has(day)));

  if (baseDay === undefined) {
    check('benchmark base exists', false, 'no date has a close for every leg');
  } else {
    let expected = 0;
    let usable = true;
    for (const leg of BENCHMARK_BLEND) {
      const series = bySymbol.get(leg.symbol) ?? [];
      const base = series.find((r) => r.d.toISOString().slice(0, 10) === baseDay);
      const latest = series[series.length - 1];
      if (base === undefined || latest === undefined || base.close <= 0) {
        usable = false;
        break;
      }
      expected += leg.weight * (latest.close / base.close);
    }
    expected *= 100;

    check(
      'index is the weighted blend of each leg\'s return since the base date',
      usable && index !== null && Math.abs(index - expected) < 0.01,
      `got ${index}, expected ${expected.toFixed(4)} (base ${baseDay})`,
    );
  }
  check('benchmark value computed for the vault', valuation.benchmarkValue !== null);
  if (valuation.benchmarkValue !== null) {
    console.log(`  401k comparator: $${valuation.benchmarkValue.toFixed(2)} vs vault $${valuation.totalValue.toFixed(2)}`);
  }

  console.log('\n=== 6. Recording is idempotent ===');
  const first = await recordVaultValuation(vault.id);
  check('first record succeeds', first.recorded, first.reason ?? '');
  const countAfterFirst = await prisma.vaultValuation.count({ where: { vaultId: vault.id } });

  const second = await recordVaultValuation(vault.id);
  check('second record succeeds', second.recorded, second.reason ?? '');
  const countAfterSecond = await prisma.vaultValuation.count({ where: { vaultId: vault.id } });

  check(
    'same day does not duplicate',
    countAfterFirst === countAfterSecond && countAfterSecond === 1,
    `${countAfterFirst} -> ${countAfterSecond}`,
  );

  console.log('\n=== 7. A missing price no longer blocks the record ===');
  // This section asserted the opposite until the value basis changed. When a
  // vault was worth units x price, an absent price understated it and
  // refusing was right. A vault is now worth principal plus credited
  // performance, so the stored figures are correct regardless -- and refusing
  // would leave a hole that can never be filled, because book value cannot be
  // rebuilt from price history.
  const ancient = new Date('2020-01-01T00:00:00Z');
  const ancientResult = await recordVaultValuation(vault.id, ancient);
  check('records the day even with no prices at all', ancientResult.recorded,
    ancientResult.reason ?? '');
  check('and says which symbols were missing',
    (ancientResult.reason ?? '').includes('no price for'), ancientResult.reason ?? '');
  const ancientRows = await prisma.vaultValuation.count({
    where: { vaultId: vault.id, valuationDate: ancient },
  });
  check('a row was written', ancientRows === 1, `got ${ancientRows}`);
  const ancientRow = await prisma.vaultValuation.findFirstOrThrow({
    where: { vaultId: vault.id, valuationDate: ancient },
  });
  check('the balance is the book value, not zero',
    ancientRow.totalValue > 0, `got ${ancientRow.totalValue}`);
  check('the benchmark is null, since that one DOES need prices',
    ancientRow.benchmarkValue === null, String(ancientRow.benchmarkValue));
  console.log(`  "${ancientResult.reason}"`);
}

async function cleanup() {
  console.log('\n=== Cleanup ===');
  if (testVaultId !== null) {
    await prisma.retirementVault.delete({ where: { id: testVaultId } }).catch(() => undefined);
    console.log('  deleted test vault (cascades holdings, contributions, valuations)');
  }
  if (testUserId !== null) {
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => undefined);
    console.log('  deleted test user');
  }
  const leftover = await prisma.retirementVault.count();
  console.log(`  retirement_vaults remaining: ${leftover}`);
}

main()
  .catch((e) => {
    console.error('FATAL', e);
    failed += 1;
  })
  .finally(async () => {
    await cleanup();
    console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
    await prisma.$disconnect();
    process.exit(failed === 0 ? 0 : 1);
  });
