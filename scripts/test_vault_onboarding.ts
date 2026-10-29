import 'dotenv/config';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { createSessionToken } from '../src/lib/session';
import { GET as questionnaireGET } from '../src/app/api/retirement-vault/questionnaire/route';
import { POST as assessPOST } from '../src/app/api/retirement-vault/assess/route';
import { POST as createPOST } from '../src/app/api/retirement-vault/create/route';
import { GET as statusGET } from '../src/app/api/retirement-vault/status/route';
import { RISK_QUESTIONS } from '../src/lib/vault/risk-questionnaire';
import { throwawayPassword } from './fixtures';

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed += 1; console.log(`  PASS  ${label}`); }
  else { failed += 1; console.log(`  FAIL  ${label} ${detail}`); }
}

const STAMP = Date.now();
let userId: string | null = null;
let token = '';

const BASE = 'http://localhost:3000';
function req(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.auth !== false) headers['authorization'] = `Bearer ${token}`;
  return new NextRequest(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

/** Answer every question at the given score rank. */
function answersAt(pick: 'lowest' | 'highest') {
  return RISK_QUESTIONS.map((q) => {
    const sorted = [...q.options].sort((a, b) => a.score - b.score);
    const opt = pick === 'lowest' ? sorted[0]! : sorted[sorted.length - 1]!;
    return { questionId: q.id, optionValue: opt.value };
  });
}

async function main() {
  console.log('=== 0. Setup ===');
  const user = await prisma.user.create({
    data: {
      email: `vault-onboard-test-${STAMP}@internal.test`,
      name: 'Vault Onboarding Test',
      password: throwawayPassword(),
      transactionPin: '0000',
      phoneNumber: '0000000000',
      countryCode: 'NG',
      currency: 'USD',
      authorizationCode: `VOT-${STAMP}`,
    },
  });
  userId = user.id;
  token = createSessionToken(user.id, user.email, 'USER');
  console.log(`  test user ${user.email}`);

  console.log('\n=== 1. Auth is enforced ===');
  const noAuth = await questionnaireGET(req('/api/retirement-vault/questionnaire', { auth: false }));
  check('unauthenticated questionnaire -> 401', noAuth.status === 401, `got ${noAuth.status}`);
  const noAuthCreate = await createPOST(req('/api/retirement-vault/create', { method: 'POST', body: {}, auth: false }));
  check('unauthenticated create -> 401', noAuthCreate.status === 401, `got ${noAuthCreate.status}`);

  console.log('\n=== 2. Questionnaire withholds the scoring ===');
  const qRes = await questionnaireGET(req('/api/retirement-vault/questionnaire'));
  const qBody = await qRes.json();
  check('returns 7 questions', qBody.questions?.length === 7, `got ${qBody.questions?.length}`);
  const serialised = JSON.stringify(qBody);
  check('no option scores leaked', !serialised.includes('"score"'));
  check('no "measures" leaked', !serialised.includes('measures'));

  console.log('\n=== 3. Assessment scores server-side ===');
  const boldLong = await assessPOST(req('/api/retirement-vault/assess', {
    method: 'POST', body: { answers: answersAt('highest'), horizon: 'YEARS_25_PLUS' },
  }));
  const boldBody = await boldLong.json();
  check('bold + long horizon -> GROWTH', boldBody.assignedProfile === 'GROWTH', boldBody.assignedProfile);
  check('preview allocation returned', typeof boldBody.previewAllocation?.CRYPTO === 'number');
  check('preview crypto at cap', boldBody.previewAllocation?.CRYPTO === 5, `got ${boldBody.previewAllocation?.CRYPTO}`);

  const boldShort = await assessPOST(req('/api/retirement-vault/assess', {
    method: 'POST', body: { answers: answersAt('highest'), horizon: 'YEARS_10' },
  }));
  const shortBody = await boldShort.json();
  check('bold + 10yr horizon held at BALANCED', shortBody.assignedProfile === 'BALANCED', shortBody.assignedProfile);
  check('horizon limit flagged to the member', shortBody.limitedByHorizon === true);

  const incomplete = await assessPOST(req('/api/retirement-vault/assess', {
    method: 'POST', body: { answers: answersAt('highest').slice(0, 3), horizon: 'YEARS_20' },
  }));
  check('incomplete assessment -> 400', incomplete.status === 400, `got ${incomplete.status}`);

  console.log('\n=== 4. Create validation ===');
  const badAge = await createPOST(req('/api/retirement-vault/create', {
    method: 'POST', body: { age: 12, countryOfResidence: 'NG', horizon: 'YEARS_20' },
  }));
  check('age under 18 rejected', badAge.status === 400, `got ${badAge.status}`);

  const base = {
    age: 35, countryOfResidence: 'Nigeria', horizon: 'YEARS_10', vehicleType: 'PRIMARY',
    answers: answersAt('highest'), allocationMode: 'DIVERSIFIED',
    initialDeposit: 10000, lockInPreference: 'SOFT_LOCK',
    signatureName: 'Vault Onboarding Test', consentConfirmed: true,
  };

  const noConsent = await createPOST(req('/api/retirement-vault/create', {
    method: 'POST', body: { ...base, consentConfirmed: false },
  }));
  check('missing consent rejected', noConsent.status === 400, `got ${noConsent.status}`);

  const tinyDeposit = await createPOST(req('/api/retirement-vault/create', {
    method: 'POST', body: { ...base, initialDeposit: 5 },
  }));
  check('deposit below minimum rejected', tinyDeposit.status === 400, `got ${tinyDeposit.status}`);

  console.log('\n=== 5. Profile cannot be forged by the client ===');
  // Client sends max-risk answers AND tries to assert GROWTH, but the 10-year
  // horizon must still hold the vault at BALANCED.
  const forged = await createPOST(req('/api/retirement-vault/create', {
    method: 'POST',
    body: { ...base, riskProfile: 'GROWTH', score: 28, assignedProfile: 'GROWTH' },
  }));
  const forgedBody = await forged.json();
  check('create succeeds', forged.status === 200, JSON.stringify(forgedBody).slice(0, 200));
  check(
    'server ignores the forged profile and applies the horizon guardrail',
    forgedBody.vault?.riskProfile === 'BALANCED',
    `got ${forgedBody.vault?.riskProfile}`,
  );
  check('assessment reports it was limited', forgedBody.assessment?.limitedByHorizon === true);
  console.log(`  vault ${forgedBody.vault?.vaultNumber} created as ${forgedBody.vault?.riskProfile}`);

  console.log('\n=== 6. What was actually written ===');
  const vault = await prisma.retirementVault.findFirst({
    where: { userId: user.id },
    include: { allocations: true, riskAssessments: true, contributions: true },
  });
  check('vault exists', vault !== null);
  check('status is PENDING_ACTIVATION', vault?.status === 'PENDING_ACTIVATION', vault?.status);
  check('6 allocations written', vault?.allocations.length === 6, `got ${vault?.allocations.length}`);
  check('risk assessment recorded', vault?.riskAssessments.length === 1);
  check('initial contribution PENDING', vault?.contributions[0]?.status === 'PENDING');
  check('terms version recorded', typeof vault?.termsVersion === 'string' && vault.termsVersion.length > 0);
  check('signature recorded', vault?.signatureName === 'Vault Onboarding Test');

  const total = (vault?.allocations ?? []).reduce((s, a) => s + a.targetPercent, 0);
  check('allocations total 100%', Math.abs(total - 100) < 0.01, `got ${total}`);
  const crypto = vault?.allocations.find((a) => a.assetClass === 'CRYPTO');
  check('crypto allocation within cap', (crypto?.targetPercent ?? 99) <= 5, `got ${crypto?.targetPercent}`);
  check('vault number uses RV-YYYY- format', /^RV-\d{4}-\d{5}$/.test(vault?.vaultNumber ?? ''), vault?.vaultNumber);

  console.log('\n=== 7. One vault per member ===');
  const duplicate = await createPOST(req('/api/retirement-vault/create', { method: 'POST', body: base }));
  check('second vault rejected with 409', duplicate.status === 409, `got ${duplicate.status}`);
  const vaultCount = await prisma.retirementVault.count({ where: { userId: user.id } });
  check('still exactly one vault', vaultCount === 1, `got ${vaultCount}`);

  console.log('\n=== 8. Status endpoint ===');
  const statusRes = await statusGET(req('/api/retirement-vault/status'));
  const statusBody = await statusRes.json();
  check('status reports the vault', statusBody.hasVault === true);
  check('status returns the vault number', statusBody.vault?.vaultNumber === vault?.vaultNumber);
}

async function cleanup() {
  console.log('\n=== Cleanup ===');
  if (userId !== null) {
    await prisma.retirementVault.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.notification.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  }
  console.log(`  retirement_vaults remaining: ${await prisma.retirementVault.count()}`);
}

main()
  .catch((e) => { console.error('FATAL', e); failed += 1; })
  .finally(async () => {
    await cleanup();
    console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
    await prisma.$disconnect();
    process.exit(failed === 0 ? 0 : 1);
  });
