import { VaultAssetClass } from '@/lib/vault/asset-classes';
import { isValidAssetClass } from '@/lib/vault/asset-class-store';
import { NextRequest, NextResponse } from 'next/server';
import { AllocationMode, RebalanceTrigger, VaultStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';
import { canSwitchMode, getTargetAllocation } from '@/lib/vault/allocation-model';
import { loadVaultPolicy } from '@/lib/vault/policy-store';
import { applyRebalance, proposeRebalance } from '@/lib/vault/rebalance-engine';
import { getOpenVaultForUser } from '@/lib/vault/vault-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Current mode and whether a switch is allowed yet. */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const vault = await getOpenVaultForUser(auth.user.userId);
    if (vault === null) {
      return NextResponse.json({ success: false, error: 'No vault found.' }, { status: 404 });
    }

    const policy = await loadVaultPolicy();
    const cooldown = canSwitchMode(
      vault.modeLastChangedAt,
      new Date(),
      policy.modeSwitchCooldownDays,
    );

    return NextResponse.json({
      success: true,
      allocationMode: vault.allocationMode,
      focusedAssetClass: vault.focusedAssetClass,
      expertAllocatorActive: vault.expertAllocatorActive,
      cooldownDays: policy.modeSwitchCooldownDays,
      canSwitch: cooldown.allowed,
      daysRemaining: cooldown.daysRemaining,
      nextAllowedAt: cooldown.nextAllowedAt,
      modeLastChangedAt: vault.modeLastChangedAt,
    });
  } catch (error) {
    console.error('[Vault Allocation Mode] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load your allocation mode.' },
      { status: 500 },
    );
  }
}

/**
 * Switch allocation mode, including turning the Expert Allocator on or off.
 *
 * Guarded by the cooldown, which is the whole reason the setting exists:
 * switching mode after a bad quarter is performance-chasing, and it is the
 * behaviour most likely to damage a retirement outcome. The cooldown is
 * enforced HERE rather than only in the UI, because a disabled button stops
 * nobody who can issue a request.
 *
 * A successful switch re-targets the vault and rebalances it immediately, so
 * the member's holdings match the mode they just chose rather than waiting for
 * the next scheduled run.
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const vault = await getOpenVaultForUser(auth.user.userId);
    if (vault === null) {
      return NextResponse.json({ success: false, error: 'No vault found.' }, { status: 404 });
    }

    if (vault.status !== VaultStatus.ACTIVE) {
      return NextResponse.json(
        { success: false, error: 'Only an active vault can change allocation mode.' },
        { status: 400 },
      );
    }

    const body = (await request.json()) as {
      allocationMode?: string;
      focusedAssetClass?: string | null;
    };

    if (!Object.values(AllocationMode).includes(body.allocationMode as AllocationMode)) {
      return NextResponse.json(
        { success: false, error: 'Choose a valid allocation mode.' },
        { status: 400 },
      );
    }
    const nextMode = body.allocationMode as AllocationMode;

    let focusedAssetClass: VaultAssetClass | null = null;
    if (nextMode === AllocationMode.FOCUSED) {
      // Checked against the live classes, not a fixed list, so a class an
      // admin added is accepted and one they removed is not.
      if (!(await isValidAssetClass(body.focusedAssetClass))) {
        return NextResponse.json(
          { success: false, error: 'Choose an asset class to focus on.' },
          { status: 400 },
        );
      }
      focusedAssetClass = body.focusedAssetClass as VaultAssetClass;
    }

    const sameMode =
      nextMode === vault.allocationMode &&
      focusedAssetClass === vault.focusedAssetClass;

    if (sameMode) {
      return NextResponse.json(
        { success: false, error: 'That is already your allocation mode.' },
        { status: 400 },
      );
    }

    const policy = await loadVaultPolicy();
    const cooldown = canSwitchMode(
      vault.modeLastChangedAt,
      new Date(),
      policy.modeSwitchCooldownDays,
    );

    if (!cooldown.allowed) {
      return NextResponse.json(
        {
          success: false,
          error:
            `You can change allocation mode again in ${cooldown.daysRemaining} day` +
            `${cooldown.daysRemaining === 1 ? '' : 's'}. This cooldown exists to protect ` +
            `your long-term returns from short-term switching.`,
          daysRemaining: cooldown.daysRemaining,
          nextAllowedAt: cooldown.nextAllowedAt,
        },
        { status: 429 },
      );
    }

    const targetAllocation = getTargetAllocation(
      { riskProfile: vault.riskProfile, mode: nextMode, focusedAssetClass },
      policy,
    );

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.retirementVault.update({
        where: { id: vault.id },
        data: {
          allocationMode: nextMode,
          focusedAssetClass,
          expertAllocatorActive: nextMode === AllocationMode.EXPERT_ALLOCATOR,
          modeLastChangedAt: now,
        },
      });

      // Switching mode replaces the targets wholesale. The override flag is
      // cleared as it goes: pinning is retired, and this scrubs the legacy
      // flag from any row written before it was removed.
      for (const [assetClass, targetPercent] of Object.entries(targetAllocation)) {
        await tx.vaultAllocation.upsert({
          where: {
            vaultId_assetClass: {
              vaultId: vault.id,
              assetClass: assetClass as VaultAssetClass,
            },
          },
          create: {
            vaultId: vault.id,
            assetClass: assetClass as VaultAssetClass,
            targetPercent,
          },
          update: { targetPercent, isUserOverride: false, overriddenAt: null },
        });
      }
    });

    // Rebalance straight away so holdings match the chosen mode. A failure
    // here does not undo the switch — the next scheduled run will catch it.
    let rebalanced = false;
    let rebalanceNote: string | null = null;
    try {
      const proposal = await proposeRebalance(vault.id, RebalanceTrigger.MODE_CHANGE, { policy });
      if (proposal !== null && proposal.actionable) {
        const result = await applyRebalance(proposal);
        rebalanced = result.applied;
        rebalanceNote = result.reason ?? null;
      } else {
        rebalanceNote = proposal?.skipReason ?? null;
      }
    } catch (error) {
      console.error('[Vault Allocation Mode] rebalance after switch failed:', error);
      rebalanceNote = 'Your mode was changed; holdings will realign at the next review.';
    }

    await prisma.notification
      .create({
        data: {
          userId: auth.user.userId,
          type: 'INVESTMENT',
          title: 'Allocation mode changed',
          message:
            `${vault.vaultNumber} is now set to ` +
            `${nextMode.replace(/_/g, ' ').toLowerCase()}` +
            `${focusedAssetClass ? ` (${focusedAssetClass.replace(/_/g, ' ').toLowerCase()})` : ''}. ` +
            `You can change it again in ${policy.modeSwitchCooldownDays} days.`,
          link: '/retirement-vault/dashboard',
        },
      })
      .catch(() => undefined);

    return NextResponse.json({
      success: true,
      allocationMode: nextMode,
      focusedAssetClass,
      expertAllocatorActive: nextMode === AllocationMode.EXPERT_ALLOCATOR,
      targetAllocation,
      rebalanced,
      rebalanceNote,
      nextChangeAllowedAt: new Date(
        now.getTime() + policy.modeSwitchCooldownDays * 24 * 60 * 60 * 1000,
      ),
    });
  } catch (error) {
    console.error('[Vault Allocation Mode] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not change your allocation mode.' },
      { status: 500 },
    );
  }
}
