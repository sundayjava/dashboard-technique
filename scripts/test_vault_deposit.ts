import 'dotenv/config';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { createSessionToken } from '../src/lib/session';
import { POST as createPOST } from '../src/app/api/retirement-vault/create/route';
import { POST as depositPOST } from '../src/app/api/retirement-vault/deposit/route';
import { RISK_QUESTIONS } from '../src/lib/vault/risk-questionnaire';
import { valueVault } from '../src/lib/vault/valuation';

let passed = 0, failed = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label} ${detail}`); }
}

const STAMP = Date.now();
const PIN = '1234';
let userId: string | null = null;
let token = '';

function req(path: string, body: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

function boldAnswers() {
  return RISK_QUESTIONS.map((q) => {
    const sorted = [...q.options].sort((a, b) => a.score - b.score);
    return { questionId: q.id, optionValue: sorted[sorted.length - 1]!.value };
  });
}

async function main() {
  console.log('=== 0. Setup: user with $20,000 in their account ===');
  const user = await prisma.user.create({
    data: {
      email: `vault-deposit-test-${STAMP}@internal.test`,
      name: 'Vault Deposit Test',
      password: 'not-a-real-login',
      transactionPin: await bcrypt.hash(PIN, 10),
      phoneNumber: '0000000000',
      countryCode: 'NG',
      currency: 'USD',
      authorizationCode: `VDT-${STAMP}`,
    },
  });
  userId = user.id;
  token = createSessionToken(user.id, user.email, 'USER');

  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountNumber: `TEST${STAMP}`.slice(0, 15),
      accountName: 'Vault Deposit Test',
      currency: 'USD',
      balance: 20000,
      availableBalance: 20000,
    },
  });
  console.log(`  account ${account.accountNumber} funded $20,000`);

  const createRes = await createPOST(req('/api/retirement-vault/create', {
    age: 35, countryOfResidence: 'Nigeria', horizon: 'YEARS_25_PLUS', vehicleType: 'PRIMARY',
    answers: boldAnswers(), allocationMode: 'DIVERSIFIED', initialDeposit: 10000,
    lockInPreference: 'SOFT_LOCK', signatureName: 'Vault Deposit Test', consentConfirmed: true,
  }));
  const createBody = await createRes.json();
  check('vault created', createRes.status === 200, JSON.stringify(createBody).slice(0, 150));
  check('starts PENDING_ACTIVATION', createBody.vault?.status === 'PENDING_ACTIVATION');
  console.log(`  vault ${createBody.vault?.vaultNumber} (${createBody.vault?.riskProfile})`);

  console.log('\n=== 1. Wrong PIN moves nothing ===');
  const badPin = await depositPOST(req('/api/retirement-vault/deposit', { amount: 10000, transactionPin: '9999' }));
  check('wrong PIN -> 401', badPin.status === 401, `got ${badPin.status}`);
  const afterBadPin = await prisma.account.findUnique({ where: { id: account.id } });
  check('balance untouched after bad PIN', afterBadPin?.balance === 20000, `got ${afterBadPin?.balance}`);

  console.log('\n=== 2. Overdraft is refused ===');
  const tooMuch = await depositPOST(req('/api/retirement-vault/deposit', { amount: 50000, transactionPin: PIN }));
  check('deposit above balance -> 400', tooMuch.status === 400, `got ${tooMuch.status}`);
  const afterOverdraft = await prisma.account.findUnique({ where: { id: account.id } });
  check('balance untouched after overdraft attempt', afterOverdraft?.balance === 20000);

  console.log('\n=== 3. Real deposit of $10,000 ===');
  const depRes = await depositPOST(req('/api/retirement-vault/deposit', { amount: 10000, transactionPin: PIN }));
  const dep = await depRes.json();
  check('deposit succeeds', depRes.status === 200, JSON.stringify(dep).slice(0, 200));
  check('vault activated', dep.activated === true);
  check('status now ACTIVE', dep.vault?.status === 'ACTIVE', dep.vault?.status);
  check('account debited to $10,000', dep.accountBalanceAfter === 10000, `got ${dep.accountBalanceAfter}`);

  console.log('  purchased:');
  for (const line of dep.allocation ?? []) {
    console.log(`    ${line.symbol.padEnd(5)} $${String(line.amount).padStart(8)}  ${line.units.toFixed(6)} units @ $${line.price}`);
  }
  console.log(`  residual cash: $${dep.residualCash}`);

  console.log('\n=== 4. Money is conserved ===');
  const allocSum = (dep.allocation ?? []).reduce((s: number, l: { amount: number }) => s + l.amount, 0);
  check('allocated + residual = deposit', Math.abs(allocSum + dep.residualCash - 10000) < 0.05, `got ${allocSum + dep.residualCash}`);

  const acct = await prisma.account.findUnique({ where: { id: account.id } });
  const vault = await prisma.retirementVault.findFirst({ where: { userId: user.id }, include: { holdings: true, contributions: true } });
  check('account balance is $10,000', acct?.balance === 10000, `got ${acct?.balance}`);
  check('availableBalance also debited', acct?.availableBalance === 10000, `got ${acct?.availableBalance}`);
  check('vault totalContributed $10,000', vault?.totalContributed === 10000, `got ${vault?.totalContributed}`);
  check('holdings created', (vault?.holdings.length ?? 0) === 9, `got ${vault?.holdings.length}`);

  const txn = await prisma.transaction.findFirst({ where: { userId: user.id, reference: dep.reference } });
  check('transaction record written', txn !== null);
  check('transaction balanceAfter correct', txn?.balanceAfter === 10000, `got ${txn?.balanceAfter}`);

  const contributions = vault?.contributions ?? [];
  check('exactly one contribution (initial settled, not duplicated)', contributions.length === 1, `got ${contributions.length}`);
  check('contribution COMPLETED', contributions[0]?.status === 'COMPLETED');
  check('contribution is the INITIAL one', contributions[0]?.type === 'INITIAL');

  console.log('\n=== 5. Vault values correctly from the purchase ===');
  const valuation = await valueVault(vault!.id);
  check('valuation complete', valuation?.complete === true);
  check('vault worth ~$10,000 immediately after buying', Math.abs((valuation?.totalValue ?? 0) - 10000) < 1, `got ${valuation?.totalValue}`);
  console.log(`  vault value $${valuation?.totalValue.toFixed(2)} (G/L ${valuation?.unrealisedGainLossPercent.toFixed(4)}%)`);
  const crypto = valuation?.currentAllocation.CRYPTO ?? 0;
  check('crypto within the 5% cap', crypto <= 5.01, `got ${crypto.toFixed(2)}`);
  console.log('  allocation:', Object.entries(valuation?.currentAllocation ?? {}).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v.toFixed(1)}%`).join(' '));

  console.log('\n=== 6. Second deposit tops up existing holdings ===');
  const dep2Res = await depositPOST(req('/api/retirement-vault/deposit', { amount: 5000, transactionPin: PIN }));
  const dep2 = await dep2Res.json();
  check('second deposit succeeds', dep2Res.status === 200, JSON.stringify(dep2).slice(0, 150));
  check('not re-activated', dep2.activated === false);

  const vault2 = await prisma.retirementVault.findFirst({ where: { userId: user.id }, include: { holdings: true, contributions: true } });
  check('still 9 holdings, not 18', vault2?.holdings.length === 9, `got ${vault2?.holdings.length}`);
  check('totalContributed now $15,000', vault2?.totalContributed === 15000, `got ${vault2?.totalContributed}`);
  check('second contribution recorded', vault2?.contributions.length === 2, `got ${vault2?.contributions.length}`);

  const val2 = await valueVault(vault!.id);
  check('vault now worth ~$15,000', Math.abs((val2?.totalValue ?? 0) - 15000) < 1.5, `got ${val2?.totalValue}`);
  console.log(`  vault value $${val2?.totalValue.toFixed(2)}, account $${(await prisma.account.findUnique({ where: { id: account.id } }))?.balance}`);

  const vt = await prisma.vaultHolding.findFirst({ where: { vaultId: vault!.id }, include: { asset: true }, orderBy: { asset: { displayOrder: 'asc' } } });
  check('cost basis accumulated across both deposits', (vt?.costBasis ?? 0) > 4000, `got ${vt?.costBasis}`);
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
