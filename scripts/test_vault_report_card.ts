import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {
  AllocationMode, ContributionStatus, ContributionType, LockInPreference,
  RetirementHorizon, RiskProfile, VaultStatus, VehicleType,
} from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { buildReportCard, generateReportCards, getQuarter } from '../src/lib/vault/report-card';
import { throwawayPassword } from './fixtures';

let passed = 0, failed = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label} ${detail}`); }
}

const STAMP = Date.now();
let userId: string | null = null, vaultId = '';

/** Write a valuation for a given day offset within the current quarter. */
async function valuation(dayOffset: number, total: number, benchmark: number, contributed: number) {
  const q = getQuarter(new Date());
  const d = new Date(q.start.getTime() + dayOffset * 24 * 60 * 60 * 1000);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  await prisma.vaultValuation.upsert({
    where: { vaultId_valuationDate: { vaultId, valuationDate: date } },
    create: {
      vaultId, valuationDate: date, totalValue: total, cashBalance: 0,
      contributedToDate: contributed, unrealisedGainLoss: total - contributed,
      benchmarkValue: benchmark,
    },
    update: { totalValue: total, benchmarkValue: benchmark, contributedToDate: contributed },
  });
  return date;
}

async function main() {
  console.log('=== 0. Setup ===');
  const user = await prisma.user.create({
    data: {
      email: `vault-rc-${STAMP}@internal.test`, name: 'ReportCard Test', password: throwawayPassword(),
      transactionPin: await bcrypt.hash('1234', 10), phoneNumber: '0', countryCode: 'NG',
      currency: 'USD', authorizationCode: `VRC-${STAMP}`,
    },
  });
  userId = user.id;
  const vault = await prisma.retirementVault.create({
    data: {
      userId: user.id, vaultNumber: `RV-RC-${STAMP}`, ageAtOnboarding: 40,
      countryOfResidence: 'NG', horizon: RetirementHorizon.YEARS_20,
      vehicleType: VehicleType.PRIMARY, riskProfile: RiskProfile.BALANCED,
      allocationMode: AllocationMode.DIVERSIFIED, initialDeposit: 10000,
      lockInPreference: LockInPreference.SOFT_LOCK, status: VaultStatus.ACTIVE,
      activatedAt: new Date(), totalContributed: 10000,
    },
  });
  vaultId = vault.id;
  const quarter = getQuarter(new Date());
  console.log(`  vault ${vault.vaultNumber}, quarter ${quarter.label}`);

  console.log('\n=== 1. A single valuation produces no card ===');
  await valuation(0, 10000, 10000, 10000);
  const single = await buildReportCard(vaultId, quarter);
  check('one data point yields no card', single === null);

  console.log('\n=== 2. Pure growth, no cashflow ===');
  await valuation(10, 11000, 10500, 10000);
  const growth = await buildReportCard(vaultId, quarter);
  check('card produced', growth !== null);
  check('return is 10% (10,000 -> 11,000)', Math.abs((growth?.returnPercent ?? 0) - 10) < 0.01,
    `got ${growth?.returnPercent?.toFixed(3)}`);
  check('benchmark return is 5%', Math.abs((growth?.benchmarkReturnPercent ?? 0) - 5) < 0.01,
    `got ${growth?.benchmarkReturnPercent?.toFixed(3)}`);
  check('outperformance is 5 points', Math.abs((growth?.outperformancePercent ?? 0) - 5) < 0.01,
    `got ${growth?.outperformancePercent?.toFixed(3)}`);
  console.log(`  "${growth?.summary}"`);

  console.log('\n=== 3. A contribution must NOT look like a return ===');
  // Vault goes 10,000 -> 15,000 but 5,000 of that was deposited. A naive
  // (close-open)/open would report +50%. The true investment return is 0%.
  await prisma.vaultValuation.deleteMany({ where: { vaultId } });
  await valuation(0, 10000, 10000, 10000);
  await valuation(20, 15000, 15000, 15000);
  await prisma.vaultContribution.create({
    data: {
      vaultId, type: ContributionType.MANUAL, amount: 5000,
      status: ContributionStatus.COMPLETED,
      processedAt: new Date(quarter.start.getTime() + 10 * 24 * 60 * 60 * 1000),
    },
  });

  const flat = await buildReportCard(vaultId, quarter);
  const naive = ((15000 - 10000) / 10000) * 100;
  console.log(`  naive (close-open)/open would report ${naive.toFixed(1)}%`);
  console.log(`  time-weighted reports ${flat?.returnPercent.toFixed(2)}%`);
  check('deposit is excluded from the return', Math.abs(flat?.returnPercent ?? 99) < 0.01,
    `got ${flat?.returnPercent?.toFixed(3)}`);
  check('contribution is reported separately', flat?.contributionsInPeriod === 5000);
  check('summary explains the exclusion', (flat?.summary ?? '').includes('excluded'));

  console.log('\n=== 4. Genuine growth on top of a contribution ===');
  await prisma.vaultValuation.deleteMany({ where: { vaultId } });
  await valuation(0, 10000, 10000, 10000);
  await valuation(20, 16250, 15000, 15000);
  const mixed = await buildReportCard(vaultId, quarter);
  // Gain = 16,250 - 10,000 - 5,000 = 1,250 on average capital 12,500 = 10%.
  check('return is 10% on average capital, not 62.5%',
    Math.abs((mixed?.returnPercent ?? 0) - 10) < 0.01, `got ${mixed?.returnPercent?.toFixed(3)}`);

  console.log('\n=== 5. Losses report honestly ===');
  await prisma.vaultContribution.deleteMany({ where: { vaultId } });
  await prisma.vaultValuation.deleteMany({ where: { vaultId } });
  await valuation(0, 10000, 10000, 10000);
  await valuation(15, 9000, 9500, 10000);
  const loss = await buildReportCard(vaultId, quarter);
  check('negative return reported', (loss?.returnPercent ?? 0) < 0, `got ${loss?.returnPercent}`);
  check('loss is -10%', Math.abs((loss?.returnPercent ?? 0) + 10) < 0.01, `got ${loss?.returnPercent}`);
  check('summary uses "fell", not "returned"', (loss?.summary ?? '').includes('fell'));
  check('benchmark also behind, correctly compared',
    (loss?.outperformancePercent ?? 1) < 0, `got ${loss?.outperformancePercent}`);
  console.log(`  "${loss?.summary}"`);

  console.log('\n=== 6. Thin data is flagged as indicative ===');
  check('fewer than 30 days is caveated', (loss?.summary ?? '').includes('indicative'));

  console.log('\n=== 7. Generation is idempotent ===');
  const n1 = await generateReportCards(vaultId);
  const count1 = await prisma.vaultReportCard.count({ where: { vaultId } });
  await generateReportCards(vaultId);
  const count2 = await prisma.vaultReportCard.count({ where: { vaultId } });
  check('cards generated', n1 >= 1, `got ${n1}`);
  check('re-running does not duplicate', count1 === count2 && count2 >= 1, `${count1} -> ${count2}`);

  const stored = await prisma.vaultReportCard.findFirstOrThrow({ where: { vaultId } });
  check('stored card carries its summary', stored.summary.length > 40);
  check('stored under the right quarter', stored.quarterLabel === quarter.label, stored.quarterLabel);
}

async function cleanup() {
  console.log('\n=== Cleanup ===');
  if (userId) {
    await prisma.retirementVault.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  }
  console.log(`  vaults remaining: ${await prisma.retirementVault.count()}`);
}

main()
  .catch((e) => { console.error('FATAL', e); failed++; })
  .finally(async () => {
    await cleanup();
    console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
    await prisma.$disconnect();
    process.exit(failed === 0 ? 0 : 1);
  });
