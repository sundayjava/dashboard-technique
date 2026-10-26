import { VaultAssetClass } from '@/lib/vault/asset-classes';
import { NextRequest, NextResponse } from 'next/server';
import { RiskProfile } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-middleware';
import { AllocationMap, getAllAssetClasses } from '@/lib/vault/allocation-model';
import {
  POLICY_SETTINGS,
  loadVaultPolicyDetailed,
  seedVaultPolicy,
  updatePolicySetting,
  updateProfileAllocation,
} from '@/lib/vault/policy-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Admin view of Retirement Vault policy.
 *
 * Returns the EFFECTIVE policy plus any warnings, so an admin can see when a
 * stored value is being ignored in favour of a default rather than wondering
 * why their change had no effect.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.success) return auth.response;

    // Seed on first view so the admin screen is never empty on a fresh deploy.
    const seeded = await seedVaultPolicy();
    const { policy, warnings } = await loadVaultPolicyDetailed();

    const [sleeveAssets, vaultCount] = await Promise.all([
      prisma.vaultAsset.findMany({
        where: { isActive: true, role: { not: 'BENCHMARK' } },
        select: {
          id: true,
          symbol: true,
          name: true,
          assetClass: true,
          sleeveWeight: true,
          currentPrice: true,
        },
        orderBy: { displayOrder: 'asc' },
      }),
      prisma.retirementVault.count(),
    ]);

    return NextResponse.json({
      success: true,
      seeded,
      warnings,
      settings: POLICY_SETTINGS.map((definition) => ({
        key: definition.key,
        label: definition.label,
        description: definition.description,
        min: definition.min,
        max: definition.max,
        unit: definition.unit,
        defaultValue: definition.defaultValue,
        value: policy[definition.key],
      })),
      targetAllocations: policy.targetAllocations,
      assetClasses: getAllAssetClasses(),
      sleeveAssets,
      vaultCount,
    });
  } catch (error) {
    console.error('[Admin Vault Policy] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load vault policy.' },
      { status: 500 },
    );
  }
}

/**
 * Update policy.
 *
 * Accepts one of three shapes, each validated before anything is written:
 *   { setting, value }              - a scalar policy setting
 *   { riskProfile, allocation }     - a profile's full allocation set
 *   { sleeveWeights: [{id, weight}] } - instrument split inside a class
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.success) return auth.response;

    const adminId = auth.user.userId;
    const body = await request.json();

    // --- scalar setting ----------------------------------------------------
    if (typeof body.setting === 'string') {
      const result = await updatePolicySetting(body.setting, Number(body.value), adminId);
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.errors.join(' ') },
          { status: 400 },
        );
      }
      return NextResponse.json({ success: true, updated: body.setting });
    }

    // --- profile allocation ------------------------------------------------
    if (typeof body.riskProfile === 'string') {
      if (!Object.values(RiskProfile).includes(body.riskProfile as RiskProfile)) {
        return NextResponse.json(
          { success: false, error: 'Unknown risk profile.' },
          { status: 400 },
        );
      }

      const allocation = getAllAssetClasses().reduce((map, assetClass) => {
        map[assetClass] = Number(body.allocation?.[assetClass] ?? 0);
        return map;
      }, {} as AllocationMap);

      const result = await updateProfileAllocation(
        body.riskProfile as RiskProfile,
        allocation,
        adminId,
      );

      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.errors.join(' ') },
          { status: 400 },
        );
      }
      return NextResponse.json({ success: true, updated: body.riskProfile });
    }

    // --- sleeve weights ----------------------------------------------------
    if (Array.isArray(body.sleeveWeights)) {
      const updates = body.sleeveWeights as Array<{ id?: string; weight?: number }>;

      const assets = await prisma.vaultAsset.findMany({
        where: { id: { in: updates.map((u) => String(u.id)) } },
        select: { id: true, assetClass: true, symbol: true },
      });

      if (assets.length !== updates.length) {
        return NextResponse.json(
          { success: false, error: 'One or more assets were not found.' },
          { status: 400 },
        );
      }

      for (const update of updates) {
        const weight = Number(update.weight);
        if (!Number.isFinite(weight) || weight < 0 || weight > 1) {
          return NextResponse.json(
            { success: false, error: 'Sleeve weights must be between 0 and 1.' },
            { status: 400 },
          );
        }
      }

      // Weights must total 1 within each class they touch, or that class gets
      // under- or over-bought on every future deposit.
      const byClass = new Map<VaultAssetClass, number>();
      for (const update of updates) {
        const asset = assets.find((a) => a.id === update.id);
        if (asset === undefined) continue;
        byClass.set(asset.assetClass, (byClass.get(asset.assetClass) ?? 0) + Number(update.weight));
      }

      for (const [assetClass, total] of byClass) {
        // Only enforce when the submission covers the whole class; a partial
        // edit is rejected rather than silently rescaled.
        const classAssetCount = await prisma.vaultAsset.count({
          where: { assetClass, isActive: true, role: { not: 'BENCHMARK' } },
        });
        const submittedCount = updates.filter((u) =>
          assets.some((a) => a.id === u.id && a.assetClass === assetClass),
        ).length;

        if (submittedCount !== classAssetCount) {
          return NextResponse.json(
            {
              success: false,
              error: `Submit all ${classAssetCount} instruments for ${assetClass} together.`,
            },
            { status: 400 },
          );
        }

        if (Math.abs(total - 1) > 1e-6) {
          return NextResponse.json(
            {
              success: false,
              error: `${assetClass} weights total ${(total * 100).toFixed(1)}%, expected 100%.`,
            },
            { status: 400 },
          );
        }
      }

      await prisma.$transaction(
        updates.map((update) =>
          prisma.vaultAsset.update({
            where: { id: String(update.id) },
            data: { sleeveWeight: Number(update.weight) },
          }),
        ),
      );

      return NextResponse.json({ success: true, updated: updates.length });
    }

    return NextResponse.json(
      { success: false, error: 'Nothing to update.' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[Admin Vault Policy] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not update vault policy.' },
      { status: 500 },
    );
  }
}
