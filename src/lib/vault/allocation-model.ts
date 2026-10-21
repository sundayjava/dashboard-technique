import { AllocationMode, RiskProfile, VaultAssetClass } from '@prisma/client';

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
export const MODE_SWITCH_COOLDOWN_DAYS = 30;

/** Notice period served before an early withdrawal is paid. */
export const WITHDRAWAL_NOTICE_DAYS = 14;

/**
 * Share placed in the chosen class under FOCUSED mode.
 *
 * NOTE — product decision, confirm before launch. The spec says only
 * "concentrated in one asset class". 100% would be indefensible in a
 * retirement vehicle, so this concentrates meaningfully while keeping a
 * diversified remainder. Change this one number to retune it.
 */
export const FOCUSED_CONCENTRATION_PERCENT = 60;

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

export function sumAllocation(allocation: AllocationMap): number {
  return ALL_ASSET_CLASSES.reduce((total, c) => total + allocation[c], 0);
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

  const scaled = emptyAllocation();
  for (const c of ALL_ASSET_CLASSES) {
    scaled[c] = Math.round((allocation[c] / total) * 100 * 10000) / 10000;
  }

  // Push any rounding residue into the largest non-crypto class, so the cap is
  // never breached by a correction.
  const residue = 100 - sumAllocation(scaled);
  if (residue !== 0) {
    const absorber = ALL_ASSET_CLASSES.filter((c) => c !== VaultAssetClass.CRYPTO).reduce(
      (largest, c) => (scaled[c] > scaled[largest] ? c : largest),
      VaultAssetClass.GLOBAL_EQUITIES,
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
export function enforceCryptoCap(allocation: AllocationMap): AllocationMap {
  const result = { ...allocation };
  const crypto = result[VaultAssetClass.CRYPTO];

  if (crypto <= CRYPTO_CAP_PERCENT) return result;

  const excess = crypto - CRYPTO_CAP_PERCENT;
  result[VaultAssetClass.CRYPTO] = CRYPTO_CAP_PERCENT;

  const others = ALL_ASSET_CLASSES.filter((c) => c !== VaultAssetClass.CRYPTO);
  const othersTotal = others.reduce((total, c) => total + result[c], 0);

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
export function getTargetAllocation(params: {
  riskProfile: RiskProfile;
  mode: AllocationMode;
  focusedAssetClass?: VaultAssetClass | null;
}): AllocationMap {
  const base = { ...TARGET_ALLOCATIONS[params.riskProfile] };

  if (params.mode !== AllocationMode.FOCUSED) {
    return enforceCryptoCap(base);
  }

  const focus = params.focusedAssetClass;
  if (focus === undefined || focus === null) {
    // A FOCUSED vault with no class chosen is a data error; falling back to the
    // diversified target is safer than refusing to value the vault.
    return enforceCryptoCap(base);
  }

  const result = emptyAllocation();
  result[focus] = FOCUSED_CONCENTRATION_PERCENT;

  // Spread the remainder across the other classes in their profile proportions,
  // so a focused vault still reflects the member's risk profile underneath.
  const remainder = 100 - FOCUSED_CONCENTRATION_PERCENT;
  const others = ALL_ASSET_CLASSES.filter((c) => c !== focus);
  const othersBaseTotal = others.reduce((total, c) => total + base[c], 0);

  for (const c of others) {
    result[c] =
      othersBaseTotal > 0
        ? remainder * (base[c] / othersBaseTotal)
        : remainder / others.length;
  }

  // Focusing on crypto cannot escape the cap: the concentration is clamped to
  // CRYPTO_CAP_PERCENT and the excess redistributed. Callers should warn the
  // member that a crypto-focused vault is still capped.
  return enforceCryptoCap(result);
}

export interface AllocationValidation {
  valid: boolean;
  errors: string[];
}

/** Validate an allocation before it is stored against a vault. */
export function validateAllocation(allocation: AllocationMap): AllocationValidation {
  const errors: string[] = [];

  for (const c of ALL_ASSET_CLASSES) {
    const value = allocation[c];
    if (!Number.isFinite(value)) {
      errors.push(`${c} is not a finite number.`);
    } else if (value < 0) {
      errors.push(`${c} is negative (${value}).`);
    } else if (value > 100) {
      errors.push(`${c} exceeds 100% (${value}).`);
    }
  }

  const crypto = allocation[VaultAssetClass.CRYPTO];
  if (Number.isFinite(crypto) && crypto > CRYPTO_CAP_PERCENT + 1e-9) {
    errors.push(
      `Crypto allocation ${crypto}% exceeds the hard cap of ${CRYPTO_CAP_PERCENT}%.`,
    );
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
  const drifts: ClassDrift[] = ALL_ASSET_CLASSES.map((assetClass) => {
    const targetPercent = target[assetClass];
    const currentPercent = current[assetClass];
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
): AllocationMap {
  const pinned = ALL_ASSET_CLASSES.filter((c) => overrides[c] !== undefined);
  if (pinned.length === 0) return enforceCryptoCap(proposed);

  const result = emptyAllocation();
  let pinnedTotal = 0;

  for (const c of pinned) {
    // A pinned crypto weight is still subject to the cap.
    const requested = overrides[c] as number;
    const value =
      c === VaultAssetClass.CRYPTO ? Math.min(requested, CRYPTO_CAP_PERCENT) : requested;
    result[c] = Math.max(0, Math.min(100, value));
    pinnedTotal += result[c];
  }

  const free = ALL_ASSET_CLASSES.filter((c) => overrides[c] === undefined);
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

  return enforceCryptoCap(normaliseTo100(result));
}
