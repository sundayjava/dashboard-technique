import 'dotenv/config';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { LockInPreference, RetirementHorizon, VaultWithdrawalStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { createSessionToken } from '../src/lib/session';
import { POST as createPOST } from '../src/app/api/retirement-vault/create/route';
import { POST as depositPOST } from '../src/app/api/retirement-vault/deposit/route';
import { POST as investPOST } from '../src/app/api/retirement-vault/invest/route';
import {
  GET as wGET, POST as wPOST, DELETE as wDELETE,
} from '../src/app/api/retirement-vault/withdraw/route';
import { PUT as adminPUT, GET as adminGET } from '../src/app/api/admin/vault-withdrawals/route';
import { RISK_QUESTIONS } from '../src/lib/vault/risk-questionnaire';
import { quoteWithdrawal, serveElapsedNotices } from '../src/lib/vault/withdrawal-engine';
import { loadVaultPolicy } from '../src/lib/vault/policy-store';
import { valueVault } from '../src/lib/vault/valuation';

let passed = 0, failed = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label} ${detail}`); }
}

const STAMP = Date.now();
const PIN = '1234';
let userId: string | null = null, adminId: string | null = null;
let token = '', adminToken = '';

function req(path: string, method: string, body?: unknown, admin = false) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${admin ? adminToken : token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function boldAnswers() {
  return RISK_QUESTIONS.map((q) => {
    const sorted = [...q.options].sort((a, b) => a.score - b.score);
    return { questionId: q.id, optionValue: sorted[sorted.length - 1]!.value };
  });
}

async function main() {
  console.log('=== 0. Setup: funded vault ===');
  const user = await prisma.user.create({
    data: {
      email: `vault-wd-test-${STAMP}@internal.test`, name: 'Vault WD Test',
      password: 'x', transactionPin: await bcrypt.hash(PIN, 10),
      phoneNumber: '0', countryCode: 'NG', currency: 'USD', authorizationCode: `VWD-${STAMP}`,
    },
  });
  userId = user.id;
  token = createSessionToken(user.id, user.email, 'USER');

  const admin = await prisma.user.create({
    data: {
      email: `vault-wd-admin-${STAMP}@internal.test`, name: 'WD Admin', role: 'ADMIN',
      password: 'x', transactionPin: await bcrypt.hash(PIN, 10),
      phoneNumber: '0', countryCode: 'NG', currency: 'USD', authorizationCode: `VWA-${STAMP}`,
    },
  });
  adminId = admin.id;
  adminToken = createSessionToken(admin.id, admin.email, 'ADMIN');

  const account = await prisma.account.create({
    data: {
      userId: user.id, accountNumber: `WD${STAMP}`.slice(0, 15), accountName: 'WD Test',
      currency: 'USD', balance: 20000, availableBalance: 20000,
    },
  });

  await createPOST(req('/api/retirement-vault/create', 'POST', {
    age: 40, countryOfResidence: 'Nigeria', horizon: 'YEARS_25_PLUS', vehicleType: 'PRIMARY',
    answers: boldAnswers(), allocationMode: 'DIVERSIFIED', initialDeposit: 10000,
    lockInPreference: 'SOFT_LOCK', signatureName: 'Vault WD Test', consentConfirmed: true,
  }));
  await depositPOST(req('/api/retirement-vault/deposit', 'POST', { amount: 10000, transactionPin: PIN }));
  // A deposit is cash now, so invest it before testing that a withdrawal
  // sells holdings proportionally.
  await investPOST(req('/api/retirement-vault/invest', 'POST', { amount: 10000 }));
  const vault = await prisma.retirementVault.findFirstOrThrow({ where: { userId: user.id } });
  console.log(`  vault ${vault.vaultNumber} funded $10,000 (SOFT_LOCK, 25+yr horizon)`);

  console.log('\n=== 1. Quote shows the cost before committing ===');
  const policy = await loadVaultPolicy();
  const q = quoteWithdrawal({
    amount: 2000, horizon: RetirementHorizon.YEARS_25_PLUS, activatedAt: vault.activatedAt,
    lockInPreference: LockInPreference.SOFT_LOCK, policy,
  });
  check('withdrawal 25 years early is flagged early', q.isEarly);
  check('soft-lock penalty is 5%', q.penaltyPercent === 5, `got ${q.penaltyPercent}`);
  check('penalty is $100 on $2,000', Math.abs(q.penaltyAmount - 100) < 0.01, `got ${q.penaltyAmount}`);
  check('net is $1,900', Math.abs(q.netAmount - 1900) < 0.01, `got ${q.netAmount}`);
  check('14-day notice', q.noticePeriodDays === 14, `got ${q.noticePeriodDays}`);
  console.log(`  "${q.explanation}"`);

  const matured = quoteWithdrawal({
    amount: 2000, horizon: RetirementHorizon.YEARS_10,
    activatedAt: new Date(Date.now() - 11 * 365 * 24 * 60 * 60 * 1000),
    lockInPreference: LockInPreference.SOFT_LOCK, policy,
  });
  check('at maturity there is no penalty', matured.penaltyPercent === 0 && matured.penaltyAmount === 0);
  check('and it is not flagged early', !matured.isEarly);

  const flexible = quoteWithdrawal({
    amount: 2000, horizon: RetirementHorizon.YEARS_25_PLUS, activatedAt: vault.activatedAt,
    lockInPreference: LockInPreference.FLEXIBLE, policy,
  });
  check('flexible penalty is lower than soft lock', flexible.penaltyPercent === 2, `got ${flexible.penaltyPercent}`);

  console.log('\n=== 2. Request validation ===');
  const badPin = await wPOST(req('/api/retirement-vault/withdraw', 'POST', { amount: 1000, transactionPin: '0000' }));
  check('wrong PIN -> 401', badPin.status === 401, `got ${badPin.status}`);

  const tooMuch = await wPOST(req('/api/retirement-vault/withdraw', 'POST', { amount: 99999, transactionPin: PIN }));
  check('more than the vault holds -> 400', tooMuch.status === 400, `got ${tooMuch.status}`);

  console.log('\n=== 3. Request a withdrawal (nothing is sold yet) ===');
  const valueBefore = (await valueVault(vault.id))!.totalValue;
  const reqRes = await wPOST(req('/api/retirement-vault/withdraw', 'POST', { amount: 2000, transactionPin: PIN }));
  const reqBody = await reqRes.json();
  check('request accepted', reqRes.status === 200, JSON.stringify(reqBody).slice(0, 150));
  check('status is PENDING_NOTICE', reqBody.request?.status === 'PENDING_NOTICE');
  check('penalty stored as $100', Math.abs(reqBody.request?.penaltyAmount - 100) < 0.01);

  const valueAfter = (await valueVault(vault.id))!.totalValue;
  check('vault value UNCHANGED during notice', Math.abs(valueAfter - valueBefore) < 0.01, `${valueBefore} -> ${valueAfter}`);
  const acct1 = await prisma.account.findUnique({ where: { id: account.id } });
  check('account not yet credited', acct1?.balance === 10000, `got ${acct1?.balance}`);

  console.log('\n=== 4. Committed amount blocks over-withdrawal ===');
  const second = await wPOST(req('/api/retirement-vault/withdraw', 'POST', { amount: 9000, transactionPin: PIN }));
  const secondBody = await second.json();
  check('second request exceeding remainder refused', second.status === 400, `got ${second.status}`);
  check('error names the committed amount', String(secondBody.error).includes('committed'), secondBody.error);
  console.log(`  "${secondBody.error}"`);

  console.log('\n=== 5. Admin cannot pay during notice ===');
  const earlyPay = await adminPUT(req('/api/admin/vault-withdrawals', 'PUT', { id: reqBody.request.id, action: 'pay' }, true));
  check('paying during notice -> 400', earlyPay.status === 400, `got ${earlyPay.status}`);

  console.log('\n=== 6. Notice elapses ===');
  await prisma.vaultWithdrawalRequest.update({
    where: { id: reqBody.request.id },
    data: { noticeEndsAt: new Date(Date.now() - 1000) },
  });
  const served = await serveElapsedNotices();
  check('notice served by the cron job', served >= 1, `got ${served}`);
  const afterServe = await prisma.vaultWithdrawalRequest.findUniqueOrThrow({ where: { id: reqBody.request.id } });
  check('status now NOTICE_SERVED', afterServe.status === VaultWithdrawalStatus.NOTICE_SERVED, afterServe.status);

  console.log('\n=== 7. Admin pays it ===');
  const payRes = await adminPUT(req('/api/admin/vault-withdrawals', 'PUT', { id: reqBody.request.id, action: 'pay' }, true));
  const pay = await payRes.json();
  check('payment succeeds', payRes.status === 200, JSON.stringify(pay).slice(0, 200));
  check('net $1,900 paid, not $2,000', Math.abs(pay.netPaid - 1900) < 0.01, `got ${pay.netPaid}`);
  check('penalty $100 retained', Math.abs(pay.penaltyRetained - 100) < 0.01, `got ${pay.penaltyRetained}`);
  check('account credited to $11,900', Math.abs(pay.accountBalanceAfter - 11900) < 0.01, `got ${pay.accountBalanceAfter}`);
  console.log('  units sold:', (pay.unitsSold ?? []).map((u: {symbol:string;proceeds:number}) => `${u.symbol} $${u.proceeds}`).join(', '));

  console.log('\n=== 8. Allocation preserved by proportional selling ===');
  const after = await valueVault(vault.id);
  check('vault now ~$8,000', Math.abs((after?.totalValue ?? 0) - 8000) < 2, `got ${after?.totalValue}`);
  const alloc = after!.currentAllocation;
  check('equities still 40%', Math.abs(alloc.GLOBAL_EQUITIES - 40) < 0.5, `got ${alloc.GLOBAL_EQUITIES.toFixed(2)}`);
  check('crypto still 5%', Math.abs(alloc.CRYPTO - 5) < 0.5, `got ${alloc.CRYPTO.toFixed(2)}`);
  console.log('  allocation after sale:', Object.entries(alloc).filter(([,v]) => v > 0).map(([k,v]) => `${k}=${v.toFixed(1)}%`).join(' '));

  const txn = await prisma.transaction.findFirst({ where: { userId: user.id, reference: pay.reference } });
  check('withdrawal transaction recorded', txn !== null);
  check('penalty recorded as the fee', Math.abs((txn?.fee ?? 0) - 100) < 0.01, `got ${txn?.fee}`);

  const vaultAfter = await prisma.retirementVault.findUniqueOrThrow({ where: { id: vault.id } });
  check('totalWithdrawn is the gross $2,000', Math.abs(vaultAfter.totalWithdrawn - 2000) < 0.01, `got ${vaultAfter.totalWithdrawn}`);

  console.log('\n=== 9. Cancellation ===');
  const cancelReq = await wPOST(req('/api/retirement-vault/withdraw', 'POST', { amount: 1000, transactionPin: PIN }));
  const cancelBody = await cancelReq.json();
  check('new request created', cancelReq.status === 200);
  const delRes = await wDELETE(req(`/api/retirement-vault/withdraw?id=${cancelBody.request.id}`, 'DELETE'));
  check('cancellation succeeds', delRes.status === 200, `got ${delRes.status}`);
  const cancelled = await prisma.vaultWithdrawalRequest.findUniqueOrThrow({ where: { id: cancelBody.request.id } });
  check('status CANCELLED', cancelled.status === VaultWithdrawalStatus.CANCELLED);

  const recancel = await wDELETE(req(`/api/retirement-vault/withdraw?id=${cancelBody.request.id}`, 'DELETE'));
  check('cancelling twice refused', recancel.status === 400, `got ${recancel.status}`);

  const repay = await adminPUT(req('/api/admin/vault-withdrawals', 'PUT', { id: reqBody.request.id, action: 'pay' }, true));
  check('paying an already-paid request refused', repay.status === 400, `got ${repay.status}`);

  console.log('\n=== 10. Member list and admin queue ===');
  const listRes = await wGET(req('/api/retirement-vault/withdraw?quote=500', 'GET'));
  const list = await listRes.json();
  check('member sees their requests', Array.isArray(list.requests) && list.requests.length >= 2);
  check('quote returned inline', list.quote?.penaltyAmount === 25, `got ${list.quote?.penaltyAmount}`);
  check('available excludes paid/cancelled', list.availableToWithdraw > 7900, `got ${list.availableToWithdraw}`);

  const queueRes = await adminGET(req('/api/admin/vault-withdrawals', 'GET', undefined, true));
  const queue = await queueRes.json();
  check('admin sees the queue', Array.isArray(queue.requests) && queue.requests.length >= 2);

  const memberQueue = await adminGET(req('/api/admin/vault-withdrawals', 'GET'));
  check('non-admin blocked from the queue', memberQueue.status === 403, `got ${memberQueue.status}`);
}

async function cleanup() {
  console.log('\n=== Cleanup ===');
  for (const id of [userId, adminId]) {
    if (!id) continue;
    await prisma.retirementVault.deleteMany({ where: { userId: id } }).catch(() => undefined);
    await prisma.transaction.deleteMany({ where: { userId: id } }).catch(() => undefined);
    await prisma.notification.deleteMany({ where: { userId: id } }).catch(() => undefined);
    await prisma.account.deleteMany({ where: { userId: id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id } }).catch(() => undefined);
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
