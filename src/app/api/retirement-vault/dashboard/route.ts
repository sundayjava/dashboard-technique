import { NextRequest, NextResponse } from 'next/server';
import { AccountStatus, ContributionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';
import { OPEN_VAULT_STATUSES } from '@/lib/vault/vault-utils';
import { valueVault } from '@/lib/vault/valuation';
import { getLatestClassRates } from '@/lib/vault/class-performance';
import { computeDrift } from '@/lib/vault/allocation-model';
import { loadVaultPolicy } from '@/lib/vault/policy-store';
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
    // ONE query for everything about the vault. This database multiplexes
    // through a proxy and does NOT run queries concurrently -- five trivial
    // queries in parallel measured SLOWER than five in series -- so the page
    // is fast only if it asks for less. The vault and the contributions were
    // each being fetched twice.
    const endOfDay = new Date(
      new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z').getTime() +
        24 * 60 * 60 * 1000,
    );

    const vault = await prisma.retirementVault.findFirst({
      where: { userId, status: { in: OPEN_VAULT_STATUSES } },
      orderBy: { createdAt: 'desc' },
      include: {
        holdings: { include: { asset: true } },
        allocations: true,
        contributions: { orderBy: { createdAt: 'desc' }, take: 20 },
        withdrawals: {
          where: { status: 'PAID', processedAt: { not: null, lt: endOfDay } },
          select: { netAmount: true, processedAt: true },
        },
      },
    });

    if (vault === null) {
      return NextResponse.json({ success: true, hasVault: false, vault: null });
    }

    const allocations = vault.allocations;
    const contributions = vault.contributions;

    // Settled contributions drive the benchmark; the list above is history.
    const settledContributions = contributions
      .filter((c) => c.status === ContributionStatus.COMPLETED && c.processedAt !== null)
      .map((c) => ({ amount: c.amount, processedAt: c.processedAt }))
      .sort((a, b) => (a.processedAt?.getTime() ?? 0) - (b.processedAt?.getTime() ?? 0));

    const [account, valuation, policy, classRates] = await Promise.all([
      prisma.account.findFirst({
        where: { userId, status: AccountStatus.ACTIVE },
        orderBy: { createdAt: 'asc' },
        select: { accountNumber: true, balance: true, currency: true },
      }),
      valueVault(vault.id, new Date(), {
        vault,
        contributions: settledContributions,
        withdrawals: vault.withdrawals,
      }),
      loadVaultPolicy(),
      getLatestClassRates(),
    ]);

    const targetMap = allocations.reduce((map, row) => {
      map[row.assetClass] = row.targetPercent;
      return map;
    }, {} as AllocationMap);

    // Drift only means something once there is something invested.
    const drift =
      valuation !== null && valuation.holdingsValue > 0
        ? computeDrift(targetMap, valuation.currentAllocation, policy.driftThresholdPercent)
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
              accruedPerformance: valuation.accruedPerformance,
              classValues: valuation.classValues,
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
      // The day's rate per class, and the arithmetic behind it. The breakdown
      // is included so a member can see WHICH instruments moved their money
      // rather than being handed a percentage to take on trust.
      classPerformance: {
        date: classRates.date,
        rates: classRates.rates.map((rate) => ({
          assetClass: rate.assetClass,
          assetSumPercent: rate.assetSumPercent,
          upliftPercent: rate.upliftPercent,
          totalPercent: rate.totalPercent,
          assetCount: rate.assetCount,
          breakdown: rate.breakdown,
        })),
      },
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
