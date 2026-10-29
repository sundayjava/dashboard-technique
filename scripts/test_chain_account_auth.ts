import 'dotenv/config';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { createSessionToken } from '../src/lib/session';
import { GET as statusGET } from '../src/app/api/chain-account/status/route';
import { POST as createPOST } from '../src/app/api/chain-account/create/route';
import { throwawayPassword } from './fixtures';

/**
 * Proves that chain-account create and status derive the acting user from a
 * verified session token, not from a client-supplied userId.
 *
 * The impersonation cases below are the point of this file: before the fix
 * they both succeeded.
 */

let passed = 0, failed = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label} ${detail}`); }
}

const STAMP = Date.now();
let attackerId: string | null = null;
let victimId: string | null = null;
let thirdId: string | null = null;
let attackerToken = '';

function req(path: string, method: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function mkUser(tag: string) {
  return prisma.user.create({
    data: {
      email: `chain-auth-${tag}-${STAMP}@internal.test`,
      name: `Chain Auth ${tag}`,
      password: throwawayPassword(),
      transactionPin: await bcrypt.hash('1234', 10),
      phoneNumber: '0', countryCode: 'NG', currency: 'USD',
      authorizationCode: `CA-${tag}-${STAMP}`,
    },
  });
}

async function main() {
  console.log('=== 0. Setup: attacker, victim, and a third party ===');
  const attacker = await mkUser('attacker');
  const victim = await mkUser('victim');
  const third = await mkUser('third');
  attackerId = attacker.id;
  victimId = victim.id;
  thirdId = third.id;
  attackerToken = createSessionToken(attacker.id, attacker.email, 'USER');
  console.log(`  attacker ${attacker.email}`);
  console.log(`  victim   ${victim.email}`);

  // Give the VICTIM a real chain account first. Without this, an impersonation
  // check is a false pass: the victim has nothing, so the attacker gets an
  // empty result either way and the test proves nothing.
  console.log('\n=== 0b. Victim has a real chain account ===');
  const victimAccount = await prisma.chainAccount.create({
    data: {
      accountName: 'Victim Account',
      accountNumber: `CA-VICTIM-${STAMP}`,
      primaryPurpose: 'Investment Partnership',
      purposeDescription: 'seeded',
      numberOfParties: 2,
      relationship: 'Business Partners',
      expectedMonthlyVolume: 'Under $5,000',
      combinedCapitalLevel: 'Under $50,000',
      intendedAssetHoldings: 'Both',
      authorizationModel: 'INDEPENDENT',
      status: 'ACTIVE',
      createdBy: victim.id,
      members: {
        create: [{ userId: victim.id, role: 'PRIMARY_HOLDER', hasConfirmed: true }],
      },
    },
  });
  console.log(`  victim holds ${victimAccount.accountNumber}`);

  console.log('\n=== 1. status requires a session ===');
  const noAuth = await statusGET(req(`/api/chain-account/status?userId=${victim.id}`, 'GET'));
  check('unauthenticated status -> 401', noAuth.status === 401, `got ${noAuth.status}`);

  console.log('\n=== 2. status cannot be pointed at another user ===');
  const impersonate = await statusGET(
    req(`/api/chain-account/status?userId=${victim.id}`, 'GET', undefined, attackerToken),
  );
  const impBody = await impersonate.json();
  check('request succeeds for the CALLER', impersonate.status === 200, `got ${impersonate.status}`);
  // The victim demonstrably HAS an account, so leaking it would show up here
  // as totalCount 1. The attacker must see their own empty result instead.
  check(
    'victim\'s account is NOT disclosed to the attacker',
    impBody?.data?.totalCount === 0 && impBody?.data?.state === 'none',
    `leaked: ${JSON.stringify(impBody?.data)}`,
  );
  check(
    'and no victim account number appears in the response',
    !JSON.stringify(impBody).includes(victimAccount.accountNumber),
  );

  console.log('\n=== 3. create requires a session ===');
  const createNoAuth = await createPOST(
    req('/api/chain-account/create', 'POST', { userId: victim.id }),
  );
  check('unauthenticated create -> 401', createNoAuth.status === 401, `got ${createNoAuth.status}`);

  console.log('\n=== 4. create cannot name someone else as primary holder ===');
  const forged = await createPOST(
    req('/api/chain-account/create', 'POST', {
      // The attacker claims the victim is the primary holder.
      userId: victim.id,
      accountName: 'Forged Account',
      primaryPurpose: 'Investment Partnership',
      purposeDescription: 'test',
      numberOfParties: 2,
      relationship: 'Business Partners',
      coSignatories: [{ userId: third.id, email: third.email }],
      expectedMonthlyVolume: 'Under $5,000',
      combinedCapitalLevel: 'Under $50,000',
      intendedAssetHoldings: 'Both',
      authorizationModel: 'INDEPENDENT',
    }, attackerToken),
  );
  const forgedBody = await forged.json();

  // Whether this succeeds or fails on other validation, the ONE thing that
  // must hold is that no account is created with the victim as primary holder.
  const victimPrimaries = await prisma.chainAccountMember.findMany({
    where: { userId: victim.id, role: 'PRIMARY_HOLDER' },
    include: { chainAccount: { select: { accountNumber: true } } },
  });
  // Exactly the one they seeded themselves — the forged request added none.
  check(
    'no NEW account created with the victim as primary holder',
    victimPrimaries.length === 1 &&
      victimPrimaries[0]!.chainAccount.accountNumber === victimAccount.accountNumber,
    `found ${victimPrimaries.length}: ${victimPrimaries.map((m) => m.chainAccount.accountNumber).join(', ')}`,
  );

  if (forged.status === 200 || forged.status === 201) {
    const created = await prisma.chainAccountMember.findFirst({
      where: { userId: attacker.id, role: 'PRIMARY_HOLDER' },
    });
    check('if created at all, the CALLER is the primary holder', created !== null);
    console.log(`  account created with the caller as holder (body userId ignored)`);
  } else {
    console.log(`  create rejected (${forged.status}): ${forgedBody?.error ?? ''}`);
    check('rejected without creating anything for the victim', true);
  }

  console.log('\n=== 5. The legitimate flow still works ===');
  // Exactly what the real page sends: body userId matching the session.
  const legit = await createPOST(
    req('/api/chain-account/create', 'POST', {
      userId: attacker.id,
      accountName: 'Legit Account',
      primaryPurpose: 'Investment Partnership',
      purposeDescription: 'test',
      numberOfParties: 2,
      relationship: 'Business Partners',
      coSignatories: [{ userId: third.id, email: third.email }],
      expectedMonthlyVolume: 'Under $5,000',
      combinedCapitalLevel: 'Under $50,000',
      intendedAssetHoldings: 'Both',
      authorizationModel: 'INDEPENDENT',
    }, attackerToken),
  );
  const legitBody = await legit.json();
  check('legitimate create succeeds', legit.status === 200 || legit.status === 201,
    `${legit.status}: ${JSON.stringify(legitBody).slice(0, 200)}`);

  const holder = await prisma.chainAccountMember.findFirst({
    where: { userId: attacker.id, role: 'PRIMARY_HOLDER' },
    include: { chainAccount: true },
  });
  check('caller is the primary holder', holder !== null);
  console.log(`  created ${holder?.chainAccount.accountNumber}`);

  console.log('\n=== 6. status now reflects the real membership ===');
  const after = await statusGET(
    req(`/api/chain-account/status?userId=${attacker.id}`, 'GET', undefined, attackerToken),
  );
  const afterBody = await after.json();
  check('caller sees their own account', (afterBody?.data?.totalCount ?? 0) >= 1,
    JSON.stringify(afterBody?.data));
}

async function cleanup() {
  console.log('\n=== Cleanup ===');
  for (const id of [attackerId, victimId, thirdId]) {
    if (!id) continue;
    const memberships = await prisma.chainAccountMember.findMany({ where: { userId: id } });
    for (const m of memberships) {
      await prisma.chainAccount.deleteMany({ where: { id: m.chainAccountId } }).catch(() => undefined);
    }
    await prisma.notification.deleteMany({ where: { userId: id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id } }).catch(() => undefined);
  }
  console.log(`  chain accounts remaining: ${await prisma.chainAccount.count()}`);
}

main()
  .catch((e) => { console.error('FATAL', e); failed++; })
  .finally(async () => {
    await cleanup();
    console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
    await prisma.$disconnect();
    process.exit(failed === 0 ? 0 : 1);
  });
