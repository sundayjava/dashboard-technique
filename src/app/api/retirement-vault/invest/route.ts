import { NextRequest, NextResponse } from 'next/server';
import { VaultAssetClass, VaultStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';
import {
  applyAllocationPlan,
  buildTargetingAllocationPlan,
  buildManualAllocationPlan,
  getInvestmentCapacity,
  summarisePlan,
} from '@/lib/vault/allocation-engine';
import { getOpenVaultForUser } from '@/lib/vault/vault-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * What the member can invest, and the ceiling on each asset class.
 *
 * The UI needs headroom per class, not just a total: someone with plenty of
 * cash may still be unable to add anything to crypto.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const vault = await getOpenVaultForUser(auth.user.userId);
    if (vault === null) {
      return NextResponse.json({ success: false, error: 'No vault found.' }, { status: 404 });
    }

    const capacity = await getInvestmentCapacity(vault.id);
    if (capacity === null) {
      return NextResponse.json(
        { success: false, error: 'Could not calculate your investment limits.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      expertAllocatorActive: vault.expertAllocatorActive,
      allocationMode: vault.allocationMode,
      vaultTotalValue: capacity.vaultTotalValue,
      investableCash: capacity.investableCash,
      totalInvestable: capacity.totalInvestable,
      complete: capacity.complete,
      missingPrices: capacity.missingPrices,
      classes: capacity.classes,
    });
  } catch (error) {
    console.error('[Vault Invest] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load your investment options.' },
      { status: 500 },
    );
  }
}

/**
 * Invest uninvested cash into holdings.
 *
 * Two shapes, matching the two modes:
 *
 *   { amount }        Expert Allocator on. One total, which the system splits
 *                     across the classes by their target percentages.
 *   { allocations }   Expert off. The member sets each class themselves, and
 *                     every class is held to its own ceiling.
 *
 * Nothing leaves the member's bank account here — this moves cash that is
 * already in the vault into holdings.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const vault = await getOpenVaultForUser(auth.user.userId);
    if (vault === null) {
      return NextResponse.json({ success: false, error: 'No vault found.' }, { status: 404 });
    }

    if (vault.status !== VaultStatus.ACTIVE) {
      return NextResponse.json(
        { success: false, error: 'Your vault must be active before you can invest.' },
        { status: 400 },
      );
    }

    const body = (await request.json()) as {
      amount?: number;
      allocations?: Array<{ assetClass?: string; amount?: number }>;
    };

    const isAuto = Array.isArray(body.allocations) === false;

    // --- Expert Allocator: one total, split by the percentages -------------
    if (isAuto) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { success: false, error: 'Enter an amount to invest.' },
          { status: 400 },
        );
      }

      if (amount > vault.cashBalance + 0.01) {
        return NextResponse.json(
          {
            success: false,
            error: `You have $${vault.cashBalance.toFixed(2)} in uninvested cash.`,
          },
          { status: 400 },
        );
      }

      const plan = await buildTargetingAllocationPlan(vault.id, amount);
      if (!plan.complete || plan.lines.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              plan.lines.length === 0
                ? 'Your vault has no allocation targets to invest into.'
                : 'Live prices are unavailable, so this was not executed. Try again shortly.',
            missingPrices: plan.missingPrices,
          },
          { status: 503 },
        );
      }

      await prisma.$transaction(
        async (tx) => {
          const current = await tx.retirementVault.findUnique({
            where: { id: vault.id },
            select: { cashBalance: true },
          });
          if (current === null || current.cashBalance + 0.01 < amount) {
            throw new Error('Insufficient uninvested cash.');
          }

          await applyAllocationPlan(tx, plan);
          await tx.retirementVault.update({
            where: { id: vault.id },
            // Only what was actually spent leaves cash; rounding stays behind.
            data: { cashBalance: { decrement: plan.totalAllocated } },
          });
        },
        { timeout: 25_000, maxWait: 15_000 },
      );

      await notify(auth.user.userId, vault.vaultNumber, plan.totalAllocated, summarisePlan(plan));

      return NextResponse.json({
        success: true,
        mode: 'auto',
        invested: Number(plan.totalAllocated.toFixed(2)),
        lines: plan.lines.map((l) => ({
          symbol: l.symbol,
          assetClass: l.assetClass,
          amount: Number(l.amount.toFixed(2)),
          units: l.units,
          price: l.price,
        })),
      });
    }

    // --- Member-directed: each class held to its ceiling -------------------
    const inputs = (body.allocations ?? [])
      .filter((a) =>
        Object.values(VaultAssetClass).includes(a.assetClass as VaultAssetClass),
      )
      .map((a) => ({
        assetClass: a.assetClass as VaultAssetClass,
        amount: Number(a.amount ?? 0),
      }));

    const { plan, errors } = await buildManualAllocationPlan(vault.id, inputs);

    if (plan === null) {
      return NextResponse.json(
        { success: false, error: errors.join(' '), errors },
        { status: 400 },
      );
    }

    await prisma.$transaction(
      async (tx) => {
        const current = await tx.retirementVault.findUnique({
          where: { id: vault.id },
          select: { cashBalance: true },
        });
        if (current === null || current.cashBalance + 0.01 < plan.totalAllocated) {
          throw new Error('Insufficient uninvested cash.');
        }

        await applyAllocationPlan(tx, plan);
        await tx.retirementVault.update({
          where: { id: vault.id },
          data: { cashBalance: { decrement: plan.totalAllocated } },
        });
      },
      { timeout: 25_000, maxWait: 15_000 },
    );

    await notify(auth.user.userId, vault.vaultNumber, plan.totalAllocated, summarisePlan(plan));

    return NextResponse.json({
      success: true,
      mode: 'manual',
      invested: Number(plan.totalAllocated.toFixed(2)),
      lines: plan.lines.map((l) => ({
        symbol: l.symbol,
        assetClass: l.assetClass,
        amount: Number(l.amount.toFixed(2)),
        units: l.units,
        price: l.price,
      })),
    });
  } catch (error) {
    console.error('[Vault Invest] POST error:', error);
    const message = error instanceof Error ? error.message : 'Could not invest.';
    const insufficient = message.includes('Insufficient');
    return NextResponse.json(
      { success: false, error: insufficient ? message : 'Could not invest.' },
      { status: insufficient ? 400 : 500 },
    );
  }
}

async function notify(
  userId: string,
  vaultNumber: string,
  amount: number,
  summary: string,
): Promise<void> {
  await prisma.notification
    .create({
      data: {
        userId,
        type: 'INVESTMENT',
        title: 'Investment executed',
        message: `$${amount.toFixed(2)} was invested in ${vaultNumber}. ${summary}.`,
        link: '/retirement-vault/holdings',
      },
    })
    .catch(() => undefined);
}
