import 'dotenv/config';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { createSessionToken } from '../src/lib/session';
import {
  GET as classGET, POST as classPOST, PUT as classPUT, DELETE as classDELETE,
} from '../src/app/api/admin/vault-asset-classes/route';
import { invalidateAssetClassCache, getAssetClassKeys } from '../src/lib/vault/asset-class-store';
import { invalidatePolicyCache, loadVaultPolicy } from '../src/lib/vault/policy-store';
import { throwawayPassword } from './fixtures';

let passed = 0, failed = 0;
const check = (l: string, ok: boolean, d = '') =>
  ok ? (passed++, console.log(`  PASS  ${l}`)) : (failed++, console.log(`  FAIL  ${l} ${d}`));

const STAMP = Date.now();
let adminId: string | null = null, memberId: string | null = null;
let adminToken = '', memberToken = '';
const TEST_KEY = `PRIVATE_CREDIT_${STAMP}`.slice(0, 40);

function req(path: string, method: string, body?: unknown, token = adminToken) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function main() {
  const admin = await prisma.user.create({ data: {
    email: `ac-admin-${STAMP}@internal.test`, name: 'AC Admin', role: 'ADMIN', password: throwawayPassword(),
    transactionPin: await bcrypt.hash('1234', 10), phoneNumber: '0', countryCode: 'NG',
    currency: 'USD', authorizationCode: `ACA-${STAMP}` } });
  adminId = admin.id;
  adminToken = createSessionToken(admin.id, admin.email, 'ADMIN');

  const member = await prisma.user.create({ data: {
    email: `ac-member-${STAMP}@internal.test`, name: 'AC Member', password: throwawayPassword(),
    transactionPin: await bcrypt.hash('1234', 10), phoneNumber: '0', countryCode: 'NG',
    currency: 'USD', authorizationCode: `ACM-${STAMP}` } });
  memberId = member.id;
  memberToken = createSessionToken(member.id, member.email, 'USER');

  console.log('=== 1. Admin only ===');
  const asMember = await classGET(req('/api/admin/vault-asset-classes', 'GET', undefined, memberToken));
  check('member blocked -> 403', asMember.status === 403, `got ${asMember.status}`);

  console.log('\n=== 2. The matrix loads ===');
  const res = await classGET(req('/api/admin/vault-asset-classes', 'GET'));
  const body = await res.json();
  check('six classes present', body.rows?.length === 6, `got ${body.rows?.length}`);
  check('three profiles', body.profiles?.length === 3);
  check('every profile totals 100%',
    body.profiles.every((p: string) => Math.abs(body.totals[p] - 100) < 0.01),
    JSON.stringify(body.totals));
  check('usage is reported', body.rows.some((r: {assetCount:number}) => r.assetCount > 0));

  console.log('\n=== 3. A class in use cannot be removed ===');
  const inUse = body.rows.find((r: {assetCount:number}) => r.assetCount > 0);
  check('blockers explain why', inUse.removalBlockers.length > 0, JSON.stringify(inUse.removalBlockers));
  console.log(`  "${inUse.removalBlockers[0]}"`);
  const refused = await classDELETE(req(`/api/admin/vault-asset-classes?key=${inUse.key}`, 'DELETE'));
  check('delete refused -> 400', refused.status === 400, `got ${refused.status}`);
  const stillThere = await prisma.vaultAssetClassDef.count({ where: { key: inUse.key } });
  check('the class survives the attempt', stillThere === 1);

  console.log('\n=== 4. Adding a class ===');
  const created = await classPOST(req('/api/admin/vault-asset-classes', 'POST', {
    key: TEST_KEY, name: 'Private Credit', description: 'Direct lending.' }));
  check('class created', created.status === 200, JSON.stringify(await created.clone().json()));

  invalidateAssetClassCache();
  check('it appears in the live class list', (await getAssetClassKeys()).includes(TEST_KEY));

  const after = await (await classGET(req('/api/admin/vault-asset-classes', 'GET'))).json();
  const row = after.rows.find((r: {key:string}) => r.key === TEST_KEY);
  check('starts at 0% in every profile',
    after.profiles.every((p: string) => row.targets[p] === 0), JSON.stringify(row.targets));
  check('existing totals are untouched',
    after.profiles.every((p: string) => Math.abs(after.totals[p] - 100) < 0.01),
    JSON.stringify(after.totals));

  const dupe = await classPOST(req('/api/admin/vault-asset-classes', 'POST', {
    key: TEST_KEY, name: 'Private Credit Again' }));
  check('duplicate key refused', dupe.status === 400, `got ${dupe.status}`);

  console.log('\n=== 5. Percentages must still total 100 ===');
  const badAlloc = Object.fromEntries(after.rows.map((r: {key:string}) => [r.key, 20]));
  const bad = await classPUT(req('/api/admin/vault-asset-classes', 'PUT', {
    riskProfile: 'BALANCED', allocation: badAlloc }));
  check('a profile totalling 140% is refused', bad.status === 400, `got ${bad.status}`);

  console.log('\n=== 6. Giving the new class a real weight ===');
  // Take 5 points off equities and give them to the new class.
  const good: Record<string, number> = {};
  for (const r of after.rows) good[r.key] = r.targets.BALANCED;
  good.GLOBAL_EQUITIES = good.GLOBAL_EQUITIES - 5;
  good[TEST_KEY] = 5;
  const okRes = await classPUT(req('/api/admin/vault-asset-classes', 'PUT', {
    riskProfile: 'BALANCED', allocation: good }));
  check('valid reweight accepted', okRes.status === 200, JSON.stringify(await okRes.clone().json()));

  invalidatePolicyCache();
  const policy = await loadVaultPolicy();
  check('policy serves the new weight', policy.targetAllocations.BALANCED[TEST_KEY] === 5,
    String(policy.targetAllocations.BALANCED[TEST_KEY]));
  check('equities reduced to 30', policy.targetAllocations.BALANCED.GLOBAL_EQUITIES === 30,
    String(policy.targetAllocations.BALANCED.GLOBAL_EQUITIES));

  console.log('\n=== 7. The crypto cap still binds ===');
  const cryptoHeavy: Record<string, number> = {};
  for (const r of after.rows) cryptoHeavy[r.key] = 0;
  cryptoHeavy.CRYPTO = 50;
  cryptoHeavy.GLOBAL_EQUITIES = 50;
  const capped = await classPUT(req('/api/admin/vault-asset-classes', 'PUT', {
    riskProfile: 'BALANCED', allocation: cryptoHeavy }));
  check('50% crypto refused', capped.status === 400, `got ${capped.status}`);

  console.log('\n=== 8. An unused class can be removed ===');
  const removed = await classDELETE(req(`/api/admin/vault-asset-classes?key=${TEST_KEY}`, 'DELETE'));
  check('removal succeeds', removed.status === 200, JSON.stringify(await removed.clone().json()));
  check('the row is gone', (await prisma.vaultAssetClassDef.count({ where: { key: TEST_KEY } })) === 0);
  check('its profile allocations cascaded away',
    (await prisma.vaultProfileAllocation.count({ where: { assetClass: TEST_KEY } })) === 0);
}

async function cleanup() {
  console.log('\n=== Cleanup ===');
  await prisma.vaultAssetClassDef.deleteMany({ where: { key: TEST_KEY } }).catch(() => undefined);
  await prisma.vaultProfileAllocation.deleteMany({ where: { assetClass: TEST_KEY } }).catch(() => undefined);
  // Put BALANCED back exactly as shipped.
  const restore: Record<string, number> = {
    GLOBAL_EQUITIES: 35, FIXED_INCOME: 25, COMMODITIES: 20,
    REAL_ESTATE: 10, FUTURES_MACRO: 5, CRYPTO: 5,
  };
  for (const [assetClass, targetPercent] of Object.entries(restore)) {
    await prisma.vaultProfileAllocation.updateMany({
      where: { riskProfile: 'BALANCED', assetClass }, data: { targetPercent },
    }).catch(() => undefined);
  }
  invalidatePolicyCache();
  invalidateAssetClassCache();
  for (const id of [adminId, memberId]) {
    if (id) await prisma.user.delete({ where: { id } }).catch(() => undefined);
  }
  const p = await loadVaultPolicy();
  console.log(`  BALANCED restored: equities ${p.targetAllocations.BALANCED.GLOBAL_EQUITIES}%, classes ${(await getAssetClassKeys()).length}`);
}

main()
  .catch((e) => { console.error('FATAL', e); failed++; })
  .finally(async () => {
    await cleanup();
    console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
    await prisma.$disconnect();
    process.exit(failed === 0 ? 0 : 1);
  });
