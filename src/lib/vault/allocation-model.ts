import { VaultAssetClass } from './asset-classes';
import { AllocationMode, RiskProfile } from '@prisma/client';

/**
 * Retirement Vault allocation policy.
 *
 * The product rules live here as data and pure functions, deliberately apart
 * from any database or network concern, so they can be reasoned about and
 * tested directly. Nothing in this file performs I/O.
 *
 * The central invariant is the crypto cap: no vault, in any mode, under any
 * profile, and regardless of what the Expert Allocator proposes, may hold more
 * than CRYPTO_CAP_PERCENT in crypto. Every path that produces an allocation
 * routes through `enforceCryptoCap`.
 */

/** Crypto may never exceed this share of a vault. Enforced at system level. */
export const CRYPTO_CAP_PERCENT = 5;

/**
 * A class must drift this far from target, in absolute percentage points,
 * before a drift-triggered rebalance is warranted.
 */
export const DRIFT_THRESHOLD_PERCENT = 5;

/** Cooldown on member-initiated allocation mode switches. */
export const MODE_SWITCH_COOLDOWN_DAYS = 60;

/** Notice period served before an early withdrawal is paid. */
export const WITHDRAWAL_NOTICE_DAYS = 14;

/**
 * Penalty on an EARLY withdrawal, as a percentage of the amount taken.
 *
 * Two rates because the member chose a lock-in preference at onboarding: a
 * soft lock trades access for a better targeted return, so leaving early costs
 * more. Withdrawing at or after the retirement horizon is never penalised --
 * that is the vault working as intended, not short-termism.
 */
export const SOFT_LOCK_PENALTY_PERCENT = 5;
export const FLEXIBLE_PENALTY_PERCENT = 2;

/**
 * How far a single day's class rate may travel, in percentage points either
 * way.
 *
 * The day's rate is the sum of a class's instrument moves plus an uplift an
 * admin types freely, so nothing in the formula itself bounds it. A stray
 * keystroke -- 50 where 0.5 was meant -- would compound into every member's
 * balance overnight, and that is far harder to unwind than to prevent. When
 * the clamp bites it is recorded on the day, so a limited rate is visible
 * rather than silent.
 */
export const DAILY_RATE_CAP_PERCENT = 10;

export type AllocationMap = Record<VaultAssetClass, number>;

/**
 * Target allocation by risk profile, straight from the product spec.
 * Each row totals 100 and holds crypto at exactly the cap.
 */
export const TARGET_ALLOCATIONS: Record<RiskProfile, AllocationMap> = {
  [RiskProfile.CONSERVATIVE]: {
    [VaultAssetClass.GLOBAL_EQUITIES]: 30,
    [VaultAssetClass.FIXED_INCOME]: 40,
    [VaultAssetClass.COMMODITIES]: 20,
    [VaultAssetClass.REAL_ESTATE]: 5,
    [VaultAssetClass.FUTURES_MACRO]: 0,
    [VaultAssetClass.CRYPTO]: 5,
  },
  [RiskProfile.BALANCED]: {
    [VaultAssetClass.GLOBAL_EQUITIES]: 35,
    [VaultAssetClass.FIXED_INCOME]: 25,
    [VaultAssetClass.COMMODITIES]: 20,
    [VaultAssetClass.REAL_ESTATE]: 10,
    [VaultAssetClass.FUTURES_MACRO]: 5,
    [VaultAssetClass.CRYPTO]: 5,
  },
  [RiskProfile.GROWTH]: {
    [VaultAssetClass.GLOBAL_EQUITIES]: 40,
    [VaultAssetClass.FIXED_INCOME]: 10,
    [VaultAssetClass.COMMODITIES]: 15,
    [VaultAssetClass.REAL_ESTATE]: 15,
    [VaultAssetClass.FUTURES_MACRO]: 15,
    [VaultAssetClass.CRYPTO]: 5,
  },
};

/**
 * Target annual return ranges per profile.
 *
 * PRESENTATION RULE: these are targets, not guarantees or expected returns.
 * Any surface showing them must show that alongside. They exist so the
 * dashboard can frame the 401k comparison, not to promise an outcome.
 */
export const TARGET_RETURN_RANGES: Record<
  RiskProfile,
  { minPercent: number; maxPercent: number }
> = {
  [RiskProfile.CONSERVATIVE]: { minPercent: 9, maxPercent: 11 },
  [RiskProfile.BALANCED]: { minPercent: 12, maxPercent: 14 },
  [RiskProfile.GROWTH]: { minPercent: 15, maxPercent: 18 },
};

/**
 * The tunable policy, as one object.
 *
 * Every function below takes this and defaults to DEFAULT_VAULT_POLICY, so the
 * module stays pure and synchronous while an admin-configured policy can be
 * threaded through from a caller that has loaded it. See policy-store.ts.
 */
export interface VaultPolicy {
  cryptoCapPercent: number;
  driftThresholdPercent: number;
  modeSwitchCooldownDays: number;
  withdrawalNoticeDays: number;
  softLockPenaltyPercent: number;
  flexiblePenaltyPercent: number;
  dailyRateCapPercent: number;
  targetAllocations: Record<RiskProfile, AllocationMap>;
}

/**
 * The values the product ships with.
 *
 * These are the fallback whenever stored policy is missing or unreadable. A
 * missing row must never be read as zero: a crypto cap of 0 would block every
 * allocation, and an absent cap treated as unbounded would be far worse.
 */
export const DEFAULT_VAULT_POLICY: VaultPolicy = {
  cryptoCapPercent: CRYPTO_CAP_PERCENT,
  driftThresholdPercent: DRIFT_THRESHOLD_PERCENT,
  modeSwitchCooldownDays: MODE_SWITCH_COOLDOWN_DAYS,
  withdrawalNoticeDays: WITHDRAWAL_NOTICE_DAYS,
  softLockPenaltyPercent: SOFT_LOCK_PENALTY_PERCENT,
  flexiblePenaltyPercent: FLEXIBLE_PENALTY_PERCENT,
  dailyRateCapPercent: DAILY_RATE_CAP_PERCENT,
  targetAllocations: TARGET_ALLOCATIONS,
};

const ALL_ASSET_CLASSES: VaultAssetClass[] = [
  VaultAssetClass.GLOBAL_EQUITIES,
  VaultAssetClass.FIXED_INCOME,
  VaultAssetClass.COMMODITIES,
  VaultAssetClass.REAL_ESTATE,
  VaultAssetClass.FUTURES_MACRO,
  VaultAssetClass.CRYPTO,
];

export function getAllAssetClasses(): VaultAssetClass[] {
  return [...ALL_ASSET_CLASSES];
}

function emptyAllocation(): AllocationMap {
  return {
    [VaultAssetClass.GLOBAL_EQUITIES]: 0,
    [VaultAssetClass.FIXED_INCOME]: 0,
    [VaultAssetClass.COMMODITIES]: 0,
    [VaultAssetClass.REAL_ESTATE]: 0,
    [VaultAssetClass.FUTURES_MACRO]: 0,
    [VaultAssetClass.CRYPTO]: 0,
  };
}

/**
 * Classes present in an allocation.
 *
 * Driven by the map's own keys rather than a fixed list, because an admin can
 * now add classes. Summing a fixed six silently ignored a seventh, which made
 * a perfectly valid 100% allocation report as 95% and refuse to save.
 */
function classesIn(allocation: AllocationMap): VaultAssetClass[] {
  const keys = Object.keys(allocation);
  return keys.length > 0 ? keys : ALL_ASSET_CLASSES;
}

export function sumAllocation(allocation: AllocationMap): number {
  return classesIn(allocation).reduce((total, c) => total + (allocation[c] ?? 0), 0);
}

/**
 * Scale an allocation so it totals exactly 100.
 *
 * Repeated proportional redistribution accumulates floating point error, and a
 * target set that totals 99.9999 would fail validation or leave a sliver of
 * cash permanently uninvested. Rounding to 4dp keeps stored targets tidy while
 * the final class absorbs any residue so the total is exact.
 */
export function normaliseTo100(allocation: AllocationMap): AllocationMap {
  const total = sumAllocation(allocation);
  if (total <= 0) return { ...TARGET_ALLOCATIONS[RiskProfile.BALANCED] };

  const keys = classesIn(allocation);
  const scaled: AllocationMap = {} as AllocationMap;
  for (const c of keys) {
    scaled[c] = Math.round(((allocation[c] ?? 0) / total) * 100 * 10000) / 10000;
  }

  // Push any rounding residue into the largest non-crypto class, so the cap is
  // never breached by a correction.
  const residue = 100 - sumAllocation(scaled);
  if (residue !== 0) {
    const nonCrypto = keys.filter((c) => c !== VaultAssetClass.CRYPTO);
    const absorber = nonCrypto.reduce(
      (largest, c) => ((scaled[c] ?? 0) > (scaled[largest] ?? 0) ? c : largest),
      nonCrypto[0] ?? keys[0]!,
    );
    scaled[absorber] = Math.round((scaled[absorber] + residue) * 10000) / 10000;
  }

  return scaled;
}

/**
 * Clamp crypto to the cap, redistributing any excess across the other classes
 * in proportion to their existing weights.
 *
 * This is the system-level enforcement the product requires. It is applied to
 * every allocation this module produces, including ones proposed by the Expert
 * Allocator, so the cap cannot be breached by optimisation.
 */
export function enforceCryptoCap(
  allocation: AllocationMap,
  capPercent: number = CRYPTO_CAP_PERCENT,
): AllocationMap {
  const result = { ...allocation };
  const crypto = result[VaultAssetClass.CRYPTO];

  // A non-finite or negative cap is treated as misconfiguration and the
  // shipped default is used instead of trusting it.
  const cap = Number.isFinite(capPercent) && capPercent >= 0 ? capPercent : CRYPTO_CAP_PERCENT;

  if (crypto <= cap) return result;

  const excess = crypto - cap;
  result[VaultAssetClass.CRYPTO] = cap;

  const others = classesIn(allocation).filter((c) => c !== VaultAssetClass.CRYPTO);
  const othersTotal = others.reduce((total, c) => total + (result[c] ?? 0), 0);

  if (othersTotal > 0) {
    for (const c of others) {
      result[c] += excess * (result[c] / othersTotal);
    }
  } else {
    // Degenerate case: everything was in crypto. Fall back to spreading the
    // excess evenly rather than leaving the vault unallocated.
    for (const c of others) {
      result[c] += excess / others.length;
    }
  }

  return normaliseTo100(result);
}

/**
 * The target allocation for a vault's profile and mode.
 *
 * DIVERSIFIED and EXPERT_ALLOCATOR both start from the profile table — Expert
 * mode diverges from it over time through rebalancing, but begins there.
 */
export function getTargetAllocation(
  params: {
    riskProfile: RiskProfile;
    mode: AllocationMode;
    focusedAssetClass?: VaultAssetClass | null;
  },
  policy: VaultPolicy = DEFAULT_VAULT_POLICY,
): AllocationMap {
  // Every mode now shares the same ceilings. FOCUSED does NOT concentrate the
  // target: it restricts which class the member may fund, and each class is
  // still capped at the percentage the profile (and the admin) set for it.
  //
  // The practical consequence, stated plainly because it surprises people: a
  // member focused on a class targeted at 15% can only ever invest 15% of
  // their vault, and the remaining 85% stays as cash. An admin who wants
  // concentrated vaults raises that class's percentage.
  return enforceCryptoCap(
    { ...policy.targetAllocations[params.riskProfile] },
    policy.cryptoCapPercent,
  );
}

/**
 * The classes a member may actually put money into.
 *
 * DIVERSIFIED and EXPERT_ALLOCATOR can fund anything with a target above
 * zero. FOCUSED can fund exactly one class — the one chosen at onboarding.
 */
export function getInvestableClasses(
  target: AllocationMap,
  mode: AllocationMode,
  focusedAssetClass?: VaultAssetClass | null,
  classKeys: VaultAssetClass[] = getAllAssetClasses(),
): VaultAssetClass[] {
  if (mode === AllocationMode.FOCUSED) {
    // A focused vault with no class recorded can fund nothing, rather than
    // silently behaving like a diversified one.
    if (focusedAssetClass === undefined || focusedAssetClass === null) return [];
    return classKeys.includes(focusedAssetClass) ? [focusedAssetClass] : [];
  }
  return classKeys.filter((c) => (target[c] ?? 0) > 0);
}

export interface AllocationValidation {
  valid: boolean;
  errors: string[];
}

/** Validate an allocation before it is stored against a vault. */
export function validateAllocation(
  allocation: AllocationMap,
  capPercent: number = CRYPTO_CAP_PERCENT,
): AllocationValidation {
  const errors: string[] = [];

  for (const c of classesIn(allocation)) {
    const value = allocation[c] ?? 0;
    if (!Number.isFinite(value)) {
      errors.push(`${c} is not a finite number.`);
    } else if (value < 0) {
      errors.push(`${c} is negative (${value}).`);
    } else if (value > 100) {
      errors.push(`${c} exceeds 100% (${value}).`);
    }
  }

  const crypto = allocation[VaultAssetClass.CRYPTO];
  if (Number.isFinite(crypto) && crypto > capPercent + 1e-9) {
    errors.push(`Crypto allocation ${crypto}% exceeds the hard cap of ${capPercent}%.`);
  }

  const total = sumAllocation(allocation);
  if (Math.abs(total - 100) > 0.01) {
    errors.push(`Allocation totals ${total}%, expected 100%.`);
  }

  return { valid: errors.length === 0, errors };
}

export interface ClassDrift {
  assetClass: VaultAssetClass;
  targetPercent: number;
  currentPercent: number;
  /** Signed: positive means overweight versus target. */
  driftPercent: number;
  breachesThreshold: boolean;
}

export interface DriftReport {
  drifts: ClassDrift[];
  maxAbsoluteDrift: number;
  /** True when any class has moved beyond the threshold. */
  rebalanceRequired: boolean;
}

/**
 * Compare a vault's actual weights against its targets.
 *
 * Drift is measured in absolute percentage POINTS, not relative terms: a class
 * targeted at 5% that reaches 10% has drifted 5 points. Relative measurement
 * would make small sleeves trigger constantly and large ones almost never.
 */
export function computeDrift(
  target: AllocationMap,
  current: AllocationMap,
  thresholdPercent: number = DRIFT_THRESHOLD_PERCENT,
): DriftReport {
  // Union of both sides: a class present in one but not the other still has
  // a drift, and omitting it would hide exactly the case worth catching.
  const keys = [...new Set([...Object.keys(target), ...Object.keys(current)])];
  const allKeys = keys.length > 0 ? keys : ALL_ASSET_CLASSES;

  const drifts: ClassDrift[] = allKeys.map((assetClass) => {
    const targetPercent = target[assetClass] ?? 0;
    const currentPercent = current[assetClass] ?? 0;
    const driftPercent = currentPercent - targetPercent;
    return {
      assetClass,
      targetPercent,
      currentPercent,
      driftPercent,
      breachesThreshold: Math.abs(driftPercent) >= thresholdPercent,
    };
  });

  const maxAbsoluteDrift = drifts.reduce(
    (max, d) => Math.max(max, Math.abs(d.driftPercent)),
    0,
  );

  return {
    drifts,
    maxAbsoluteDrift,
    rebalanceRequired: drifts.some((d) => d.breachesThreshold),
  };
}

export interface CooldownStatus {
  allowed: boolean;
  daysRemaining: number;
  nextAllowedAt: Date | null;
}

/**
 * Whether a member may switch allocation mode yet.
 *
 * The cooldown exists to prevent performance-chasing between modes, which is
 * the behaviour most likely to damage a retirement outcome.
 */
export function canSwitchMode(
  modeLastChangedAt: Date | null,
  now: Date = new Date(),
  cooldownDays: number = MODE_SWITCH_COOLDOWN_DAYS,
): CooldownStatus {
  if (modeLastChangedAt === null) {
    return { allowed: true, daysRemaining: 0, nextAllowedAt: null };
  }

  const nextAllowedAt = new Date(
    modeLastChangedAt.getTime() + cooldownDays * 24 * 60 * 60 * 1000,
  );

  if (now >= nextAllowedAt) {
    return { allowed: true, daysRemaining: 0, nextAllowedAt };
  }

  const msRemaining = nextAllowedAt.getTime() - now.getTime();
  return {
    allowed: false,
    // Round up: with 0.2 days left a member should be told 1 day, not 0.
    daysRemaining: Math.ceil(msRemaining / (24 * 60 * 60 * 1000)),
    nextAllowedAt,
  };
}

/**
 * Apply member overrides on top of a proposed allocation.
 *
 * Pinned classes are held exactly where the member put them and the remainder
 * is rescaled around them. This is what lets someone override a single
 * allocation without switching Expert mode off, as the product requires.
 */
export function applyOverrides(
  proposed: AllocationMap,
  overrides: Partial<Record<VaultAssetClass, number>>,
  capPercent: number = CRYPTO_CAP_PERCENT,
): AllocationMap {
  const pinned = classesIn(proposed).filter((c) => overrides[c] !== undefined);
  if (pinned.length === 0) return enforceCryptoCap(proposed, capPercent);

  const result: AllocationMap = {} as AllocationMap;
  for (const c of classesIn(proposed)) result[c] = 0;
  let pinnedTotal = 0;

  for (const c of pinned) {
    // A pinned crypto weight is still subject to the cap.
    const requested = overrides[c] as number;
    const value =
      c === VaultAssetClass.CRYPTO ? Math.min(requested, capPercent) : requested;
    result[c] = Math.max(0, Math.min(100, value));
    pinnedTotal += result[c];
  }

  const free = classesIn(proposed).filter((c) => overrides[c] === undefined);
  const remainder = Math.max(0, 100 - pinnedTotal);
  const freeProposedTotal = free.reduce((total, c) => total + proposed[c], 0);

  for (const c of free) {
    result[c] =
      freeProposedTotal > 0
        ? remainder * (proposed[c] / freeProposedTotal)
        : free.length > 0
          ? remainder / free.length
          : 0;
  }

  return enforceCryptoCap(normaliseTo100(result), capPercent);
}
