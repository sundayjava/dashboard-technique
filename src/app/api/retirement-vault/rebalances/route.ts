import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getOpenVaultForUser } from '@/lib/vault/vault-utils';
import { getStoredHistoryDays, MIN_HISTORY_DAYS } from '@/lib/vault/signals';

export const dynamic = 'force-dynamic';

/**
 * Rebalance history.
 *
 * Pinning a class was removed with the Expert Allocator page: it was a control
 * almost nobody reached, and it let a member freeze an allocation the engine
 * then had to work around forever. The allocator now rebalances every class.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const vault = await getOpenVaultForUser(auth.user.userId);
    if (vault === null) {
      return NextResponse.json({ success: false, error: 'No vault found.' }, { status: 404 });
    }

    const [events, history] = await Promise.all([
      prisma.vaultRebalanceEvent.findMany({
        where: { vaultId: vault.id },
        orderBy: { proposedAt: 'desc' },
        take: 20,
        include: { changes: true },
      }),
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
