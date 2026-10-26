import { VaultAssetClass } from '@/lib/vault/asset-classes';
import { isValidAssetClass } from '@/lib/vault/asset-class-store';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getOpenVaultForUser } from '@/lib/vault/vault-utils';
import { loadVaultPolicy } from '@/lib/vault/policy-store';
import { getStoredHistoryDays, MIN_HISTORY_DAYS } from '@/lib/vault/signals';

export const dynamic = 'force-dynamic';

/** Rebalance history and the member's current pinned allocations. */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const vault = await getOpenVaultForUser(auth.user.userId);
    if (vault === null) {
      return NextResponse.json({ success: false, error: 'No vault found.' }, { status: 404 });
    }

    const [events, allocations, history] = await Promise.all([
      prisma.vaultRebalanceEvent.findMany({
        where: { vaultId: vault.id },
        orderBy: { proposedAt: 'desc' },
        take: 20,
        include: { changes: true },
      }),
      prisma.vaultAllocation.findMany({ where: { vaultId: vault.id } }),
      getStoredHistoryDays(),
    ]);

    return NextResponse.json({
      success: true,
      expertAllocatorActive: vault.expertAllocatorActive,
      allocationMode: vault.allocationMode,
      // Surfaced so the member is told why the allocator is not tilting yet,
      // rather than assuming it is broken.
      signalsAvailable: history.days >= MIN_HISTORY_DAYS,
      historyDays: history.days,
      historyRequired: MIN_HISTORY_DAYS,
      pinnedClasses: allocations
        .filter((a) => a.isUserOverride)
        .map((a) => ({ assetClass: a.assetClass, targetPercent: a.targetPercent })),
      events: events.map((e) => ({
        id: e.id,
        trigger: e.trigger,
        status: e.status,
        explanation: e.explanation,
        maxDriftPercent: e.maxDriftPercent,
        valueAtExecution: e.valueAtExecution,
        executedAt: e.executedAt,
        proposedAt: e.proposedAt,
        changes: e.changes.map((c) => ({
          assetClass: c.assetClass,
          fromPercent: c.fromPercent,
          toPercent: c.toPercent,
          valueDelta: c.valueDelta,
        })),
      })),
    });
  } catch (error) {
    console.error('[Vault Rebalances] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load rebalance history.' },
      { status: 500 },
    );
  }
}

/**
 * Pin or unpin a single asset class.
 *
 * Pinning does NOT switch Expert mode off — the allocator keeps running and
 * works around the pinned class, which is what the product requires.
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const vault = await getOpenVaultForUser(auth.user.userId);
    if (vault === null) {
      return NextResponse.json({ success: false, error: 'No vault found.' }, { status: 404 });
    }

    const body = (await request.json()) as {
      assetClass?: string;
      targetPercent?: number;
      pinned?: boolean;
    };

    if (!(await isValidAssetClass(body.assetClass))) {
      return NextResponse.json(
        { success: false, error: 'Unknown asset class.' },
        { status: 400 },
      );
    }
    const assetClass = body.assetClass as VaultAssetClass;

    // Unpin: hand the class back to the allocator.
    if (body.pinned === false) {
      await prisma.vaultAllocation.update({
        where: { vaultId_assetClass: { vaultId: vault.id, assetClass } },
        data: { isUserOverride: false, overriddenAt: null },
      });
      return NextResponse.json({ success: true, pinned: false, assetClass });
    }

    const percent = Number(body.targetPercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return NextResponse.json(
        { success: false, error: 'Target must be between 0 and 100.' },
        { status: 400 },
      );
    }

    // The cap applies to a member override exactly as it applies to the
    // allocator. Rejected with a clear message rather than silently clamped,
    // so the member is not shown a number they did not choose.
    const policy = await loadVaultPolicy();
    if (assetClass === VaultAssetClass.CRYPTO && percent > policy.cryptoCapPercent) {
      return NextResponse.json(
        {
          success: false,
          error: `Crypto is capped at ${policy.cryptoCapPercent}% and cannot be pinned above it.`,
        },
        { status: 400 },
      );
    }

    // Pinning everything would leave the allocator nothing to balance with.
    const existing = await prisma.vaultAllocation.findMany({ where: { vaultId: vault.id } });
    const otherPinned = existing.filter((a) => a.isUserOverride && a.assetClass !== assetClass);
    const pinnedTotal = otherPinned.reduce((s, a) => s + a.targetPercent, 0) + percent;

    if (pinnedTotal > 100.01) {
      return NextResponse.json(
        {
          success: false,
          error: `Your pinned allocations would total ${pinnedTotal.toFixed(1)}%. Unpin something first.`,
        },
        { status: 400 },
      );
    }

    if (otherPinned.length + 1 >= existing.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'At least one asset class must stay unpinned so the allocator can rebalance.',
        },
        { status: 400 },
      );
    }

    await prisma.vaultAllocation.update({
      where: { vaultId_assetClass: { vaultId: vault.id, assetClass } },
      data: { targetPercent: percent, isUserOverride: true, overriddenAt: new Date() },
    });

    return NextResponse.json({ success: true, pinned: true, assetClass, targetPercent: percent });
  } catch (error) {
    console.error('[Vault Rebalances] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not update your allocation.' },
      { status: 500 },
    );
  }
}
