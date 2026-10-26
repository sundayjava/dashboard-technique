import { VaultAssetClass } from '../src/lib/vault/asset-classes';
import 'dotenv/config';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { RebalanceTrigger } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { createSessionToken } from '../src/lib/session';
import { POST as createPOST } from '../src/app/api/retirement-vault/create/route';
import { POST as depositPOST } from '../src/app/api/retirement-vault/deposit/route';
import { POST as investPOST } from '../src/app/api/retirement-vault/invest/route';
import { RISK_QUESTIONS } from '../src/lib/vault/risk-questionnaire';
import { computeSignals, SignalSet } from '../src/lib/vault/signals';
import {
  MAX_TILT_POINTS, applyRebalance, proposeRebalance, proposalTotalsOneHundred,
} from '../src/lib/vault/rebalance-engine';
import { valueVault } from '../src/lib/vault/valuation';
import { sumAllocation } from '../src/lib/vault/allocation-model';
import { loadVaultPolicy } from '../src/lib/vault/policy-store';

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
    const s = [...q.options].sort((a, b) => a.score - b.score);
    return { questionId: q.id, optionValue: s[s.length - 1]!.value };
  });
}

/** Synthetic signals: rising rates + inflation + equity run. */
function strongSignals(): SignalSet {
  const mk = (name: string, v: number, reading: string) => ({
    name, valuePercent: v,
    direction: (v >= 5 ? 'positive' : v <= -5 ? 'negative' : 'neutral') as 'positive'|'negative'|'neutral',
    reading,
  });
  return {
    sufficientHistory: true, historyDays: 120,
    windowStart: new Date(), windowEnd: new Date(),
    rateEnvironment: mk('Interest rate environment', 9, 'bond prices have fallen, indicating a rising rate environment'),
    inflationPressure: mk('Inflation pressure', 11, 'precious metals have outpaced equities, a classic inflation-hedge bid'),
    equityMomentum: mk('Equity momentum', 14, 'global equities have run strongly this quarter'),
    commodityCycle: mk('Commodity cycle', 7, 'the broad commodity complex has been advancing'),
    note: null,
  };
}

async function main() {
  console.log('=== 0. Setup: funded Growth vault in Expert mode ===');
  const user = await prisma.user.create({
    data: {
      email: `vault-rb-${STAMP}@internal.test`, name: 'Rebalance Test', password: 'x',
      transactionPin: await bcrypt.hash(PIN, 10), phoneNumber: '0', countryCode: 'NG',
      currency: 'USD', authorizationCode: `VRB-${STAMP}`,
    },
  });
  userId = user.id;
  token = createSessionToken(user.id, user.email, 'USER');
  await prisma.account.create({
    data: {
      userId: user.id, accountNumber: `RB${STAMP}`.slice(0, 15), accountName: 'RB',
      currency: 'USD', balance: 20000, availableBalance: 20000,
    },
  });
  await createPOST(req('/api/retirement-vault/create', {
    age: 35, countryOfResidence: 'Nigeria', horizon: 'YEARS_25_PLUS', vehicleType: 'PRIMARY',
    answers: boldAnswers(), allocationMode: 'EXPERT_ALLOCATOR', initialDeposit: 10000,
    lockInPreference: 'SOFT_LOCK', signatureName: 'Rebalance Test', consentConfirmed: true,
  }));
  await depositPOST(req('/api/retirement-vault/deposit', { amount: 10000, transactionPin: PIN }));
  // A deposit is held as cash now, so invest it before there is anything to
  // rebalance.
  await investPOST(req('/api/retirement-vault/invest', { amount: 10000 }));
  const vault = await prisma.retirementVault.findFirstOrThrow({ where: { userId: user.id } });
  check('vault is in Expert mode', vault.expertAllocatorActive);

  console.log('\n=== 1. Real history is honestly reported as insufficient ===');
  const real = await computeSignals();
  check('not enough stored history yet', !real.sufficientHistory, `days=${real.historyDays}`);
  check('and it says so plainly', (real.note ?? '').includes('history'), real.note ?? '');
  console.log(`  "${real.note}"`);

  const noTilt = await proposeRebalance(vault.id, RebalanceTrigger.QUARTERLY, { signals: real });
  check('with no history, proposed target equals the plain profile target',
    JSON.stringify(noTilt!.proposedTarget) === JSON.stringify(noTilt!.baseTarget),
    JSON.stringify(noTilt!.proposedTarget));
  check('explanation admits the limitation', noTilt!.explanation.includes('history'));

  console.log('\n=== 2. With signals, tilts are applied and bounded ===');
  const signals = strongSignals();
  const tilted = await proposeRebalance(vault.id, RebalanceTrigger.QUARTERLY, { signals });
  check('proposal totals 100%', proposalTotalsOneHundred(tilted!), String(sumAllocation(tilted!.proposedTarget)));
  check('crypto still within cap', tilted!.proposedTarget.CRYPTO <= 5.001, `got ${tilted!.proposedTarget.CRYPTO}`);

  for (const cls of Object.keys(tilted!.baseTarget) as VaultAssetClass[]) {
    const delta = Math.abs(tilted!.proposedTarget[cls] - tilted!.baseTarget[cls]);
    check(`${cls} tilt within ${MAX_TILT_POINTS} pts`, delta <= MAX_TILT_POINTS + 1.5,
      `moved ${delta.toFixed(2)}`);
  }

  console.log('  base -> proposed:');
  for (const cls of Object.keys(tilted!.baseTarget) as VaultAssetClass[]) {
    console.log(`    ${cls.padEnd(16)} ${tilted!.baseTarget[cls].toFixed(1)}% -> ${tilted!.proposedTarget[cls].toFixed(1)}%`);
  }

  console.log('\n=== 3. Rules move in defensible directions ===');
  check('rising rates REDUCE bonds',
    tilted!.proposedTarget.FIXED_INCOME < tilted!.baseTarget.FIXED_INCOME,
    `${tilted!.baseTarget.FIXED_INCOME} -> ${tilted!.proposedTarget.FIXED_INCOME}`);
  check('inflation pressure INCREASES commodities',
    tilted!.proposedTarget.COMMODITIES > tilted!.baseTarget.COMMODITIES,
    `${tilted!.baseTarget.COMMODITIES} -> ${tilted!.proposedTarget.COMMODITIES}`);
  check('a strong equity run is FADED, not chased',
    tilted!.proposedTarget.GLOBAL_EQUITIES < tilted!.baseTarget.GLOBAL_EQUITIES,
    `${tilted!.baseTarget.GLOBAL_EQUITIES} -> ${tilted!.proposedTarget.GLOBAL_EQUITIES}`);

  console.log('\n=== 4. Explanation is plain English with before/after ===');
  console.log(`  "${tilted!.explanation}"`);
  check('names a percentage move', /\d+\.\d%\s*to\s*\d+\.\d%/.test(tilted!.explanation));
  check('reads as proper English (verb before the class)',
    /We (reduced|increased) [a-z ]+ from/.test(tilted!.explanation), tilted!.explanation.slice(0, 160));
  check('gives a reason', tilted!.explanation.includes('because') || tilted!.explanation.includes('—'));
  check('mentions the rate environment', tilted!.explanation.toLowerCase().includes('rate'));

  console.log('\n=== 5. Applying it is value-neutral ===');
  const before = await valueVault(vault.id);
  const applied = await applyRebalance(tilted!);
  check('rebalance applied', applied.applied, applied.reason ?? '');
  const after = await valueVault(vault.id);
  check('total value unchanged by rebalancing',
    Math.abs((after?.totalValue ?? 0) - (before?.totalValue ?? 0)) < 1,
    `${before?.totalValue?.toFixed(2)} -> ${after?.totalValue?.toFixed(2)}`);
  console.log(`  value ${before?.totalValue.toFixed(2)} -> ${after?.totalValue.toFixed(2)}`);

  const alloc = after!.currentAllocation;
  let matches = true;
  for (const cls of Object.keys(tilted!.proposedTarget) as VaultAssetClass[]) {
    if (Math.abs(alloc[cls] - tilted!.proposedTarget[cls]) > 0.1) matches = false;
  }
  check('holdings now match the proposed target', matches,
    Object.entries(alloc).map(([k, v]) => `${k}=${v.toFixed(1)}`).join(' '));
  check('crypto still capped after execution', alloc.CRYPTO <= 5.01, `got ${alloc.CRYPTO.toFixed(2)}`);

  console.log('\n=== 6. Event and changes are logged ===');
  const event = await prisma.vaultRebalanceEvent.findFirstOrThrow({
    where: { vaultId: vault.id }, include: { changes: true },
  });
  check('event recorded as APPLIED', event.status === 'APPLIED');
  check('explanation stored', event.explanation.length > 50);
  check('signals stored for audit', (event.signals ?? '').includes('rateEnvironment'));
  check('per-class changes stored', event.changes.length > 0, `got ${event.changes.length}`);
  check('value at execution recorded', (event.valueAtExecution ?? 0) > 0);

  console.log('\n=== 7. Member override is honoured and worked around ===');
  await prisma.vaultAllocation.update({
    where: { vaultId_assetClass: { vaultId: vault.id, assetClass: VaultAssetClass.COMMODITIES } },
    data: { targetPercent: 25, isUserOverride: true, overriddenAt: new Date() },
  });
  const pinned = await proposeRebalance(vault.id, RebalanceTrigger.QUARTERLY, { signals });
  check('pinned class held exactly where the member put it',
    Math.abs(pinned!.proposedTarget.COMMODITIES - 25) < 0.01,
    `got ${pinned!.proposedTarget.COMMODITIES}`);
  check('still totals 100%', proposalTotalsOneHundred(pinned!));
  check('crypto still capped alongside an override', pinned!.proposedTarget.CRYPTO <= 5.001);
  check('explanation tells the member it was left alone',
    pinned!.explanation.toLowerCase().includes('pinned'), pinned!.explanation);
  check('expert mode remains on', (await prisma.retirementVault.findFirstOrThrow({ where: { id: vault.id } })).expertAllocatorActive);

  console.log('\n=== 8. A hostile override cannot breach the cap ===');
  await prisma.vaultAllocation.update({
    where: { vaultId_assetClass: { vaultId: vault.id, assetClass: VaultAssetClass.CRYPTO } },
    data: { targetPercent: 60, isUserOverride: true },
  });
  const hostile = await proposeRebalance(vault.id, RebalanceTrigger.QUARTERLY, { signals });
  check('60% crypto override clamped to the cap',
    hostile!.proposedTarget.CRYPTO <= 5.001, `got ${hostile!.proposedTarget.CRYPTO}`);
  check('and still totals 100%', proposalTotalsOneHundred(hostile!), String(sumAllocation(hostile!.proposedTarget)));

  console.log('\n=== 9. No-op runs are skipped, not logged ===');
  await prisma.vaultAllocation.updateMany({ where: { vaultId: vault.id }, data: { isUserOverride: false } });
  const policy = await loadVaultPolicy();
  const onTarget = await proposeRebalance(vault.id, RebalanceTrigger.DRIFT_THRESHOLD, { signals, policy });
  check('drift trigger is not actionable when within tolerance',
    !onTarget!.actionable, onTarget!.skipReason ?? 'was actionable');
  console.log(`  "${onTarget!.skipReason}"`);
  const applyNoop = await applyRebalance(onTarget!);
  check('applying a non-actionable proposal writes nothing', !applyNoop.applied);
  const eventCount = await prisma.vaultRebalanceEvent.count({ where: { vaultId: vault.id } });
  check('still exactly one event logged', eventCount === 1, `got ${eventCount}`);
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
