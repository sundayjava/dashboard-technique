import { NextRequest, NextResponse } from 'next/server';
import { AccountStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getOpenVaultForUser } from '@/lib/vault/vault-utils';
import { valueVault } from '@/lib/vault/valuation';
import { computeDrift } from '@/lib/vault/allocation-model';
import type { AllocationMap } from '@/lib/vault/allocation-model';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Everything the vault dashboard renders, in one request.
 *
 * Values are computed live from stored prices rather than read from a cached
 * balance, so the figure a member sees is derived the same way the nightly
 * valuation derives it. One endpoint keeps the page from fanning out into
 * half a dozen round-trips on load.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const userId = auth.user.userId;
    const vault = await getOpenVaultForUser(userId);

    if (vault === null) {
      return NextResponse.json({ success: true, hasVault: false, vault: null });
    }

    const [allocations, contributions, account, valuation] = await Promise.all([
      prisma.vaultAllocation.findMany({ where: { vaultId: vault.id } }),
      prisma.vaultContribution.findMany({
        where: { vaultId: vault.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.account.findFirst({
        where: { userId, status: AccountStatus.ACTIVE },
        orderBy: { createdAt: 'asc' },
        select: { accountNumber: true, balance: true, currency: true },
      }),
      valueVault(vault.id),
    ]);

    const targetMap = allocations.reduce((map, row) => {
      map[row.assetClass] = row.targetPercent;
      return map;
    }, {} as AllocationMap);

    // Drift only means something once there is something invested.
    const drift =
      valuation !== null && valuation.holdingsValue > 0
        ? computeDrift(targetMap, valuation.currentAllocation)
        : null;

    return NextResponse.json({
      success: true,
      hasVault: true,
      vault: {
        id: vault.id,
        vaultNumber: vault.vaultNumber,
        status: vault.status,
        riskProfile: vault.riskProfile,
        allocationMode: vault.allocationMode,
        focusedAssetClass: vault.focusedAssetClass,
        expertAllocatorActive: vault.expertAllocatorActive,
        horizon: vault.horizon,
        currency: vault.currency,
        totalContributed: vault.totalContributed,
        totalWithdrawn: vault.totalWithdrawn,
        cashBalance: vault.cashBalance,
        monthlyContribution: vault.monthlyContribution,
        lockInPreference: vault.lockInPreference,
        activatedAt: vault.activatedAt,
        createdAt: vault.createdAt,
      },
      valuation:
        valuation === null
          ? null
          : {
              totalValue: valuation.totalValue,
              holdingsValue: valuation.holdingsValue,
              cashBalance: valuation.cashBalance,
              unrealisedGainLoss: valuation.unrealisedGainLoss,
              unrealisedGainLossPercent: valuation.unrealisedGainLossPercent,
              benchmarkValue: valuation.benchmarkValue,
              currentAllocation: valuation.currentAllocation,
              complete: valuation.complete,
              missingPrices: valuation.missingPrices,
              holdings: valuation.holdings.map((h) => ({
                symbol: h.symbol,
                assetClass: h.assetClass,
                units: h.units,
                price: h.price,
                value: h.value,
                costBasis: h.costBasis,
                gainLoss: h.gainLoss,
                gainLossPercent: h.gainLossPercent,
                priceDate: h.priceDate,
              })),
            },
      targetAllocation: targetMap,
      drift:
        drift === null
          ? null
          : {
              maxAbsoluteDrift: drift.maxAbsoluteDrift,
              rebalanceRequired: drift.rebalanceRequired,
              classes: drift.drifts,
            },
      contributions: contributions.map((c) => ({
        id: c.id,
        type: c.type,
        amount: c.amount,
        status: c.status,
        processedAt: c.processedAt,
        createdAt: c.createdAt,
      })),
      fundingAccount: account,
    });
  } catch (error) {
    console.error('[Vault Dashboard] error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load your vault.' },
      { status: 500 },
    );
  }
}
