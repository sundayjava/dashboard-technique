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
  check('index is rebased near 100 on day one', index !== null && Math.abs(index - 100) < 0.01, `got ${index}`);
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

  console.log('\n=== 7. Incomplete valuations are refused ===');
  // Before any price history existed, nothing can be priced.
  const ancient = new Date('2020-01-01T00:00:00Z');
  const ancientResult = await recordVaultValuation(vault.id, ancient);
  check('refuses to record when prices are missing', !ancientResult.recorded);
  check('reports which symbols were missing', (ancientResult.reason ?? '').includes('Missing prices'), ancientResult.reason ?? '');
  const ancientRows = await prisma.vaultValuation.count({
    where: { vaultId: vault.id, valuationDate: ancient },
  });
  check('no row written for the refused valuation', ancientRows === 0);
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
