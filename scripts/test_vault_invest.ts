import 'dotenv/config';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { createSessionToken } from '../src/lib/session';
import { POST as createPOST } from '../src/app/api/retirement-vault/create/route';
import { POST as depositPOST } from '../src/app/api/retirement-vault/deposit/route';
import { GET as investGET, POST as investPOST } from '../src/app/api/retirement-vault/invest/route';
import { RISK_QUESTIONS } from '../src/lib/vault/risk-questionnaire';
import { valueVault } from '../src/lib/vault/valuation';
import { throwawayPassword } from './fixtures';

let passed = 0, failed = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label} ${detail}`); }
}

const STAMP = Date.now();
const PIN = '1234';
let userId: string | null = null, vaultId = '';
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
const cash = async () =>
  (await prisma.retirementVault.findUniqueOrThrow({ where: { id: vaultId } })).cashBalance;

async function main() {
  console.log('=== 0. Setup ===');
  const user = await prisma.user.create({
    data: {
      email: `vault-inv-${STAMP}@internal.test`, name: 'Invest Test', password: throwawayPassword(),
      transactionPin: await bcrypt.hash(PIN, 10), phoneNumber: '0', countryCode: 'NG',
      currency: 'USD', authorizationCode: `VIN-${STAMP}`,
    },
  });
  userId = user.id;
  token = createSessionToken(user.id, user.email, 'USER');
  await prisma.account.create({
    data: {
      userId: user.id, accountNumber: `IN${STAMP}`.slice(0, 15), accountName: 'IN',
      currency: 'USD', balance: 30000, availableBalance: 30000,
    },
  });
  await createPOST(req('/api/retirement-vault/create', 'POST', {
    age: 35, countryOfResidence: 'Nigeria', horizon: 'YEARS_25_PLUS', vehicleType: 'PRIMARY',
    answers: boldAnswers(), allocationMode: 'DIVERSIFIED', initialDeposit: 10000,
    lockInPreference: 'SOFT_LOCK', signatureName: 'Invest Test', consentConfirmed: true,
  }));
  const vault = await prisma.retirementVault.findFirstOrThrow({ where: { userId: user.id } });
  vaultId = vault.id;

  console.log('\n=== 1. A deposit is now HELD AS CASH, not auto-invested ===');
  const dep = await depositPOST(req('/api/retirement-vault/deposit', 'POST', {
    amount: 10000, transactionPin: PIN,
  }));
  const depBody = await dep.json();
  check('deposit succeeds', dep.status === 200, JSON.stringify(depBody).slice(0, 150));
  check('vault activated', depBody.activated === true);
  check('the whole $10,000 is uninvested cash', Math.abs((await cash()) - 10000) < 0.01,
    `got ${await cash()}`);
  const holdings = await prisma.vaultHolding.count({ where: { vaultId } });
  check('nothing was bought automatically', holdings === 0, `got ${holdings} holdings`);

  console.log('\n=== 2. Capacity reports a ceiling per class ===');
  const capRes = await investGET(req('/api/retirement-vault/invest', 'GET'));
  const cap = await capRes.json();
  check('investable cash is $10,000', Math.abs(cap.investableCash - 10000) < 0.01);
  const crypto = cap.classes.find((c: {assetClass:string}) => c.assetClass === 'CRYPTO');
  const equities = cap.classes.find((c: {assetClass:string}) => c.assetClass === 'GLOBAL_EQUITIES');
  check('crypto ceiling is 5% = $500', Math.abs(crypto.headroom - 500) < 0.01, `got ${crypto.headroom}`);
  check('equities ceiling is 40% = $4,000', Math.abs(equities.headroom - 4000) < 0.01,
    `got ${equities.headroom}`);
  console.log('  headroom:', cap.classes.filter((c:{headroom:number})=>c.headroom>0)
    .map((c:{assetClass:string;headroom:number;targetPercent:number}) =>
      `${c.assetClass}=$${c.headroom.toFixed(0)} (${c.targetPercent}%)`).join('  '));

  console.log('\n=== 3. Over the ceiling is REFUSED ===');
  const tooMuchCrypto = await investPOST(req('/api/retirement-vault/invest', 'POST', {
    allocations: [{ assetClass: 'CRYPTO', amount: 3000 }],
  }));
  const tmBody = await tooMuchCrypto.json();
  check('$3,000 into a $500 crypto ceiling -> 400', tooMuchCrypto.status === 400,
    `got ${tooMuchCrypto.status}`);
  check('error names the cap', String(tmBody.error).includes('5%'), tmBody.error);
  console.log(`  "${tmBody.error}"`);
  check('cash untouched by the refusal', Math.abs((await cash()) - 10000) < 0.01);

  console.log('\n=== 4. Member directs their own investment ===');
  const manual = await investPOST(req('/api/retirement-vault/invest', 'POST', {
    allocations: [
      { assetClass: 'GLOBAL_EQUITIES', amount: 4000 },
      { assetClass: 'CRYPTO', amount: 500 },
      { assetClass: 'COMMODITIES', amount: 1500 },
    ],
  }));
  const manBody = await manual.json();
  check('manual investment succeeds', manual.status === 200, JSON.stringify(manBody).slice(0, 200));
  check('invested $6,000', Math.abs(manBody.invested - 6000) < 0.01, `got ${manBody.invested}`);
  check('cash reduced to $4,000', Math.abs((await cash()) - 4000) < 0.01, `got ${await cash()}`);

  const v1 = await valueVault(vaultId);
  check('vault still worth $10,000 (cash became holdings)',
    Math.abs((v1?.totalValue ?? 0) - 10000) < 1, `got ${v1?.totalValue}`);
  const cryptoValue = (v1?.holdings ?? []).filter(h => h.assetClass === 'CRYPTO')
    .reduce((s, h) => s + h.value, 0);
  check('crypto is exactly at its 5% ceiling', Math.abs(cryptoValue - 500) < 1,
    `got ${cryptoValue.toFixed(2)}`);

  console.log('\n=== 5. Ceiling accounts for what is ALREADY held ===');
  const cap2Res = await investGET(req('/api/retirement-vault/invest', 'GET'));
  const cap2 = await cap2Res.json();
  const crypto2 = cap2.classes.find((c: {assetClass:string}) => c.assetClass === 'CRYPTO');
  check('crypto headroom now 0', crypto2.headroom < 0.02, `got ${crypto2.headroom}`);
  check('crypto flagged at cap', crypto2.atCap === true);

  const topUp = await investPOST(req('/api/retirement-vault/invest', 'POST', {
    allocations: [{ assetClass: 'CRYPTO', amount: 100 }],
  }));
  check('cannot add more crypto once at the cap', topUp.status === 400, `got ${topUp.status}`);

  console.log('\n=== 6. Cannot invest more cash than is available ===');
  const overCash = await investPOST(req('/api/retirement-vault/invest', 'POST', {
    allocations: [{ assetClass: 'FIXED_INCOME', amount: 9000 }],
  }));
  const ocBody = await overCash.json();
  check('over available cash -> 400', overCash.status === 400, `got ${overCash.status}`);
  check('error mentions uninvested cash', String(ocBody.error).includes('uninvested'), ocBody.error);

  console.log('\n=== 7. A partially invalid request invests NOTHING ===');
  const cashBefore = await cash();
  const mixed = await investPOST(req('/api/retirement-vault/invest', 'POST', {
    allocations: [
      { assetClass: 'FIXED_INCOME', amount: 500 },   // valid
      { assetClass: 'CRYPTO', amount: 400 },          // over the ceiling
    ],
  }));
  check('mixed request refused', mixed.status === 400, `got ${mixed.status}`);
  check('the valid line was NOT partially filled',
    Math.abs((await cash()) - cashBefore) < 0.01, `cash moved to ${await cash()}`);

  console.log('\n=== 8. Expert Allocator: one total, split automatically ===');
  await prisma.retirementVault.update({
    where: { id: vaultId },
    data: { allocationMode: 'EXPERT_ALLOCATOR', expertAllocatorActive: true },
  });
  const cashNow = await cash();
  const auto = await investPOST(req('/api/retirement-vault/invest', 'POST', {
    amount: cashNow,
  }));
  const autoBody = await auto.json();
  check('auto investment succeeds', auto.status === 200, JSON.stringify(autoBody).slice(0, 200));
  check('reported as auto mode', autoBody.mode === 'auto');
  // Equities, crypto and commodities were already filled to their ceilings,
  // so the remaining cash belongs in the classes still under target. Expecting
  // a spread across ALL classes would be expecting the cap to be breached.
  check('placed only into classes with headroom', (autoBody.lines?.length ?? 0) > 0,
    `got ${autoBody.lines?.length} lines`);
  const autoClasses = new Set((autoBody.lines ?? []).map((l: {assetClass:string}) => l.assetClass));
  check('did not top up a class already at its ceiling',
    !autoClasses.has('CRYPTO') && !autoClasses.has('GLOBAL_EQUITIES'),
    [...autoClasses].join(', '));
  console.log('  split:', (autoBody.lines ?? []).map((l:{symbol:string;amount:number}) =>
    `${l.symbol} $${l.amount}`).join(', '));
  check('cash now near zero', (await cash()) < 1, `got ${await cash()}`);

  const v2 = await valueVault(vaultId);
  check('vault still worth ~$10,000', Math.abs((v2?.totalValue ?? 0) - 10000) < 2,
    `got ${v2?.totalValue}`);
  const cryptoPct = v2?.currentAllocation.CRYPTO ?? 0;
  check('crypto still within 5% after the auto split', cryptoPct <= 5.05,
    `got ${cryptoPct.toFixed(2)}%`);

  // The point of investing toward target: the vault should now BE on target.
  const target = await prisma.vaultAllocation.findMany({ where: { vaultId } });
  let onTarget = true;
  for (const row of target) {
    const actual = v2?.currentAllocation[row.assetClass] ?? 0;
    if (Math.abs(actual - row.targetPercent) > 0.5) onTarget = false;
  }
  check('the vault now sits on its target allocation', onTarget,
    Object.entries(v2?.currentAllocation ?? {}).map(([k, x]) => `${k}=${x.toFixed(1)}`).join(' '));
  console.log('  final:', Object.entries(v2?.currentAllocation ?? {})
    .filter(([, x]) => x > 0).map(([k, x]) => `${k}=${x.toFixed(1)}%`).join('  '));

  console.log('\n=== 9. Nothing to invest is refused cleanly ===');
  const empty = await investPOST(req('/api/retirement-vault/invest', 'POST', { amount: 500 }));
  check('investing more than the remaining cash -> 400', empty.status === 400, `got ${empty.status}`);

  const noLines = await investPOST(req('/api/retirement-vault/invest', 'POST', {
    allocations: [],
  }));
  check('an empty allocation list -> 400', noLines.status === 400, `got ${noLines.status}`);
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
}

main()
  .catch((e) => { console.error('FATAL', e); failed++; })
  .finally(async () => {
    await cleanup();
    console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
    await prisma.$disconnect();
    process.exit(failed === 0 ? 0 : 1);
  });
