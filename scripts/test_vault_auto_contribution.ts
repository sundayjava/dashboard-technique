import 'dotenv/config';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { ContributionStatus, ContributionType } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { createSessionToken } from '../src/lib/session';
import { POST as createPOST } from '../src/app/api/retirement-vault/create/route';
import { POST as depositPOST } from '../src/app/api/retirement-vault/deposit/route';
import { PUT as acPUT, GET as acGET } from '../src/app/api/retirement-vault/auto-contribution/route';
import { RISK_QUESTIONS } from '../src/lib/vault/risk-questionnaire';
import { processAutoContributions } from '../src/lib/vault/auto-contribution';
import { valueVault } from '../src/lib/vault/valuation';

let passed = 0, failed = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label} ${detail}`); }
}

const STAMP = Date.now();
const PIN = '1234';
let userId: string | null = null, accountId = '', vaultId = '';
let token = '';

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
const balance = async () => (await prisma.account.findUniqueOrThrow({ where: { id: accountId } })).balance;

async function main() {
  console.log('=== 0. Setup: vault with a $500/month contribution on day 1 ===');
  const user = await prisma.user.create({
    data: {
      email: `vault-ac-${STAMP}@internal.test`, name: 'AutoContrib Test', password: 'x',
      transactionPin: await bcrypt.hash(PIN, 10), phoneNumber: '0', countryCode: 'NG',
      currency: 'USD', authorizationCode: `VAC-${STAMP}`,
    },
  });
  userId = user.id;
  token = createSessionToken(user.id, user.email, 'USER');
  const account = await prisma.account.create({
    data: {
      userId: user.id, accountNumber: `AC${STAMP}`.slice(0, 15), accountName: 'AC',
      currency: 'USD', balance: 12000, availableBalance: 12000,
    },
  });
  accountId = account.id;

  await createPOST(req('/api/retirement-vault/create', 'POST', {
    age: 35, countryOfResidence: 'Nigeria', horizon: 'YEARS_25_PLUS', vehicleType: 'PRIMARY',
    answers: boldAnswers(), allocationMode: 'DIVERSIFIED', initialDeposit: 10000,
    monthlyContribution: 500, monthlyContributionDay: 1,
    lockInPreference: 'SOFT_LOCK', signatureName: 'AutoContrib Test', consentConfirmed: true,
  }));
  await depositPOST(req('/api/retirement-vault/deposit', 'POST', { amount: 10000, transactionPin: PIN }));
  const vault = await prisma.retirementVault.findFirstOrThrow({ where: { userId: user.id } });
  vaultId = vault.id;
  check('monthly contribution stored from onboarding', vault.monthlyContribution === 500);
  console.log(`  vault ${vault.vaultNumber}, account balance $${await balance()}`);

  console.log('\n=== 1. First run charges it ===');
  const before = await balance();
  const run1 = await processAutoContributions();
  check('one contribution charged', run1.charged === 1, JSON.stringify(run1.outcomes));
  check('account debited $500', Math.abs(before - (await balance()) - 500) < 0.01, `now $${await balance()}`);
  const v1 = await valueVault(vaultId);
  check('vault value grew to ~$10,500', Math.abs((v1?.totalValue ?? 0) - 10500) < 2, `got ${v1?.totalValue}`);
  check('crypto still capped after auto-buy', (v1?.currentAllocation.CRYPTO ?? 0) <= 5.01);

  console.log('\n=== 2. Running again the same month does NOT double-charge ===');
  const afterFirst = await balance();
  const run2 = await processAutoContributions();
  check('second run skips', run2.charged === 0 && run2.skipped === 1, JSON.stringify(run2.outcomes));
  check('balance unchanged', Math.abs((await balance()) - afterFirst) < 0.01, `now $${await balance()}`);
  const run3 = await processAutoContributions();
  check('third run also skips (idempotent)', run3.charged === 0);
  const contribs = await prisma.vaultContribution.count({
    where: { vaultId, type: ContributionType.AUTO_MONTHLY },
  });
  check('exactly one auto contribution recorded', contribs === 1, `got ${contribs}`);

  console.log('\n=== 3. Next month charges again ===');
  // Age the contribution into last month so the guard no longer sees it.
  const lastMonth = new Date();
  lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
  await prisma.vaultContribution.updateMany({
    where: { vaultId, type: ContributionType.AUTO_MONTHLY },
    data: { createdAt: lastMonth },
  });
  const beforeMonth2 = await balance();
  const run4 = await processAutoContributions();
  check('new month charges again', run4.charged === 1, JSON.stringify(run4.outcomes));
  check('account debited another $500', Math.abs(beforeMonth2 - (await balance()) - 500) < 0.01);

  console.log('\n=== 4. Insufficient balance fails gracefully and retries ===');
  await prisma.vaultContribution.updateMany({
    where: { vaultId, type: ContributionType.AUTO_MONTHLY },
    data: { createdAt: lastMonth },
  });
  await prisma.account.update({ where: { id: accountId }, data: { balance: 100, availableBalance: 100 } });

  const poor = await processAutoContributions();
  check('charge fails on low balance', poor.failed === 1, JSON.stringify(poor.outcomes));
  check('balance untouched by a failed charge', Math.abs((await balance()) - 100) < 0.01);
  const failRow = await prisma.vaultContribution.findFirstOrThrow({
    where: { vaultId, type: ContributionType.AUTO_MONTHLY },
    orderBy: { createdAt: 'desc' },
  });
  check('failure recorded with a reason', failRow.status === ContributionStatus.FAILED && (failRow.failureReason ?? '').includes('below'));
  console.log(`  "${failRow.failureReason}"`);

  const poor2 = await processAutoContributions();
  check('retrying still fails, no crash', poor2.failed === 1);
  const failCount = await prisma.vaultContribution.count({
    where: { vaultId, type: ContributionType.AUTO_MONTHLY, status: ContributionStatus.FAILED },
  });
  check('only ONE failure row per month, not one per retry', failCount === 1, `got ${failCount}`);

  console.log('\n=== 5. Topping up mid-month lets the retry succeed ===');
  await prisma.account.update({ where: { id: accountId }, data: { balance: 5000, availableBalance: 5000 } });
  const recovered = await processAutoContributions();
  check('retry succeeds once funded', recovered.charged === 1, JSON.stringify(recovered.outcomes));
  const recoveredRow = await prisma.vaultContribution.findFirstOrThrow({
    where: { vaultId, type: ContributionType.AUTO_MONTHLY },
    orderBy: { createdAt: 'desc' },
  });
  check('the failed row became COMPLETED, not a duplicate', recoveredRow.status === ContributionStatus.COMPLETED);
  // Three charge cycles have run by now: month 1, month 2, and this month's
  // fail-then-recover. The point of this check is that the recovery REUSED
  // the failed row rather than adding a fourth.
  const totalRows = await prisma.vaultContribution.count({
    where: { vaultId, type: ContributionType.AUTO_MONTHLY },
  });
  check('one row per charge cycle, retry reused its row', totalRows === 3, `got ${totalRows}`);
  const completedRows = await prisma.vaultContribution.count({
    where: { vaultId, type: ContributionType.AUTO_MONTHLY, status: ContributionStatus.COMPLETED },
  });
  check('all three cycles ended COMPLETED', completedRows === 3, `got ${completedRows}`);

  console.log('\n=== 6. Day-of-month gating ===');
  await prisma.vaultContribution.updateMany({
    where: { vaultId, type: ContributionType.AUTO_MONTHLY },
    data: { createdAt: lastMonth },
  });
  await prisma.retirementVault.update({ where: { id: vaultId }, data: { monthlyContributionDay: 28 } });
  const today = new Date().getUTCDate();
  const gated = await processAutoContributions();
  if (today < 28) {
    check('not charged before the due day', gated.charged === 0 && gated.skipped === 1, JSON.stringify(gated.outcomes));
    console.log(`  today is day ${today}, due day 28 — correctly skipped`);
  } else {
    check('charged on/after the due day', gated.charged === 1);
    console.log(`  today is day ${today}, due day 28 — correctly charged`);
  }

  console.log('\n=== 7. Member can change and stop it ===');
  await prisma.retirementVault.update({ where: { id: vaultId }, data: { monthlyContributionDay: 1 } });

  const change = await acPUT(req('/api/retirement-vault/auto-contribution', 'PUT', { enabled: true, amount: 750, dayOfMonth: 15 }));
  check('amount updated', change.status === 200, `got ${change.status}`);
  const changed = await prisma.retirementVault.findUniqueOrThrow({ where: { id: vaultId } });
  check('stored as $750 on day 15', changed.monthlyContribution === 750 && changed.monthlyContributionDay === 15);

  const badDay = await acPUT(req('/api/retirement-vault/auto-contribution', 'PUT', { enabled: true, amount: 500, dayOfMonth: 31 }));
  check('day 31 refused (would skip February)', badDay.status === 400, `got ${badDay.status}`);

  const stop = await acPUT(req('/api/retirement-vault/auto-contribution', 'PUT', { enabled: false }));
  check('contribution stopped', stop.status === 200);
  const stopped = await prisma.retirementVault.findUniqueOrThrow({ where: { id: vaultId } });
  check('cleared from the vault', stopped.monthlyContribution === null);

  const afterStop = await processAutoContributions();
  check('stopped vault is no longer considered', afterStop.considered === 0, `considered ${afterStop.considered}`);

  const getRes = await acGET(req('/api/retirement-vault/auto-contribution', 'GET'));
  const getBody = await getRes.json();
  check('GET reports it disabled', getBody.enabled === false);
  check('history still returned', Array.isArray(getBody.history) && getBody.history.length >= 2, `got ${getBody.history?.length}`);
}

async function cleanup() {
  console.log('\n=== Cleanup ===');
  if (userId) {
    await prisma.retirementVault.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.transaction.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.notification.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.account.deleteMany({ where: { userId } }).catch(() => undefined);
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
