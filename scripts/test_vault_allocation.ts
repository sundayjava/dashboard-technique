import { VaultAssetClass } from '../src/lib/vault/asset-classes';
import { AllocationMode, RiskProfile } from '@prisma/client';
import {
  AllocationMap,
  CRYPTO_CAP_PERCENT,
  TARGET_ALLOCATIONS,
  applyOverrides,
  canSwitchMode,
  getInvestableClasses,
  computeDrift,
  enforceCryptoCap,
  getAllAssetClasses,
  getTargetAllocation,
  sumAllocation,
  validateAllocation,
} from '../src/lib/vault/allocation-model';

/**
 * Verification harness for the allocation policy.
 *
 * The crypto cap is a system-level guarantee, so it is asserted on every path
 * that can produce an allocation — including deliberately hostile inputs.
 */

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label} ${detail}`);
  }
}

function fmt(a: AllocationMap): string {
  return getAllAssetClasses()
    .map((c) => `${c.slice(0, 6)}=${a[c].toFixed(2)}`)
    .join('  ');
}

function assertInvariants(label: string, a: AllocationMap) {
  const total = sumAllocation(a);
  check(`${label}: totals 100`, Math.abs(total - 100) < 0.01, `got ${total}`);
  check(
    `${label}: crypto <= ${CRYPTO_CAP_PERCENT}%`,
    a[VaultAssetClass.CRYPTO] <= CRYPTO_CAP_PERCENT + 1e-9,
    `got ${a[VaultAssetClass.CRYPTO]}`,
  );
  check(
    `${label}: no negatives`,
    getAllAssetClasses().every((c) => a[c] >= 0),
    fmt(a),
  );
}

console.log('=== 1. Profile tables match the spec ===');
for (const profile of [RiskProfile.CONSERVATIVE, RiskProfile.BALANCED, RiskProfile.GROWTH]) {
  const a = TARGET_ALLOCATIONS[profile];
  console.log(`  ${profile.padEnd(13)} ${fmt(a)}`);
  assertInvariants(profile, a);
  const v = validateAllocation(a);
  check(`${profile}: validates`, v.valid, v.errors.join('; '));
}

console.log('\n=== 2. Every mode x profile honours the cap ===');
for (const profile of [RiskProfile.CONSERVATIVE, RiskProfile.BALANCED, RiskProfile.GROWTH]) {
  for (const mode of [AllocationMode.DIVERSIFIED, AllocationMode.EXPERT_ALLOCATOR]) {
    const a = getTargetAllocation({ riskProfile: profile, mode });
    assertInvariants(`${profile}/${mode}`, a);
  }
}

console.log('\n=== 3. FOCUSED restricts WHICH class, it does not concentrate ===');
for (const focus of getAllAssetClasses()) {
  const a = getTargetAllocation({
    riskProfile: RiskProfile.BALANCED,
    mode: AllocationMode.FOCUSED,
    focusedAssetClass: focus,
  });
  assertInvariants(`FOCUSED/${focus}`, a);
  check(
    `FOCUSED/${focus}: ceilings are unchanged from the profile`,
    JSON.stringify(a) === JSON.stringify(TARGET_ALLOCATIONS[RiskProfile.BALANCED]),
    fmt(a),
  );
}

const balancedTarget = TARGET_ALLOCATIONS[RiskProfile.BALANCED];
for (const focus of getAllAssetClasses()) {
  const investable = getInvestableClasses(balancedTarget, AllocationMode.FOCUSED, focus);
  check(`FOCUSED/${focus}: exactly one class is investable`, investable.length === 1,
    investable.join(', '));
  check(`FOCUSED/${focus}: it is the chosen one`, investable[0] === focus, investable[0] ?? 'none');
}

const noFocus = getInvestableClasses(balancedTarget, AllocationMode.FOCUSED, null);
check('FOCUSED with no class chosen can fund nothing', noFocus.length === 0, noFocus.join(', '));

const diversified = getInvestableClasses(balancedTarget, AllocationMode.DIVERSIFIED);
check('DIVERSIFIED can fund every class with a target', diversified.length === 6,
  String(diversified.length));

const expert = getInvestableClasses(balancedTarget, AllocationMode.EXPERT_ALLOCATOR);
check('EXPERT can fund every class with a target', expert.length === 6, String(expert.length));

// A class the profile excludes cannot be funded even in Diversified.
const conservative = getInvestableClasses(
  TARGET_ALLOCATIONS[RiskProfile.CONSERVATIVE],
  AllocationMode.DIVERSIFIED,
);
check('a class targeted at 0% is not investable',
  !conservative.includes(VaultAssetClass.FUTURES_MACRO), conservative.join(', '));

console.log('\n=== 4. Hostile inputs cannot breach the cap ===');
const hostile: AllocationMap = {
  [VaultAssetClass.GLOBAL_EQUITIES]: 10,
  [VaultAssetClass.FIXED_INCOME]: 10,
  [VaultAssetClass.COMMODITIES]: 10,
  [VaultAssetClass.REAL_ESTATE]: 10,
  [VaultAssetClass.FUTURES_MACRO]: 10,
  [VaultAssetClass.CRYPTO]: 50,
};
const capped = enforceCryptoCap(hostile);
console.log(`  50% crypto proposal -> ${fmt(capped)}`);
assertInvariants('hostile 50% crypto', capped);

const allCrypto: AllocationMap = {
  [VaultAssetClass.GLOBAL_EQUITIES]: 0,
  [VaultAssetClass.FIXED_INCOME]: 0,
  [VaultAssetClass.COMMODITIES]: 0,
  [VaultAssetClass.REAL_ESTATE]: 0,
  [VaultAssetClass.FUTURES_MACRO]: 0,
  [VaultAssetClass.CRYPTO]: 100,
};
const cappedAll = enforceCryptoCap(allCrypto);
console.log(`  100% crypto proposal -> ${fmt(cappedAll)}`);
assertInvariants('hostile 100% crypto', cappedAll);

console.log('\n=== 5. Member overrides respect the cap ===');
const overridden = applyOverrides(TARGET_ALLOCATIONS[RiskProfile.BALANCED], {
  [VaultAssetClass.CRYPTO]: 80,
});
console.log(`  member pins crypto at 80% -> ${fmt(overridden)}`);
check(
  'pinned crypto is clamped',
  overridden[VaultAssetClass.CRYPTO] <= CRYPTO_CAP_PERCENT + 1e-9,
  `got ${overridden[VaultAssetClass.CRYPTO]}`,
);
assertInvariants('override crypto 80%', overridden);

const pinnedGold = applyOverrides(TARGET_ALLOCATIONS[RiskProfile.BALANCED], {
  [VaultAssetClass.COMMODITIES]: 30,
});
console.log(`  member pins commodities at 30% -> ${fmt(pinnedGold)}`);
check(
  'pinned class is honoured exactly',
  Math.abs(pinnedGold[VaultAssetClass.COMMODITIES] - 30) < 0.01,
  `got ${pinnedGold[VaultAssetClass.COMMODITIES]}`,
);
assertInvariants('override commodities 30%', pinnedGold);

console.log('\n=== 6. Drift detection ===');
const target = TARGET_ALLOCATIONS[RiskProfile.BALANCED];
const drifted: AllocationMap = { ...target };
drifted[VaultAssetClass.GLOBAL_EQUITIES] = 42; // +7 from 35
drifted[VaultAssetClass.FIXED_INCOME] = 18; // -7 from 25
const report = computeDrift(target, drifted);
console.log(`  max drift ${report.maxAbsoluteDrift.toFixed(2)} pts, rebalance=${report.rebalanceRequired}`);
check('drift of 7pts triggers rebalance', report.rebalanceRequired);
check('max drift reported correctly', Math.abs(report.maxAbsoluteDrift - 7) < 0.01);

const smallDrift: AllocationMap = { ...target };
smallDrift[VaultAssetClass.GLOBAL_EQUITIES] = 37; // +2
smallDrift[VaultAssetClass.FIXED_INCOME] = 23; // -2
const quiet = computeDrift(target, smallDrift);
check('drift of 2pts does NOT trigger rebalance', !quiet.rebalanceRequired);

console.log('\n=== 7. Mode-switch cooldown ===');
const never = canSwitchMode(null);
check('never switched -> allowed', never.allowed);

const justSwitched = canSwitchMode(new Date());
check('just switched -> blocked', !justSwitched.allowed);
check('reports ~30 days remaining', justSwitched.daysRemaining === 30, `got ${justSwitched.daysRemaining}`);

const longAgo = canSwitchMode(new Date(Date.now() - 31 * 24 * 60 * 60 * 1000));
check('switched 31 days ago -> allowed', longAgo.allowed);

const almost = canSwitchMode(new Date(Date.now() - 29.8 * 24 * 60 * 60 * 1000));
check('0.2 days left rounds up to 1, not 0', almost.daysRemaining === 1, `got ${almost.daysRemaining}`);

console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
process.exit(failed === 0 ? 0 : 1);
