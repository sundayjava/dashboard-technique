import { VaultAssetClass } from '../src/lib/vault/asset-classes';
import 'dotenv/config';
import { RiskProfile } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import {
  POLICY_SETTINGS,
  invalidatePolicyCache,
  loadVaultPolicyDetailed,
  seedVaultPolicy,
  updatePolicySetting,
  updateProfileAllocation,
} from '../src/lib/vault/policy-store';
import { DEFAULT_VAULT_POLICY, getTargetAllocation } from '../src/lib/vault/allocation-model';
import { AllocationMode } from '@prisma/client';

let passed = 0, failed = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label} ${detail}`); }
}

const ADMIN = 'test-admin';

async function main() {
  console.log('=== 1. Seed defaults ===');
  const seeded = await seedVaultPolicy();
  console.log(`  created ${seeded.settingsCreated} settings, ${seeded.allocationsCreated} allocation rows`);
  const settingCount = await prisma.vaultPolicySetting.count();
  const allocCount = await prisma.vaultProfileAllocation.count();
  // Asserted against the definition list rather than a literal, so adding a
  // setting does not fail a test that is not about counting.
  check(
    `${POLICY_SETTINGS.length} policy settings stored`,
    settingCount === POLICY_SETTINGS.length,
    `got ${settingCount}`,
  );
  check('18 allocation rows stored (3 profiles x 6 classes)', allocCount === 18, `got ${allocCount}`);

  const reseed = await seedVaultPolicy();
  check('re-seeding creates nothing new', reseed.settingsCreated === 0 && reseed.allocationsCreated === 0);

  console.log('\n=== 2. Loaded policy matches shipped defaults ===');
  invalidatePolicyCache();
  const { policy, warnings } = await loadVaultPolicyDetailed();
  check('no warnings on a clean seed', warnings.length === 0, warnings.join('; '));
  check('crypto cap is 5', policy.cryptoCapPercent === 5, `got ${policy.cryptoCapPercent}`);
  check('balanced equities 35', policy.targetAllocations.BALANCED.GLOBAL_EQUITIES === 35);

  console.log('\n=== 3. Admin changes take effect ===');
  const r1 = await updatePolicySetting('driftThresholdPercent', 8, ADMIN);
  check('drift threshold updated', r1.ok, r1.errors.join('; '));
  invalidatePolicyCache();
  const after = await loadVaultPolicyDetailed();
  check('reads back as 8', after.policy.driftThresholdPercent === 8, `got ${after.policy.driftThresholdPercent}`);

  console.log('\n=== 4. Out-of-range settings are refused ===');
  const bad1 = await updatePolicySetting('cryptoCapPercent', 95, ADMIN);
  check('cap of 95% refused (max 25)', !bad1.ok, bad1.errors.join('; '));
  const bad2 = await updatePolicySetting('driftThresholdPercent', -5, ADMIN);
  check('negative drift refused', !bad2.ok);
  const bad3 = await updatePolicySetting('nonsenseKey', 1, ADMIN);
  check('unknown setting refused', !bad3.ok);

  console.log('\n=== 5. Cap cannot be lowered below a stored target ===');
  const lower = await updatePolicySetting('cryptoCapPercent', 2, ADMIN);
  check('refuses while profiles target 5% crypto', !lower.ok, lower.errors.join('; '));
  console.log(`  "${lower.errors[0]}"`);

  console.log('\n=== 6. Allocation edits are validated as a whole set ===');
  const notHundred = await updateProfileAllocation(RiskProfile.BALANCED, {
    GLOBAL_EQUITIES: 50, FIXED_INCOME: 25, COMMODITIES: 20,
    REAL_ESTATE: 10, FUTURES_MACRO: 5, CRYPTO: 5,
  }, ADMIN);
  check('allocation totalling 115% refused', !notHundred.ok, notHundred.errors.join('; '));

  const overCap = await updateProfileAllocation(RiskProfile.BALANCED, {
    GLOBAL_EQUITIES: 30, FIXED_INCOME: 20, COMMODITIES: 20,
    REAL_ESTATE: 10, FUTURES_MACRO: 0, CRYPTO: 20,
  }, ADMIN);
  check('allocation breaching the crypto cap refused', !overCap.ok, overCap.errors.join('; '));
  console.log(`  "${overCap.errors[0]}"`);

  console.log('\n=== 7. A valid allocation change flows into new vaults ===');
  const valid = await updateProfileAllocation(RiskProfile.BALANCED, {
    GLOBAL_EQUITIES: 45, FIXED_INCOME: 20, COMMODITIES: 15,
    REAL_ESTATE: 10, FUTURES_MACRO: 5, CRYPTO: 5,
  }, ADMIN);
  check('valid allocation accepted', valid.ok, valid.errors.join('; '));

  invalidatePolicyCache();
  const updated = await loadVaultPolicyDetailed();
  check('stored equities now 45', updated.policy.targetAllocations.BALANCED.GLOBAL_EQUITIES === 45,
    `got ${updated.policy.targetAllocations.BALANCED.GLOBAL_EQUITIES}`);

  const target = getTargetAllocation(
    { riskProfile: RiskProfile.BALANCED, mode: AllocationMode.DIVERSIFIED },
    updated.policy,
  );
  check('getTargetAllocation uses the admin value', target.GLOBAL_EQUITIES === 45, `got ${target.GLOBAL_EQUITIES}`);

  const shipped = getTargetAllocation({ riskProfile: RiskProfile.BALANCED, mode: AllocationMode.DIVERSIFIED });
  check('shipped default is unchanged without a policy', shipped.GLOBAL_EQUITIES === 35, `got ${shipped.GLOBAL_EQUITIES}`);

  console.log('\n=== 8. Corrupt stored data falls back, never applies ===');
  await prisma.vaultProfileAllocation.deleteMany({
    where: { riskProfile: RiskProfile.GROWTH, assetClass: VaultAssetClass.CRYPTO },
  });
  invalidatePolicyCache();
  const partial = await loadVaultPolicyDetailed();
  check('incomplete profile falls back to defaults',
    partial.policy.targetAllocations.GROWTH.GLOBAL_EQUITIES === DEFAULT_VAULT_POLICY.targetAllocations.GROWTH.GLOBAL_EQUITIES);
  check('and warns about it', partial.warnings.some((w) => w.includes('GROWTH')), partial.warnings.join('; '));
  console.log(`  "${partial.warnings.find((w) => w.includes('GROWTH'))}"`);

  // A value outside bounds written directly to the DB must be ignored.
  await prisma.vaultPolicySetting.update({
    where: { key: 'cryptoCapPercent' },
    data: { numericValue: 80 },
  });
  invalidatePolicyCache();
  const corrupt = await loadVaultPolicyDetailed();
  check('out-of-bounds stored cap ignored', corrupt.policy.cryptoCapPercent === 5, `got ${corrupt.policy.cryptoCapPercent}`);
  check('and warns about it', corrupt.warnings.some((w) => w.includes('Crypto cap')));
  console.log(`  "${corrupt.warnings.find((w) => w.includes('Crypto cap'))}"`);
}

async function restore() {
  console.log('\n=== Restore shipped defaults ===');
  await prisma.vaultPolicySetting.deleteMany({});
  await prisma.vaultProfileAllocation.deleteMany({});
  const s = await seedVaultPolicy();
  invalidatePolicyCache();
  const { policy, warnings } = await loadVaultPolicyDetailed();
  console.log(`  reseeded ${s.settingsCreated} settings, ${s.allocationsCreated} allocations`);
  console.log(`  crypto cap ${policy.cryptoCapPercent}%, balanced equities ${policy.targetAllocations.BALANCED.GLOBAL_EQUITIES}%, warnings: ${warnings.length}`);
}

main()
  .catch((e) => { console.error('FATAL', e); failed++; })
  .finally(async () => {
    await restore();
    console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
    await prisma.$disconnect();
    process.exit(failed === 0 ? 0 : 1);
  });
