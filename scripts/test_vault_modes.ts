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
const check = (l: string, ok: boolean, d = '') =>
  ok ? (passed++, console.log(`  PASS  ${l}`)) : (failed++, console.log(`  FAIL  ${l} ${d}`));

const PIN = '1234';
const made: string[] = [];

function req(path: string, token: string, body?: unknown, method = 'POST') {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const answers = () => RISK_QUESTIONS.map((q) => {
  const s = [...q.options].sort((a, b) => a.score - b.score);
  return { questionId: q.id, optionValue: s[s.length - 1]!.value };
});

async function member(tag: string, mode: string, focus?: string) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const user = await prisma.user.create({ data: {
    email: `modes-${tag}-${stamp}@internal.test`, name: `Modes ${tag}`, password: throwawayPassword(),
    transactionPin: await bcrypt.hash(PIN, 10), phoneNumber: '0', countryCode: 'NG',
    currency: 'USD', authorizationCode: `MD-${tag}-${stamp}` } });
  made.push(user.id);
  const token = createSessionToken(user.id, user.email, 'USER');
  await prisma.account.create({ data: { userId: user.id, accountNumber: `MD${stamp}`.slice(0, 15),
    accountName: 'MD', currency: 'USD', balance: 30000, availableBalance: 30000 } });
  await createPOST(req('/api/retirement-vault/create', token, {
    age: 35, countryOfResidence: 'Nigeria', horizon: 'YEARS_25_PLUS', vehicleType: 'PRIMARY',
    answers: answers(), allocationMode: mode, focusedAssetClass: focus ?? null,
    initialDeposit: 10000, lockInPreference: 'SOFT_LOCK',
    signatureName: `Modes ${tag}`, consentConfirmed: true }));
  await depositPOST(req('/api/retirement-vault/deposit', token, { amount: 10000, transactionPin: PIN }));
  const vault = await prisma.retirementVault.findFirstOrThrow({ where: { userId: user.id } });
  return { token, vault };
}

async function main() {
  console.log('=== 1. DIVERSIFIED: many classes, each capped ===');
  {
    const { token, vault } = await member('div', 'DIVERSIFIED');
    const cap = await (await investGET(req('/api/retirement-vault/invest', token, undefined, 'GET'))).json();
    const investable = cap.classes.filter((c: {investable:boolean}) => c.investable);
    check('every targeted class is investable', investable.length === 6, `got ${investable.length}`);

    const multi = await investPOST(req('/api/retirement-vault/invest', token, { allocations: [
      { assetClass: 'GLOBAL_EQUITIES', amount: 2000 },
      { assetClass: 'CRYPTO', amount: 500 },
    ] }));
    check('can fund two classes at once', multi.status === 200, `got ${multi.status}`);

    const over = await investPOST(req('/api/retirement-vault/invest', token, {
      allocations: [{ assetClass: 'CRYPTO', amount: 400 }] }));
    check('refused once that class is at its ceiling', over.status === 400, `got ${over.status}`);

    const after = await prisma.retirementVault.findUniqueOrThrow({ where: { id: vault.id } });
    check('leftover stays as cash', after.cashBalance > 7000, `got ${after.cashBalance}`);
  }

  console.log('\n=== 2. FOCUSED: one class only, at its own percentage ===');
  {
    const { token, vault } = await member('foc', 'FOCUSED', 'REAL_ESTATE');
    const cap = await (await investGET(req('/api/retirement-vault/invest', token, undefined, 'GET'))).json();
    const investable = cap.classes.filter((c: {investable:boolean}) => c.investable);
    check('exactly one class is investable', investable.length === 1, `got ${investable.length}`);
    check('it is the chosen one', investable[0]?.assetClass === 'REAL_ESTATE', investable[0]?.assetClass);

    const re = cap.classes.find((c: {assetClass:string}) => c.assetClass === 'REAL_ESTATE');
    check('capped at its own 15%, not concentrated',
      Math.abs(re.headroom - 1500) < 0.01, `got ${re.headroom}`);
    const eq = cap.classes.find((c: {assetClass:string}) => c.assetClass === 'GLOBAL_EQUITIES');
    check('other classes report zero headroom', eq.headroom === 0, `got ${eq.headroom}`);

    const wrong = await investPOST(req('/api/retirement-vault/invest', token, {
      allocations: [{ assetClass: 'GLOBAL_EQUITIES', amount: 1000 }] }));
    const wrongBody = await wrong.json();
    check('funding another class is refused', wrong.status === 400, `got ${wrong.status}`);
    check('the error explains why', String(wrongBody.error).includes('focused'), wrongBody.error);

    const both = await investPOST(req('/api/retirement-vault/invest', token, { allocations: [
      { assetClass: 'REAL_ESTATE', amount: 500 },
      { assetClass: 'COMMODITIES', amount: 500 },
    ] }));
    check('cannot sneak a second class into one request', both.status === 400, `got ${both.status}`);

    const ok = await investPOST(req('/api/retirement-vault/invest', token, {
      allocations: [{ assetClass: 'REAL_ESTATE', amount: 1500 }] }));
    check('the focused class funds normally', ok.status === 200, `got ${ok.status}`);

    const after = await prisma.retirementVault.findUniqueOrThrow({ where: { id: vault.id } });
    check('the rest of the vault stays as cash', Math.abs(after.cashBalance - 8500) < 1,
      `got ${after.cashBalance}`);
  }

  console.log('\n=== 3. EXPERT: deposits invest themselves ===');
  {
    const { token, vault } = await member('exp', 'EXPERT_ALLOCATOR');
    const after = await prisma.retirementVault.findUniqueOrThrow({ where: { id: vault.id } });
    check('the activating deposit was invested on arrival', after.cashBalance < 1,
      `cash ${after.cashBalance}`);

    const v = await valueVault(vault.id);
    check('vault still worth what was paid in', Math.abs((v?.totalValue ?? 0) - 10000) < 2,
      `got ${v?.totalValue}`);
    const classes = Object.entries(v?.currentAllocation ?? {}).filter(([, p]) => p > 0);
    check('spread across every class', classes.length === 6, `got ${classes.length}`);
    check('crypto still within its cap', (v?.currentAllocation.CRYPTO ?? 0) <= 5.05,
      `got ${v?.currentAllocation.CRYPTO}`);

    const dep = await depositPOST(req('/api/retirement-vault/deposit', token,
      { amount: 5000, transactionPin: PIN }));
    const depBody = await dep.json();
    check('a later deposit is also invested automatically',
      (depBody.autoInvested ?? 0) > 4900, `autoInvested ${depBody.autoInvested}`);
    check('nothing left waiting', (depBody.awaitingInvestment ?? 999) < 1,
      `awaiting ${depBody.awaitingInvestment}`);

    const v2 = await valueVault(vault.id);
    check('vault now ~$15,000', Math.abs((v2?.totalValue ?? 0) - 15000) < 3, `got ${v2?.totalValue}`);
    console.log('  final:', Object.entries(v2?.currentAllocation ?? {})
      .filter(([, p]) => p > 0).map(([k, p]) => `${k}=${p.toFixed(1)}%`).join('  '));
  }
}

main()
  .catch((e) => { console.error('FATAL', e); failed++; })
  .finally(async () => {
    for (const id of made) {
      await prisma.retirementVault.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.transaction.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.notification.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.account.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.user.delete({ where: { id } }).catch(() => undefined);
    }
    console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
    await prisma.$disconnect();
    process.exit(failed === 0 ? 0 : 1);
  });
