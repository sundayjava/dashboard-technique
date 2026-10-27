import 'dotenv/config';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { PriceProvider, VaultAssetRole } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { createSessionToken } from '../src/lib/session';
import { POST as createPOST } from '../src/app/api/retirement-vault/create/route';
import { POST as depositPOST } from '../src/app/api/retirement-vault/deposit/route';
import { POST as investPOST } from '../src/app/api/retirement-vault/invest/route';
import { RISK_QUESTIONS } from '../src/lib/vault/risk-questionnaire';
import {
  accrueVaults,
  computeClassRates,
  getLatestClassRates,
  runDailyClassPerformance,
} from '../src/lib/vault/class-performance';
import { valueVault } from '../src/lib/vault/valuation';
import { DEFAULT_VAULT_POLICY } from '../src/lib/vault/allocation-model';
import { toUtcDateOnly } from '../src/lib/vault/price-providers';

/**
 * Daily class performance.
 *
 * The properties worth paying for in tests are the ones that cost real money
 * when they break: a day credited twice, a day credited on a market that never
 * traded, an admin typo compounding into every balance, and a rate that moves
 * after members have already seen it.
 */

let passed = 0, failed = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label} ${detail}`); }
}

const STAMP = Date.now();
const PIN = '1234';
const CLASS_KEY = `TESTPERF_${STAMP}`.slice(0, 40).toUpperCase();

let userId: string | null = null;
let vaultId = '';
let token = '';
const assetIds: string[] = [];

/** A day in the past, so nothing here can collide with a real nightly run. */
const DAY = toUtcDateOnly(new Date(Date.now() - 400 * 24 * 60 * 60 * 1000));
const QUIET_DAY = toUtcDateOnly(new Date(DAY.getTime() + 24 * 60 * 60 * 1000));

function req(path: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function boldAnswers() {
  return RISK_QUESTIONS.map((q) => {
    const s = [...q.options].sort((a, b) => a.score - b.score);
    return { questionId: q.id, optionValue: s[s.length - 1]!.value };
  });
}

async function main() {
  console.log('=== 0. Setup: an isolated class with three instruments ===');

  // A class of its own, so the test never credits or depends on a real one.
  await prisma.vaultAssetClassDef.create({
    data: {
      key: CLASS_KEY,
      name: 'Test Performance',
      displayOrder: 9000,
      isActive: true,
      isSystem: false,
      dailyUpliftPercent: 0,
    },
  });

  // The three moves from the specification: +0.21, -2.00, +1.00 -> -0.79.
  const spec = [
    { symbol: `TP1-${STAMP}`, change: 0.21 },
    { symbol: `TP2-${STAMP}`, change: -2.0 },
    { symbol: `TP3-${STAMP}`, change: 1.0 },
  ];

  for (const asset of spec) {
    const row = await prisma.vaultAsset.create({
      data: {
        symbol: asset.symbol,
        name: asset.symbol,
        assetClass: CLASS_KEY,
        role: VaultAssetRole.PORTFOLIO,
        provider: PriceProvider.COINGECKO,
        providerSymbol: asset.symbol.toLowerCase(),
        sleeveWeight: 1 / spec.length,
        currentPrice: 100,
        isActive: true,
      },
    });
    assetIds.push(row.id);

    await prisma.assetPriceSnapshot.create({
      data: {
        assetId: row.id,
        priceDate: DAY,
        close: 100,
        changePercent: asset.change,
        source: PriceProvider.COINGECKO,
      },
    });
  }

  const user = await prisma.user.create({
    data: {
      email: `vault-perf-${STAMP}@internal.test`, name: 'Perf Test', password: 'x',
      transactionPin: await bcrypt.hash(PIN, 10), phoneNumber: '0', countryCode: 'NG',
      currency: 'USD', authorizationCode: `VCP-${STAMP}`,
    },
  });
  userId = user.id;
  token = createSessionToken(user.id, user.email, 'USER');

  await prisma.account.create({
    data: {
      userId: user.id, accountNumber: `CP${STAMP}`.slice(0, 15), accountName: 'CP',
      currency: 'USD', balance: 20000, availableBalance: 20000,
    },
  });

  await createPOST(req('/api/retirement-vault/create', 'POST', {
    age: 35, countryOfResidence: 'Nigeria', horizon: 'YEARS_25_PLUS', vehicleType: 'PRIMARY',
    answers: boldAnswers(), allocationMode: 'DIVERSIFIED', initialDeposit: 10000,
    lockInPreference: 'SOFT_LOCK', signatureName: 'Perf Test', consentConfirmed: true,
  }));
  await depositPOST(req('/api/retirement-vault/deposit', 'POST', {
    amount: 10000, transactionPin: PIN,
  }));

  const vault = await prisma.retirementVault.findFirstOrThrow({ where: { userId: user.id } });
  vaultId = vault.id;

  // The vault must hold money in the test class, which means an allocation row
  // and a holding. Building them directly keeps the test independent of
  // whatever the profile matrix happens to say about a class invented a moment
  // ago.
  await prisma.vaultAllocation.create({
    data: { vaultId, assetClass: CLASS_KEY, targetPercent: 0 },
  });
  await prisma.vaultHolding.create({
    data: { vaultId, assetId: assetIds[0]!, units: 2, costBasis: 200 },
  });

  const opening = (await valueVault(vaultId))!;
  check('the class opens at its cost basis',
    Math.abs((opening.classValues[CLASS_KEY]?.value ?? 0) - 200) < 0.01,
    String(opening.classValues[CLASS_KEY]?.value));
  check('nothing credited yet', opening.accruedPerformance === 0,
    String(opening.accruedPerformance));

  console.log('\n=== 1. The rate is the sum of the moves, plus the uplift ===');
  const bare = await computeClassRates(DAY);
  const bareRate = bare.find((r) => r.assetClass === CLASS_KEY);
  check('the class has a rate', bareRate !== undefined);
  check('asset moves are SUMMED, not averaged',
    Math.abs((bareRate?.assetSumPercent ?? 0) - -0.79) < 1e-9,
    String(bareRate?.assetSumPercent));
  check('all three instruments counted', bareRate?.assetCount === 3,
    String(bareRate?.assetCount));
  check('no uplift set yet, so the rate is the market alone',
    Math.abs((bareRate?.totalPercent ?? 0) - -0.79) < 1e-9,
    String(bareRate?.totalPercent));

  // The specification's worked example: -0.79 + 5.79 = +5.00.
  await prisma.vaultAssetClassDef.update({
    where: { key: CLASS_KEY },
    data: { dailyUpliftPercent: 5.79 },
  });

  const withUplift = await computeClassRates(DAY);
  const rate = withUplift.find((r) => r.assetClass === CLASS_KEY)!;
  check('uplift is added to the summed moves',
    Math.abs(rate.totalPercent - 5.0) < 1e-9, String(rate.totalPercent));
  check('the workings are kept, not just the answer',
    rate.breakdown.length === 3 && rate.upliftPercent === 5.79,
    JSON.stringify(rate.breakdown));

  console.log('\n=== 2. A class earns on its own TRADING day, not the calendar day ===');
  // No snapshots exist for QUIET_DAY, but the class did trade the day before.
  // Equities close at 21:00 UTC and are stamped with the prior date, so
  // demanding a close dated today starved every class except crypto.
  const quiet = await computeClassRates(QUIET_DAY);
  const quietRate = quiet.find((r) => r.assetClass === CLASS_KEY);
  check('the class still has a rate the day after it traded',
    quietRate !== undefined, JSON.stringify(quiet.map((r) => r.assetClass)));
  check('and it is dated to the day it actually traded',
    quietRate?.performanceDate.getTime() === DAY.getTime(),
    String(quietRate?.performanceDate));
  check('with the same figures as that day',
    Math.abs((quietRate?.totalPercent ?? 0) - 5.0) < 1e-9,
    String(quietRate?.totalPercent));

  // Beyond the lookback window there is nothing to reach for, and a stale feed
  // must stop earning rather than be paid from forgotten data.
  const stale = await computeClassRates(
    toUtcDateOnly(new Date(DAY.getTime() + 60 * 24 * 60 * 60 * 1000)),
  );
  check('a class with no close in the window earns nothing',
    stale.find((r) => r.assetClass === CLASS_KEY) === undefined,
    JSON.stringify(stale.map((r) => r.assetClass)));

  console.log('\n=== 3. Crediting moves the allocated value by the rate ===');
  const first = await runDailyClassPerformance(DAY);
  check('one credit written', first.creditsWritten >= 1, String(first.creditsWritten));

  const afterOne = (await valueVault(vaultId))!;
  // 200 x 1.05 = 210, the figure from the specification.
  check('the class is worth 210 after a +5% day',
    Math.abs((afterOne.classValues[CLASS_KEY]?.value ?? 0) - 210) < 0.01,
    String(afterOne.classValues[CLASS_KEY]?.value));
  check('the credit shows as accrued performance',
    Math.abs(afterOne.accruedPerformance - 10) < 0.01,
    String(afterOne.accruedPerformance));
  check('the holding itself carries the gain',
    Math.abs((afterOne.holdings.find((h) => h.assetClass === CLASS_KEY)?.gainLoss ?? 0) - 10) < 0.01,
    JSON.stringify(afterOne.holdings.find((h) => h.assetClass === CLASS_KEY)));

  const ledger = await prisma.vaultClassAccrual.findFirstOrThrow({
    where: { vaultId, assetClass: CLASS_KEY, accrualDate: DAY },
  });
  check('the ledger explains the balance',
    Math.abs(ledger.openingValue - 200) < 0.01 &&
      Math.abs(ledger.amount - 10) < 0.01 &&
      Math.abs(ledger.closingValue - 210) < 0.01,
    JSON.stringify(ledger));

  console.log('\n=== 4. The same day is never credited twice ===');
  const second = await runDailyClassPerformance(DAY);
  check('a re-run writes no new credit', second.creditsWritten === 0,
    String(second.creditsWritten));
  check('and says it was already credited', second.alreadyCredited >= 1,
    String(second.alreadyCredited));

  const afterTwo = (await valueVault(vaultId))!;
  check('the balance did not move on the re-run',
    Math.abs((afterTwo.classValues[CLASS_KEY]?.value ?? 0) - 210) < 0.01,
    String(afterTwo.classValues[CLASS_KEY]?.value));

  const rows = await prisma.vaultClassAccrual.count({
    where: { vaultId, assetClass: CLASS_KEY, accrualDate: DAY },
  });
  check('exactly one ledger row for the day', rows === 1, String(rows));

  console.log('\n=== 4b. Running the next calendar day does not pay again ===');
  // The weekend case. On Saturday equities resolve to Friday, and Friday has
  // already been credited -- so a calendar-daily cron must not pay twice.
  const nextDay = await runDailyClassPerformance(QUIET_DAY);
  check('no new credit on the following calendar day',
    nextDay.creditsWritten === 0, String(nextDay.creditsWritten));
  const afterNextDay = (await valueVault(vaultId))!;
  check('the balance is untouched',
    Math.abs((afterNextDay.classValues[CLASS_KEY]?.value ?? 0) - 210) < 0.01,
    String(afterNextDay.classValues[CLASS_KEY]?.value));

  console.log('\n=== 5. A day already credited keeps its stored rate ===');
  // The admin moves the uplift AFTER the day was closed. Members have already
  // seen 5%, so the stored day must not change under them.
  await prisma.vaultAssetClassDef.update({
    where: { key: CLASS_KEY },
    data: { dailyUpliftPercent: 20 },
  });

  const stored = await prisma.vaultClassPerformanceDay.findFirstOrThrow({
    where: { assetClass: CLASS_KEY, performanceDate: DAY },
  });
  check('the stored rate is still 5%', Math.abs(stored.totalPercent - 5.0) < 1e-9,
    String(stored.totalPercent));
  check('and the uplift it was computed with is still 5.79',
    Math.abs(stored.upliftPercent - 5.79) < 1e-9, String(stored.upliftPercent));

  const latest = await getLatestClassRates(DAY);
  check('the member is served the stored figure',
    Math.abs((latest.rates.find((r) => r.assetClass === CLASS_KEY)?.totalPercent ?? 0) - 5) < 1e-9,
    JSON.stringify(latest.rates.find((r) => r.assetClass === CLASS_KEY)));

  console.log('\n=== 6. A mistyped uplift cannot run away with balances ===');
  const cap = DEFAULT_VAULT_POLICY.dailyRateCapPercent;
  await prisma.vaultAssetClassDef.update({
    where: { key: CLASS_KEY },
    data: { dailyUpliftPercent: 500 },
  });
  const clamped = (await computeClassRates(DAY))!.find((r) => r.assetClass === CLASS_KEY)!;
  check(`the rate is capped at ${cap}%`, Math.abs(clamped.totalPercent - cap) < 1e-9,
    String(clamped.totalPercent));
  check('and the cap is recorded, not silent', clamped.wasClamped === true);

  console.log('\n=== 7. A losing day reduces the allocated value ===');
  const LOSS_DAY = toUtcDateOnly(new Date(DAY.getTime() + 2 * 24 * 60 * 60 * 1000));
  for (const assetId of assetIds) {
    await prisma.assetPriceSnapshot.create({
      data: {
        assetId, priceDate: LOSS_DAY, close: 95, changePercent: -1,
        source: PriceProvider.COINGECKO,
      },
    });
  }
  await prisma.vaultAssetClassDef.update({
    where: { key: CLASS_KEY },
    data: { dailyUpliftPercent: 0 },
  });

  const loss = await runDailyClassPerformance(LOSS_DAY);
  const lossRate = loss.rates.find((r) => r.assetClass === CLASS_KEY)!;
  check('three instruments at -1% sum to -3%',
    Math.abs(lossRate.totalPercent - -3) < 1e-9, String(lossRate.totalPercent));

  const afterLoss = (await valueVault(vaultId))!;
  // 210 x 0.97 = 203.70
  check('the class fell to 203.70',
    Math.abs((afterLoss.classValues[CLASS_KEY]?.value ?? 0) - 203.7) < 0.01,
    String(afterLoss.classValues[CLASS_KEY]?.value));
  check('performance compounds on the credited value, not the principal',
    Math.abs(afterLoss.accruedPerformance - 3.7) < 0.01,
    String(afterLoss.accruedPerformance));

  console.log('\n=== 8. A class cannot be driven below zero ===');
  const WIPE_DAY = toUtcDateOnly(new Date(DAY.getTime() + 3 * 24 * 60 * 60 * 1000));
  for (const assetId of assetIds) {
    await prisma.assetPriceSnapshot.create({
      data: {
        assetId, priceDate: WIPE_DAY, close: 1, changePercent: -80,
        source: PriceProvider.COINGECKO,
      },
    });
  }
  // -240% raw, clamped to -cap by policy. Applied to the value, the floor in
  // accrueVaults is what guarantees a balance can reach zero but never a debt.
  await accrueVaults([
    {
      assetClass: CLASS_KEY,
      performanceDate: WIPE_DAY,
      assetSumPercent: -240,
      upliftPercent: 0,
      totalPercent: -150,
      wasClamped: true,
      assetCount: 3,
      breakdown: [],
    },
  ]);

  const afterWipe = (await valueVault(vaultId))!;
  check('the class floors at zero rather than going negative',
    (afterWipe.classValues[CLASS_KEY]?.value ?? -1) >= -0.01 &&
      (afterWipe.classValues[CLASS_KEY]?.value ?? -1) < 0.01,
    String(afterWipe.classValues[CLASS_KEY]?.value));

  console.log('\n=== 9. A class the member holds nothing in is not credited ===');
  const otherVaults = await prisma.vaultClassAccrual.count({
    where: { assetClass: CLASS_KEY, vaultId: { not: vaultId } },
  });
  check('no other vault was touched by the test class', otherVaults === 0,
    String(otherVaults));

  console.log('\n=== 10. Investing after a credit keeps the credit ===');
  const beforeInvest = (await valueVault(vaultId))!.accruedPerformance;
  await investPOST(req('/api/retirement-vault/invest', 'POST', { amount: 100 }));
  const afterInvest = (await valueVault(vaultId))!;
  check('credited performance survives a new investment',
    Math.abs(afterInvest.accruedPerformance - beforeInvest) < 0.01,
    `${beforeInvest} -> ${afterInvest.accruedPerformance}`);
}

async function cleanup() {
  console.log('\n=== Cleanup ===');
  if (vaultId !== '') {
    await prisma.vaultClassAccrual.deleteMany({ where: { vaultId } }).catch(() => undefined);
  }
  await prisma.vaultClassPerformanceDay
    .deleteMany({ where: { assetClass: CLASS_KEY } })
    .catch(() => undefined);

  if (userId !== null) {
    await prisma.retirementVault.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.transaction.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.notification.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.account.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  }

  // Snapshots cascade with the asset; the allocation rows do not, since they
  // carry no relation to the class.
  await prisma.vaultAllocation.deleteMany({ where: { assetClass: CLASS_KEY } })
    .catch(() => undefined);
  for (const assetId of assetIds) {
    await prisma.vaultAsset.delete({ where: { id: assetId } }).catch(() => undefined);
  }
  await prisma.vaultProfileAllocation.deleteMany({ where: { assetClass: CLASS_KEY } })
    .catch(() => undefined);
  await prisma.vaultAssetClassDef.delete({ where: { key: CLASS_KEY } }).catch(() => undefined);

  console.log(`  classes remaining: ${await prisma.vaultAssetClassDef.count()}`);
  console.log(`  vaults remaining:  ${await prisma.retirementVault.count()}`);
}

main()
  .catch((e) => { console.error('FATAL', e); failed++; })
  .finally(async () => {
    await cleanup();
    console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
    await prisma.$disconnect();
    process.exit(failed === 0 ? 0 : 1);
  });
