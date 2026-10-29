import { NextRequest, NextResponse } from 'next/server';
import { RiskProfile } from '@prisma/client';
import { requireAdmin } from '@/lib/auth-middleware';
import { AllocationMap } from '@/lib/vault/allocation-model';
import {
  createAssetClass,
  deleteAssetClass,
  getClassMatrix,
  updateAssetClass,
} from '@/lib/vault/asset-class-admin';
import { loadVaultPolicy, updateProfileAllocation } from '@/lib/vault/policy-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Classes, how each is used, and the profile percentage matrix. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.success) return auth.response;

    const [matrix, policy] = await Promise.all([getClassMatrix(), loadVaultPolicy()]);

    return NextResponse.json({
      success: true,
      ...matrix,
      cryptoCapPercent: policy.cryptoCapPercent,
    });
  } catch (error) {
    console.error('[Admin Asset Classes] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load the asset classes.' },
      { status: 500 },
    );
  }
}

/** Create a class. It starts at 0% in every profile. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const result = await createAssetClass(body, auth.user.userId);

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.errors.join(' ') },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true, key: result.key });
  } catch (error) {
    console.error('[Admin Asset Classes] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not create the asset class.' },
      { status: 500 },
    );
  }
}

/**
 * Edit a class, or save a profile's percentages.
 *
 * Percentages are saved a whole profile at a time, because they must total
 * 100 and a single-field save could never satisfy that.
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.success) return auth.response;

    const body = await request.json();

    if (typeof body.riskProfile === 'string') {
      if (!Object.values(RiskProfile).includes(body.riskProfile as RiskProfile)) {
        return NextResponse.json(
          { success: false, error: 'Unknown risk profile.' },
          { status: 400 },
        );
      }

      const allocation = Object.fromEntries(
        Object.entries(body.allocation ?? {}).map(([k, v]) => [k, Number(v) || 0]),
      ) as AllocationMap;

      const result = await updateProfileAllocation(
        body.riskProfile as RiskProfile,
        allocation,
        auth.user.userId,
      );

      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.errors.join(' ') },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        // Surfaced so an admin can see the change reached real members.
        vaultsUpdated: result.vaultsUpdated ?? 0,
      });
    }

    if (typeof body.key === 'string') {
      const result = await updateAssetClass(body.key, body, auth.user.userId);
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.errors.join(' ') },
          { status: 400 },
        );
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Nothing to update.' }, { status: 400 });
  } catch (error) {
    console.error('[Admin Asset Classes] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not save.' },
      { status: 500 },
    );
  }
}

/** Remove a class, if nothing still depends on it. */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.success) return auth.response;

    const key = new URL(request.url).searchParams.get('key');
    if (key === null) {
      return NextResponse.json({ success: false, error: 'key is required.' }, { status: 400 });
    }

    const result = await deleteAssetClass(key);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.errors.join(' ') },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Asset Classes] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not remove the asset class.' },
      { status: 500 },
    );
  }
}
