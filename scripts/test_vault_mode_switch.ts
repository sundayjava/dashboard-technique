import 'dotenv/config';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { createSessionToken } from '../src/lib/session';
import { POST as createPOST } from '../src/app/api/retirement-vault/create/route';
import { POST as depositPOST } from '../src/app/api/retirement-vault/deposit/route';
import { GET as modeGET, PUT as modePUT } from '../src/app/api/retirement-vault/allocation-mode/route';
import { PUT as rebalPUT } from '../src/app/api/retirement-vault/rebalances/route';
import { RISK_QUESTIONS } from '../src/lib/vault/risk-questionnaire';
import { valueVault } from '../src/lib/vault/valuation';

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

async function main() {
  console.log('=== 0. Setup: funded DIVERSIFIED vault ===');
  const user = await prisma.user.create({
    data: {
      email: `vault-mode-${STAMP}@internal.test`, name: 'Mode Test', password: 'x',
      transactionPin: await bcrypt.hash(PIN, 10), phoneNumber: '0', countryCode: 'NG',
      currency: 'USD', authorizationCode: `VMS-${STAMP}`,
    },
  });
  userId = user.id;
  token = createSessionToken(user.id, user.email, 'USER');
  await prisma.account.create({
    data: {
      userId: user.id, accountNumber: `MS${STAMP}`.slice(0, 15), accountName: 'MS',
      currency: 'USD', balance: 20000, availableBalance: 20000,
    },
  });
  await createPOST(req('/api/retirement-vault/create', 'POST', {
    age: 35, countryOfResidence: 'Nigeria', horizon: 'YEARS_25_PLUS', vehicleType: 'PRIMARY',
    answers: boldAnswers(), allocationMode: 'DIVERSIFIED', initialDeposit: 10000,
    lockInPreference: 'SOFT_LOCK', signatureName: 'Mode Test', consentConfirmed: true,
  }));
  await depositPOST(req('/api/retirement-vault/deposit', 'POST', { amount: 10000, transactionPin: PIN }));
  const vault = await prisma.retirementVault.findFirstOrThrow({ where: { userId: user.id } });
  vaultId = vault.id;
  check('starts DIVERSIFIED', vault.allocationMode === 'DIVERSIFIED');
  check('expert allocator off', vault.expertAllocatorActive === false);

  console.log('\n=== 1. Cooldown blocks an immediate switch ===');
  // Creation sets modeLastChangedAt, so the cooldown is already running.
  const blocked = await modePUT(req('/api/retirement-vault/allocation-mode', 'PUT', {
    allocationMode: 'EXPERT_ALLOCATOR',
  }));
  const blockedBody = await blocked.json();
  check('switch refused -> 429', blocked.status === 429, `got ${blocked.status}`);
  check('tells the member how long', (blockedBody.daysRemaining ?? 0) > 0, JSON.stringify(blockedBody));
  console.log(`  "${blockedBody.error}"`);

  const stillOff = await prisma.retirementVault.findUniqueOrThrow({ where: { id: vaultId } });
  check('mode genuinely unchanged', stillOff.allocationMode === 'DIVERSIFIED');

  console.log('\n=== 2. Status endpoint reports the cooldown ===');
  const status = await modeGET(req('/api/retirement-vault/allocation-mode', 'GET'));
  const statusBody = await status.json();
  check('canSwitch is false', statusBody.canSwitch === false);
  check('days remaining reported', statusBody.daysRemaining > 0, String(statusBody.daysRemaining));

  console.log('\n=== 3. Once the cooldown lapses, Expert can be turned ON ===');
  await prisma.retirementVault.update({
    where: { id: vaultId },
    data: { modeLastChangedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
  });

  const beforeValue = (await valueVault(vaultId))!.totalValue;
  const on = await modePUT(req('/api/retirement-vault/allocation-mode', 'PUT', {
    allocationMode: 'EXPERT_ALLOCATOR',
  }));
  const onBody = await on.json();
  check('switch accepted', on.status === 200, JSON.stringify(onBody).slice(0, 180));
  check('expertAllocatorActive is now true', onBody.expertAllocatorActive === true);

  const expertVault = await prisma.retirementVault.findUniqueOrThrow({ where: { id: vaultId } });
  check('persisted as EXPERT_ALLOCATOR', expertVault.allocationMode === 'EXPERT_ALLOCATOR');
  check('cooldown clock reset', expertVault.modeLastChangedAt !== null &&
    Date.now() - expertVault.modeLastChangedAt.getTime() < 60_000);

  const afterValue = (await valueVault(vaultId))!.totalValue;
  check('switching did not change the vault value',
    Math.abs(afterValue - beforeValue) < 1, `${beforeValue} -> ${afterValue}`);

  console.log('\n=== 4. Switching rebalances immediately ===');
  const events = await prisma.vaultRebalanceEvent.findMany({ where: { vaultId } });
  const modeChange = events.find((e) => e.trigger === 'MODE_CHANGE');
  if (onBody.rebalanced) {
    check('a MODE_CHANGE rebalance was logged', modeChange !== undefined);
    check('with an explanation', (modeChange?.explanation.length ?? 0) > 30);
  } else {
    // Already on target is a legitimate no-op, and must not log a fake event.
    check('no-op skipped rather than logged', modeChange === undefined, onBody.rebalanceNote ?? '');
    console.log(`  "${onBody.rebalanceNote}"`);
  }

  console.log('\n=== 5. Expert can be turned back OFF ===');
  await prisma.retirementVault.update({
    where: { id: vaultId },
    data: { modeLastChangedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
  });
  const off = await modePUT(req('/api/retirement-vault/allocation-mode', 'PUT', {
    allocationMode: 'DIVERSIFIED',
  }));
  check('switched back', off.status === 200, `got ${off.status}`);
  const offVault = await prisma.retirementVault.findUniqueOrThrow({ where: { id: vaultId } });
  check('expertAllocatorActive is false again', offVault.expertAllocatorActive === false);

  console.log('\n=== 6. Switching to FOCUSED needs a class ===');
  await prisma.retirementVault.update({
    where: { id: vaultId },
    data: { modeLastChangedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
  });
  const noClass = await modePUT(req('/api/retirement-vault/allocation-mode', 'PUT', {
    allocationMode: 'FOCUSED',
  }));
  check('FOCUSED without a class -> 400', noClass.status === 400, `got ${noClass.status}`);

  const focused = await modePUT(req('/api/retirement-vault/allocation-mode', 'PUT', {
    allocationMode: 'FOCUSED', focusedAssetClass: 'COMMODITIES',
  }));
  const focusedBody = await focused.json();
  check('FOCUSED with a class accepted', focused.status === 200, JSON.stringify(focusedBody).slice(0, 150));
  check('commodities is now the largest target',
    focusedBody.targetAllocation?.COMMODITIES > 50, `got ${focusedBody.targetAllocation?.COMMODITIES}`);
  check('crypto still capped after the switch',
    focusedBody.targetAllocation?.CRYPTO <= 5.001, `got ${focusedBody.targetAllocation?.CRYPTO}`);

  console.log('\n=== 7. Switching releases pinned allocations ===');
  await prisma.retirementVault.update({
    where: { id: vaultId },
    data: { modeLastChangedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
  });
  await rebalPUT(req('/api/retirement-vault/rebalances', 'PUT', {
    assetClass: 'REAL_ESTATE', targetPercent: 20, pinned: true,
  }));
  const pinnedBefore = await prisma.vaultAllocation.count({
    where: { vaultId, isUserOverride: true },
  });
  check('a class is pinned', pinnedBefore === 1, `got ${pinnedBefore}`);

  await modePUT(req('/api/retirement-vault/allocation-mode', 'PUT', {
    allocationMode: 'EXPERT_ALLOCATOR',
  }));
  const pinnedAfter = await prisma.vaultAllocation.count({
    where: { vaultId, isUserOverride: true },
  });
  check('pins released by the mode change', pinnedAfter === 0, `got ${pinnedAfter}`);

  console.log('\n=== 8. Switching to the SAME mode is rejected ===');
  await prisma.retirementVault.update({
    where: { id: vaultId },
    data: { modeLastChangedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
  });
  const same = await modePUT(req('/api/retirement-vault/allocation-mode', 'PUT', {
    allocationMode: 'EXPERT_ALLOCATOR',
  }));
  check('same mode -> 400, cooldown not burned', same.status === 400, `got ${same.status}`);

  console.log('\n=== 9. Unauthenticated access is refused ===');
  const noAuth = await modePUT(
    new NextRequest('http://localhost:3000/api/retirement-vault/allocation-mode', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ allocationMode: 'DIVERSIFIED' }),
    }),
  );
  check('no session -> 401', noAuth.status === 401, `got ${noAuth.status}`);
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
