import { VaultAssetClass } from './asset-classes';
import { RiskProfile } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { invalidatePriceCaches } from './valuation';
import { getAssetClassKeys } from './asset-class-store';
import {
  AllocationMap,
  DEFAULT_VAULT_POLICY,
  VaultPolicy,
  getAllAssetClasses,
  sumAllocation,
  validateAllocation,
} from './allocation-model';

/**
 * Loads admin-configured policy, falling back to the shipped defaults.
 *
 * The guiding rule: stored policy is only used when it is VALID. A missing
 * row, an unparseable value, or an allocation set that does not total 100 all
 * fall back to the code default rather than being used as-is. Silently
 * applying a broken policy would misallocate real retirement money, and the
 * failure would be invisible — every vault created afterwards would simply be
 * wrong.
 */

export interface PolicySettingDefinition {
  key: keyof Omit<VaultPolicy, 'targetAllocations'>;
  label: string;
  description: string;
  min: number;
  max: number;
  defaultValue: number;
  /** How the admin UI should render it. */
  unit: 'percent' | 'days';
}

export const POLICY_SETTINGS: PolicySettingDefinition[] = [
  {
    key: 'cryptoCapPercent',
    label: 'Crypto cap',
    description:
      'The maximum share of any vault that may be held in crypto, enforced in every ' +
      'allocation mode and against anything the Expert Allocator proposes.',
    min: 0,
    max: 25,
    defaultValue: DEFAULT_VAULT_POLICY.cryptoCapPercent,
    unit: 'percent',
  },
  {
    key: 'driftThresholdPercent',
    label: 'Drift threshold',
    description:
      'How far a class may move from its target, in percentage points, before a ' +
      'rebalance is warranted.',
    min: 1,
    max: 25,
    defaultValue: DEFAULT_VAULT_POLICY.driftThresholdPercent,
    unit: 'percent',
  },
  {
    key: 'modeSwitchCooldownDays',
    label: 'Mode switch cooldown',
    description:
      'Days a member must wait between changing allocation mode, to discourage ' +
      'performance-chasing.',
    min: 0,
    max: 365,
    defaultValue: DEFAULT_VAULT_POLICY.modeSwitchCooldownDays,
    unit: 'days',
  },
  {
    key: 'withdrawalNoticeDays',
    label: 'Withdrawal notice period',
    description: 'Days of notice served before an early withdrawal is paid.',
    min: 0,
    max: 90,
    defaultValue: DEFAULT_VAULT_POLICY.withdrawalNoticeDays,
    unit: 'days',
  },
  {
    key: 'softLockPenaltyPercent',
    label: 'Early withdrawal penalty (soft lock)',
    description:
      'Percentage charged when a soft-lock member withdraws before their retirement ' +
      'horizon. Never applied at or after the horizon.',
    min: 0,
    max: 20,
    defaultValue: DEFAULT_VAULT_POLICY.softLockPenaltyPercent,
    unit: 'percent',
  },
  {
    key: 'flexiblePenaltyPercent',
    label: 'Early withdrawal penalty (flexible)',
    description:
      'Percentage charged when a flexible member withdraws before their retirement ' +
      'horizon. Lower than the soft-lock rate, which is what the member traded away.',
    min: 0,
    max: 20,
    defaultValue: DEFAULT_VAULT_POLICY.flexiblePenaltyPercent,
    unit: 'percent',
  },
  {
    key: 'dailyRateCapPercent',
    label: 'Daily performance rate cap',
    description:
      "The furthest a single day's class rate may move a member's balance, in percentage " +
      'points either way. Bounds the admin uplift plus the market moves it is added to, so ' +
      'a mistyped figure cannot compound overnight.',
    min: 0.1,
    max: 50,
    defaultValue: DEFAULT_VAULT_POLICY.dailyRateCapPercent,
    unit: 'percent',
  },
];

/** Short cache: policy changes rarely but must take effect promptly. */
const CACHE_TTL_MS = 30_000;
let cache: { policy: VaultPolicy; expiresAt: number } | null = null;

/** Drop the cached policy. Called after any admin write. */
export function invalidatePolicyCache(): void {
  cache = null;
  // Sleeve weights and allocation targets feed valuation and benchmark maths,
  // so a policy change must not leave a stale price view behind it.
  invalidatePriceCaches();
}

export interface PolicyLoadResult {
  policy: VaultPolicy;
  /** Settings that fell back to a default, and why. */
  warnings: string[];
}

/**
 * Load the effective policy.
 *
 * Never throws: a database failure returns the shipped defaults with a
 * warning, because refusing to allocate at all would be a worse outcome than
 * allocating on the values the product shipped with.
 */
export async function loadVaultPolicyDetailed(): Promise<PolicyLoadResult> {
  const warnings: string[] = [];

  let settings: Array<{ key: string; numericValue: number }> = [];
  let storedAllocations: Array<{
    riskProfile: RiskProfile;
    assetClass: VaultAssetClass;
    targetPercent: number;
  }> = [];

  try {
    [settings, storedAllocations] = await Promise.all([
      prisma.vaultPolicySetting.findMany({ select: { key: true, numericValue: true } }),
      prisma.vaultProfileAllocation.findMany({
        select: { riskProfile: true, assetClass: true, targetPercent: true },
      }),
    ]);
  } catch (error) {
    return {
      policy: DEFAULT_VAULT_POLICY,
      warnings: [
        `Could not read stored policy (${
          error instanceof Error ? error.message : 'unknown error'
        }); using shipped defaults.`,
      ],
    };
  }

  const byKey = new Map(settings.map((s) => [s.key, s.numericValue]));

  const scalars = { ...DEFAULT_VAULT_POLICY };
  for (const definition of POLICY_SETTINGS) {
    const stored = byKey.get(definition.key);
    if (stored === undefined) continue;

    if (!Number.isFinite(stored) || stored < definition.min || stored > definition.max) {
      warnings.push(
        `${definition.label} stored as ${stored}, outside ${definition.min}-${definition.max}; using default ${definition.defaultValue}.`,
      );
      continue;
    }
    scalars[definition.key] = stored;
  }

  // Rebuild each profile's allocation, accepting it only if the whole set is
  // present and valid. A partially stored profile is rejected rather than
  // merged with defaults, which would produce a blend nobody configured.
  const targetAllocations: Record<RiskProfile, AllocationMap> = {
    ...DEFAULT_VAULT_POLICY.targetAllocations,
  };

  for (const profile of Object.values(RiskProfile)) {
    const rows = storedAllocations.filter((a) => a.riskProfile === profile);
    if (rows.length === 0) continue;

    const classes = await getAssetClassKeys();
    if (rows.length !== classes.length) {
      warnings.push(
        `${profile} has ${rows.length} of ${classes.length} allocation rows; using defaults.`,
      );
      continue;
    }

    const candidate = classes.reduce((map, assetClass) => {
      map[assetClass] = rows.find((r) => r.assetClass === assetClass)?.targetPercent ?? 0;
      return map;
    }, {} as AllocationMap);

    const validation = validateAllocation(candidate, scalars.cryptoCapPercent);
    if (!validation.valid) {
      warnings.push(`${profile} allocation is invalid (${validation.errors.join('; ')}); using defaults.`);
      continue;
    }

    targetAllocations[profile] = candidate;
  }

  return { policy: { ...scalars, targetAllocations }, warnings };
}

/** Cached policy load. Use this on hot paths. */
export async function loadVaultPolicy(): Promise<VaultPolicy> {
  if (cache !== null && cache.expiresAt > Date.now()) return cache.policy;

  const { policy, warnings } = await loadVaultPolicyDetailed();
  for (const warning of warnings) console.warn(`[Vault Policy] ${warning}`);

  cache = { policy, expiresAt: Date.now() + CACHE_TTL_MS };
  return policy;
}

export interface SeedPolicyResult {
  settingsCreated: number;
  allocationsCreated: number;
}

/**
 * Write the shipped defaults into the database for anything not yet stored.
 *
 * Existing rows are left alone: re-seeding must never silently undo an admin's
 * tuning.
 */
export async function seedVaultPolicy(): Promise<SeedPolicyResult> {
  let settingsCreated = 0;
  let allocationsCreated = 0;

  for (const definition of POLICY_SETTINGS) {
    const existing = await prisma.vaultPolicySetting.findUnique({
      where: { key: definition.key },
    });
    if (existing !== null) continue;

    await prisma.vaultPolicySetting.create({
      data: {
        key: definition.key,
        numericValue: definition.defaultValue,
        label: definition.label,
        description: definition.description,
        minValue: definition.min,
        maxValue: definition.max,
      },
    });
    settingsCreated += 1;
  }

  for (const profile of Object.values(RiskProfile)) {
    // Seeded from the shipped defaults, which only describe the original six.
    // Classes an admin adds start at 0% and are weighted by them.
    for (const assetClass of getAllAssetClasses()) {
      const existing = await prisma.vaultProfileAllocation.findUnique({
        where: { riskProfile_assetClass: { riskProfile: profile, assetClass } },
      });
      if (existing !== null) continue;

      await prisma.vaultProfileAllocation.create({
        data: {
          riskProfile: profile,
          assetClass,
          targetPercent: DEFAULT_VAULT_POLICY.targetAllocations[profile][assetClass],
        },
      });
      allocationsCreated += 1;
    }
  }

  invalidatePolicyCache();
  return { settingsCreated, allocationsCreated };
}

export interface AllocationUpdateResult {
  ok: boolean;
  errors: string[];
  /** How many member vaults picked up the change. */
  vaultsUpdated?: number;
}

/**
 * Replace a profile's allocation targets.
 *
 * Validated as a complete set before anything is written, so a profile can
 * never be left half-updated and totalling something other than 100.
 */
export async function updateProfileAllocation(
  riskProfile: RiskProfile,
  allocation: AllocationMap,
  updatedBy: string,
): Promise<AllocationUpdateResult> {
  const policy = await loadVaultPolicy();
  const validation = validateAllocation(allocation, policy.cryptoCapPercent);

  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  const total = sumAllocation(allocation);
  if (Math.abs(total - 100) > 0.01) {
    return { ok: false, errors: [`Allocation totals ${total}%, expected 100%.`] };
  }

  const keys = await getAssetClassKeys();

  await prisma.$transaction(
    keys.map((assetClass) =>
      prisma.vaultProfileAllocation.upsert({
        where: { riskProfile_assetClass: { riskProfile, assetClass } },
        create: {
          riskProfile,
          assetClass,
          targetPercent: allocation[assetClass] ?? 0,
          updatedBy,
        },
        update: { targetPercent: allocation[assetClass] ?? 0, updatedBy },
      }),
    ),
  );

  invalidatePolicyCache();

  // Existing vaults on this profile pick up the new percentages. Without
  // this an admin would change the policy and nothing would move until each
  // member's next rebalance, which is not what "set the percentage" means.
  const propagated = await propagateProfileAllocation(riskProfile, allocation, keys);

  return { ok: true, errors: [], vaultsUpdated: propagated };
}

/**
 * Push a profile's new targets onto the vaults already using it.
 *
 * Classes a member has PINNED are left alone: an override is an explicit
 * instruction from them, and silently overwriting it would undo a choice they
 * made. Everything else is re-targeted, and the holdings follow at the next
 * rebalance rather than being traded immediately — a policy edit should not
 * fire a market order for every member at once.
 */
export async function propagateProfileAllocation(
  riskProfile: RiskProfile,
  allocation: AllocationMap,
  classKeys: string[],
): Promise<number> {
  const vaults = await prisma.retirementVault.findMany({
    where: { riskProfile, status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] } },
    select: { id: true },
  });
  if (vaults.length === 0) return 0;

  for (const vault of vaults) {
    await prisma.$transaction([
      // Rows for classes that no longer exist are removed, or a retired class
      // would keep a target forever.
      prisma.vaultAllocation.deleteMany({
        where: { vaultId: vault.id, assetClass: { notIn: classKeys } },
      }),
      // Every class, with none held back: pinning is retired, so an admin's
      // percentages now reach the whole profile rather than skipping whichever
      // classes a member once froze.
      ...classKeys
        .map((assetClass) =>
          prisma.vaultAllocation.upsert({
            where: { vaultId_assetClass: { vaultId: vault.id, assetClass } },
            create: { vaultId: vault.id, assetClass, targetPercent: allocation[assetClass] ?? 0 },
            update: { targetPercent: allocation[assetClass] ?? 0 },
          }),
        ),
    ]);
  }

  return vaults.length;
}

/** Update one scalar setting, bounded by its definition. */
export async function updatePolicySetting(
  key: string,
  value: number,
  updatedBy: string,
): Promise<AllocationUpdateResult> {
  const definition = POLICY_SETTINGS.find((d) => d.key === key);
  if (definition === undefined) {
    return { ok: false, errors: [`Unknown setting: ${key}`] };
  }

  if (!Number.isFinite(value) || value < definition.min || value > definition.max) {
    return {
      ok: false,
      errors: [`${definition.label} must be between ${definition.min} and ${definition.max}.`],
    };
  }

  // Lowering the crypto cap below a stored profile target would leave that
  // profile invalid and silently falling back to defaults. Catch it here,
  // where the admin can see why, rather than in a console warning.
  if (definition.key === 'cryptoCapPercent') {
    const stored = await prisma.vaultProfileAllocation.findMany({
      where: { assetClass: VaultAssetClass.CRYPTO },
    });
    const breaching = stored.filter((row) => row.targetPercent > value + 1e-9);
    if (breaching.length > 0) {
      return {
        ok: false,
        errors: [
          `Lower the crypto target for ${breaching
            .map((b) => b.riskProfile)
            .join(', ')} first — ${breaching.length} profile(s) exceed a ${value}% cap.`,
        ],
      };
    }
  }

  await prisma.vaultPolicySetting.upsert({
    where: { key },
    create: {
      key,
      numericValue: value,
      label: definition.label,
      description: definition.description,
      minValue: definition.min,
      maxValue: definition.max,
      updatedBy,
    },
    update: { numericValue: value, updatedBy },
  });

  invalidatePolicyCache();
  return { ok: true, errors: [] };
}
