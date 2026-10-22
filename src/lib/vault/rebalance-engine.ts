import {
  AllocationMode,
  Prisma,
  RebalanceStatus,
  RebalanceTrigger,
  VaultAssetClass,
  VaultStatus,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  AllocationMap,
  VaultPolicy,
  computeDrift,
  enforceCryptoCap,
  getAllAssetClasses,
  getTargetAllocation,
  normaliseTo100,
  sumAllocation,
} from './allocation-model';
import { loadVaultPolicy } from './policy-store';
import { SignalSet, computeSignals } from './signals';
import { valueVault } from './valuation';

/**
 * The Expert Allocator.
 *
 * A rules-based engine that tilts a vault's target allocation in response to
 * market signals, rebalances it back to target, and explains itself in plain
 * English. It is deliberately conservative:
 *
 *   - Tilts are BOUNDED. No class may move more than MAX_TILT_POINTS from the
 *     member's profile target, so a run of strong signals cannot quietly turn
 *     a Conservative vault into a Growth one.
 *   - The crypto cap is applied last, to the final allocation, so no
 *     combination of tilts can breach it.
 *   - Member overrides are honoured exactly and the engine works around them.
 *   - With insufficient price history the engine does NOT tilt at all. It
 *     rebalances to the plain target and says why.
 */

/** Maximum a single class may be tilted from its profile target. */
export const MAX_TILT_POINTS = 5;

/** How much a one-standard "strong" signal moves a class, in points. */
const TILT_STEP_POINTS = 2.5;

/** Quarterly cadence for scheduled rebalances. */
export const REBALANCE_INTERVAL_DAYS = 90;

export interface ProposedChange {
  assetClass: VaultAssetClass;
  fromPercent: number;
  toPercent: number;
  /** Cash value moving into (+) or out of (-) the class. */
  valueDelta: number;
  reason: string;
}

export interface RebalanceProposal {
  vaultId: string;
  trigger: RebalanceTrigger;
  /** False when there is nothing worth doing. */
  actionable: boolean;
  skipReason?: string;
  currentAllocation: AllocationMap;
  baseTarget: AllocationMap;
  proposedTarget: AllocationMap;
  changes: ProposedChange[];
  maxDriftPercent: number;
  portfolioValue: number;
  explanation: string;
  signals: SignalSet;
  pinnedClasses: VaultAssetClass[];
}

/**
 * Tilt a base target according to the signals.
 *
 * Each rule expresses a defensible relationship, not a prediction. Rising
 * rates hurt long-duration bonds; inflation pressure favours real assets;
 * strong equity momentum is partially faded rather than chased, because
 * buying what has already run is how retirement money gets hurt.
 */
function applyTilts(
  base: AllocationMap,
  signals: SignalSet,
): { tilted: AllocationMap; reasons: Partial<Record<VaultAssetClass, string>> } {
  const tilted = { ...base };
  const reasons: Partial<Record<VaultAssetClass, string>> = {};

  if (!signals.sufficientHistory) return { tilted, reasons };

  const move = (assetClass: VaultAssetClass, points: number, reason: string) => {
    const target = base[assetClass];
    // Never tilt a class that the profile excludes entirely: a Conservative
    // vault targets 0% futures and should not acquire some through a tilt.
    if (target <= 0) return;

    const bounded = Math.max(-MAX_TILT_POINTS, Math.min(MAX_TILT_POINTS, points));
    const next = Math.max(0, target + bounded);
    if (Math.abs(next - tilted[assetClass]) < 1e-9) return;

    tilted[assetClass] = next;
    reasons[assetClass] = reason;
  };

  // Rising rates depress bond prices; trim duration and favour real assets.
  if (signals.rateEnvironment?.direction === 'positive') {
    move(
      VaultAssetClass.FIXED_INCOME,
      -TILT_STEP_POINTS,
      'bond exposure reduced because rising rates depress bond prices',
    );
    move(
      VaultAssetClass.REAL_ESTATE,
      TILT_STEP_POINTS / 2,
      'real estate increased as a partial offset to bond weakness',
    );
  } else if (signals.rateEnvironment?.direction === 'negative') {
    move(
      VaultAssetClass.FIXED_INCOME,
      TILT_STEP_POINTS,
      'bond exposure increased because an easing rate environment supports bond prices',
    );
  }

  // Market-priced inflation pressure favours metals.
  if (signals.inflationPressure?.direction === 'positive') {
    move(
      VaultAssetClass.COMMODITIES,
      TILT_STEP_POINTS,
      'commodity exposure increased on elevated inflation signals',
    );
  } else if (signals.inflationPressure?.direction === 'negative') {
    move(
      VaultAssetClass.COMMODITIES,
      -TILT_STEP_POINTS / 2,
      'commodity exposure trimmed as inflation signals eased',
    );
  }

  // Fade extremes in equities rather than chase them.
  if (signals.equityMomentum?.direction === 'positive') {
    move(
      VaultAssetClass.GLOBAL_EQUITIES,
      -TILT_STEP_POINTS / 2,
      'equity exposure trimmed slightly after a strong run, to lock in gains rather than chase them',
    );
  } else if (signals.equityMomentum?.direction === 'negative') {
    move(
      VaultAssetClass.GLOBAL_EQUITIES,
      TILT_STEP_POINTS / 2,
      'equity exposure increased modestly to buy into weakness',
    );
  }

  if (signals.commodityCycle?.direction === 'positive') {
    move(
      VaultAssetClass.FUTURES_MACRO,
      TILT_STEP_POINTS / 2,
      'macro/futures exposure increased as the commodity complex advanced',
    );
  }

  return { tilted, reasons };
}

/**
 * Re-impose member overrides on a tilted allocation.
 *
 * A pinned class is held exactly where the member put it and the engine
 * redistributes around it. This is what lets someone override one allocation
 * without leaving Expert mode.
 */
function honourOverrides(
  tilted: AllocationMap,
  overrides: Map<VaultAssetClass, number>,
): AllocationMap {
  if (overrides.size === 0) return tilted;

  const result = { ...tilted };
  let pinnedTotal = 0;
  for (const [assetClass, value] of overrides) {
    result[assetClass] = value;
    pinnedTotal += value;
  }

  const free = getAllAssetClasses().filter((c) => !overrides.has(c));
  const freeTotal = free.reduce((sum, c) => sum + tilted[c], 0);
  const remainder = Math.max(0, 100 - pinnedTotal);

  for (const assetClass of free) {
    result[assetClass] =
      freeTotal > 0
        ? remainder * (tilted[assetClass] / freeTotal)
        : free.length > 0
          ? remainder / free.length
          : 0;
  }

  return result;
}

/** Build the member-facing narrative for a rebalance. */
function buildExplanation(params: {
  signals: SignalSet;
  changes: ProposedChange[];
  trigger: RebalanceTrigger;
  pinned: VaultAssetClass[];
}): string {
  const { signals, changes, trigger, pinned } = params;

  const opener =
    trigger === RebalanceTrigger.DRIFT_THRESHOLD
      ? 'Your allocation had drifted beyond its tolerance, so we brought it back into line.'
      : trigger === RebalanceTrigger.QUARTERLY
        ? 'This is your scheduled quarterly review.'
        : 'Your vault was realigned to its target allocation.';

  if (!signals.sufficientHistory) {
    return `${opener} ${signals.note ?? ''}`.trim();
  }

  const readings = [
    signals.rateEnvironment,
    signals.inflationPressure,
    signals.equityMomentum,
    signals.commodityCycle,
  ]
    .filter((s): s is NonNullable<typeof s> => s !== null && s.direction !== 'neutral')
    .map((s) => s.reading);

  const context =
    readings.length > 0
      ? `Over the past quarter, ${readings.join('; ')}.`
      : 'Market signals were broadly neutral this quarter.';

  // Each change is stated as "X from a% to b% because ...", which is the shape
  // the product spec asks for.
  const moves = changes
    .filter((c) => Math.abs(c.toPercent - c.fromPercent) >= 0.05)
    .sort((a, b) => Math.abs(b.toPercent - b.fromPercent) - Math.abs(a.toPercent - a.fromPercent))
    .slice(0, 4)
    .map((c) => {
      const label = c.assetClass.replace(/_/g, ' ').toLowerCase();
      // Verb first so the sentence reads "We reduced fixed income from ...",
      // not "We fixed income reduced from ...".
      const verb = c.toPercent > c.fromPercent ? 'increased' : 'reduced';
      return `${verb} ${label} from ${c.fromPercent.toFixed(1)}% to ${c.toPercent.toFixed(1)}%${
        c.reason ? ` — ${c.reason}` : ''
      }`;
    });

  const movesText =
    moves.length > 0
      ? `We ${moves.join('; ')}.`
      : 'No allocation changes were needed.';

  const pinnedText =
    pinned.length > 0
      ? ` Your pinned allocation${pinned.length > 1 ? 's' : ''} (${pinned
          .map((p) => p.replace(/_/g, ' ').toLowerCase())
          .join(', ')}) ${pinned.length > 1 ? 'were' : 'was'} left untouched.`
      : '';

  return `${opener} ${context} ${movesText}${pinnedText}`;
}

/**
 * Propose a rebalance without writing anything.
 *
 * Returns actionable=false when nothing meaningful would change, so a
 * scheduled run over many vaults does not litter the log with no-op events.
 */
export async function proposeRebalance(
  vaultId: string,
  trigger: RebalanceTrigger,
  options: { policy?: VaultPolicy; signals?: SignalSet; asOf?: Date } = {},
): Promise<RebalanceProposal | null> {
  const asOf = options.asOf ?? new Date();

  const vault = await prisma.retirementVault.findUnique({
    where: { id: vaultId },
    include: { allocations: true },
  });
  if (vault === null) return null;

  const policy = options.policy ?? (await loadVaultPolicy());
  const signals = options.signals ?? (await computeSignals(asOf));
  const valuation = await valueVault(vaultId, asOf);

  const baseTarget = getTargetAllocation(
    {
      riskProfile: vault.riskProfile,
      mode: vault.allocationMode,
      focusedAssetClass: vault.focusedAssetClass,
    },
    policy,
  );

  const overrides = new Map<VaultAssetClass, number>();
  for (const row of vault.allocations) {
    if (row.isUserOverride) overrides.set(row.assetClass, row.targetPercent);
  }

  // Only Expert mode tilts. Other modes rebalance back to their plain target.
  const { tilted, reasons } =
    vault.allocationMode === AllocationMode.EXPERT_ALLOCATOR || vault.expertAllocatorActive
      ? applyTilts(baseTarget, signals)
      : { tilted: { ...baseTarget }, reasons: {} as Partial<Record<VaultAssetClass, string>> };

  const withOverrides = honourOverrides(tilted, overrides);

  // Cap applied LAST, to the final allocation, so no combination of tilts and
  // overrides can breach it.
  const proposedTarget = enforceCryptoCap(
    normaliseTo100(withOverrides),
    policy.cryptoCapPercent,
  );

  const currentAllocation: AllocationMap =
    valuation !== null && valuation.holdingsValue > 0
      ? valuation.currentAllocation
      : getAllAssetClasses().reduce((map, c) => {
          map[c] = vault.allocations.find((a) => a.assetClass === c)?.targetPercent ?? 0;
          return map;
        }, {} as AllocationMap);

  const portfolioValue = valuation?.holdingsValue ?? 0;
  const drift = computeDrift(proposedTarget, currentAllocation, policy.driftThresholdPercent);

  const changes: ProposedChange[] = getAllAssetClasses()
    .map((assetClass) => ({
      assetClass,
      fromPercent: currentAllocation[assetClass],
      toPercent: proposedTarget[assetClass],
      valueDelta:
        (portfolioValue * (proposedTarget[assetClass] - currentAllocation[assetClass])) / 100,
      reason: reasons[assetClass] ?? '',
    }))
    .filter((c) => Math.abs(c.toPercent - c.fromPercent) >= 0.05);

  const pinnedClasses = [...overrides.keys()];

  const explanation = buildExplanation({ signals, changes, trigger, pinned: pinnedClasses });

  // Nothing to do when the vault holds nothing, or is already on target.
  let actionable = true;
  let skipReason: string | undefined;

  if (portfolioValue <= 0) {
    actionable = false;
    skipReason = 'Vault holds no investments to rebalance.';
  } else if (changes.length === 0) {
    actionable = false;
    skipReason = 'Allocation already matches target.';
  } else if (trigger === RebalanceTrigger.DRIFT_THRESHOLD && !drift.rebalanceRequired) {
    actionable = false;
    skipReason = `Maximum drift ${drift.maxAbsoluteDrift.toFixed(2)} pts is within tolerance.`;
  }

  return {
    vaultId,
    trigger,
    actionable,
    skipReason,
    currentAllocation,
    baseTarget,
    proposedTarget,
    changes,
    maxDriftPercent: drift.maxAbsoluteDrift,
    portfolioValue,
    explanation,
    signals,
    pinnedClasses,
  };
}

export interface RebalanceResult {
  applied: boolean;
  eventId: string | null;
  reason?: string;
}

/**
 * Apply a proposal: move the holdings and record the event.
 *
 * Rebalancing is value-neutral — nothing is deposited or withdrawn. Units are
 * sold in overweight classes and bought in underweight ones so the totals
 * match, which is why the whole thing sits in one transaction.
 */
export async function applyRebalance(
  proposal: RebalanceProposal,
  asOf: Date = new Date(),
): Promise<RebalanceResult> {
  if (!proposal.actionable) {
    return { applied: false, eventId: null, reason: proposal.skipReason };
  }

  const valuation = await valueVault(proposal.vaultId, asOf);
  if (valuation === null || !valuation.complete) {
    return {
      applied: false,
      eventId: null,
      reason: 'Vault cannot be valued; rebalance skipped rather than executed on stale prices.',
    };
  }

  const assets = await prisma.vaultAsset.findMany({
    where: { isActive: true, role: { not: 'BENCHMARK' } },
  });

  // Target value per instrument: class target x sleeve weight within class.
  const targetValueByAsset = new Map<string, number>();
  for (const assetClass of getAllAssetClasses()) {
    const classValue = (valuation.holdingsValue * proposal.proposedTarget[assetClass]) / 100;
    const classAssets = assets.filter((a) => a.assetClass === assetClass);
    const weightTotal = classAssets.reduce((s, a) => s + a.sleeveWeight, 0);

    for (const asset of classAssets) {
      const share =
        weightTotal > 0 ? asset.sleeveWeight / weightTotal : 1 / Math.max(1, classAssets.length);
      targetValueByAsset.set(asset.id, classValue * share);
    }
  }

  const priceByAsset = new Map(valuation.holdings.map((h) => [h.assetId, h.price]));
  const costBasisByAsset = new Map(valuation.holdings.map((h) => [h.assetId, h.costBasis]));
  const unitsByAsset = new Map(valuation.holdings.map((h) => [h.assetId, h.units]));

  const eventId = await prisma.$transaction(
    async (tx) => {
      const event = await tx.vaultRebalanceEvent.create({
        data: {
          vaultId: proposal.vaultId,
          trigger: proposal.trigger,
          status: RebalanceStatus.APPLIED,
          explanation: proposal.explanation,
          signals: JSON.stringify({
            sufficientHistory: proposal.signals.sufficientHistory,
            historyDays: proposal.signals.historyDays,
            note: proposal.signals.note,
            equityMomentum: proposal.signals.equityMomentum,
            rateEnvironment: proposal.signals.rateEnvironment,
            inflationPressure: proposal.signals.inflationPressure,
            commodityCycle: proposal.signals.commodityCycle,
          }),
          maxDriftPercent: proposal.maxDriftPercent,
          valueAtExecution: valuation.holdingsValue,
          executedAt: new Date(),
        },
      });

      await tx.vaultRebalanceChange.createMany({
        data: proposal.changes.map((c) => ({
          eventId: event.id,
          assetClass: c.assetClass,
          fromPercent: c.fromPercent,
          toPercent: c.toPercent,
          valueDelta: c.valueDelta,
        })),
      });

      // Move the holdings to their target values.
      const existing = await tx.vaultHolding.findMany({ where: { vaultId: proposal.vaultId } });
      const existingByAsset = new Map(existing.map((h) => [h.assetId, h]));

      for (const asset of assets) {
        const targetValue = targetValueByAsset.get(asset.id) ?? 0;
        const price = priceByAsset.get(asset.id) ?? asset.currentPrice;
        if (price <= 0) continue;

        const targetUnits = targetValue / price;
        const currentUnits = unitsByAsset.get(asset.id) ?? 0;
        if (Math.abs(targetUnits - currentUnits) < 1e-9) continue;

        const holding = existingByAsset.get(asset.id);
        const currentCost = costBasisByAsset.get(asset.id) ?? 0;

        // Cost basis follows the units: selling releases it proportionally,
        // buying adds the cash spent. Without this, realised gain/loss on a
        // later withdrawal would be wrong.
        let newCostBasis: number;
        if (targetUnits < currentUnits && currentUnits > 0) {
          newCostBasis = currentCost * (targetUnits / currentUnits);
        } else {
          newCostBasis = currentCost + (targetUnits - currentUnits) * price;
        }
        newCostBasis = Math.max(0, newCostBasis);

        if (holding === undefined) {
          if (targetUnits <= 0) continue;
          await tx.vaultHolding.create({
            data: {
              vaultId: proposal.vaultId,
              assetId: asset.id,
              units: targetUnits,
              costBasis: newCostBasis,
              averageCost: targetUnits > 0 ? newCostBasis / targetUnits : 0,
            },
          });
        } else {
          await tx.vaultHolding.update({
            where: { id: holding.id },
            data: {
              units: targetUnits,
              costBasis: newCostBasis,
              averageCost: targetUnits > 0 ? newCostBasis / targetUnits : 0,
            },
          });
        }
      }

      // Store the new targets so the dashboard and drift checks agree with
      // what the engine just did. Pinned classes keep their override flag.
      for (const assetClass of getAllAssetClasses()) {
        await tx.vaultAllocation.upsert({
          where: {
            vaultId_assetClass: { vaultId: proposal.vaultId, assetClass },
          },
          create: {
            vaultId: proposal.vaultId,
            assetClass,
            targetPercent: proposal.proposedTarget[assetClass],
            isUserOverride: proposal.pinnedClasses.includes(assetClass),
          },
          update: { targetPercent: proposal.proposedTarget[assetClass] },
        });
      }

      return event.id;
    },
    { timeout: 25_000, maxWait: 15_000 },
  );

  return { applied: true, eventId };
}

export interface BatchRebalanceResult {
  considered: number;
  applied: number;
  skipped: number;
  failures: Array<{ vaultId: string; reason: string }>;
}

/**
 * Run the allocator across every eligible vault.
 *
 * A vault is due when it has never been rebalanced and is older than the
 * interval, when the interval has elapsed since its last rebalance, or when
 * drift has breached tolerance at any time.
 */
export async function runScheduledRebalances(
  asOf: Date = new Date(),
): Promise<BatchRebalanceResult> {
  const [policy, signals] = await Promise.all([loadVaultPolicy(), computeSignals(asOf)]);

  const vaults = await prisma.retirementVault.findMany({
    where: { status: VaultStatus.ACTIVE },
    select: { id: true, activatedAt: true, expertAllocatorActive: true, allocationMode: true },
  });

  const failures: Array<{ vaultId: string; reason: string }> = [];
  let applied = 0;
  let skipped = 0;

  const intervalMs = REBALANCE_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

  for (const vault of vaults) {
    try {
      const lastEvent = await prisma.vaultRebalanceEvent.findFirst({
        where: { vaultId: vault.id, status: RebalanceStatus.APPLIED },
        orderBy: { executedAt: 'desc' },
        select: { executedAt: true },
      });

      const since = lastEvent?.executedAt ?? vault.activatedAt;
      const quarterlyDue =
        since !== null && asOf.getTime() - since.getTime() >= intervalMs;

      // Try drift first: a vault inside its quarter can still breach.
      const trigger = quarterlyDue
        ? RebalanceTrigger.QUARTERLY
        : RebalanceTrigger.DRIFT_THRESHOLD;

      const proposal = await proposeRebalance(vault.id, trigger, { policy, signals, asOf });
      if (proposal === null) {
        failures.push({ vaultId: vault.id, reason: 'Vault not found.' });
        continue;
      }

      if (!proposal.actionable) {
        skipped += 1;
        continue;
      }

      const result = await applyRebalance(proposal, asOf);
      if (result.applied) applied += 1;
      else {
        skipped += 1;
        if (result.reason) failures.push({ vaultId: vault.id, reason: result.reason });
      }
    } catch (error) {
      failures.push({
        vaultId: vault.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { considered: vaults.length, applied, skipped, failures };
}

/** Sum helper re-exported for callers validating a proposal. */
export function proposalTotalsOneHundred(proposal: RebalanceProposal): boolean {
  return Math.abs(sumAllocation(proposal.proposedTarget) - 100) < 0.01;
}

export type { Prisma };
