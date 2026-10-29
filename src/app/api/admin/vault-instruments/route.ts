import { NextRequest, NextResponse } from 'next/server';
import { PriceProvider, VaultAssetRole } from '@prisma/client';
import { requireAdmin } from '@/lib/auth-middleware';
import { createAsset, deleteAsset, listAssets, updateAsset } from '@/lib/vault/asset-admin';
import { getAssetClasses } from '@/lib/vault/asset-class-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** The instruments a vault is priced from, with their sleeve totals. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.success) return auth.response;

    const [{ assets, sleeveTotals }, classes] = await Promise.all([
      listAssets(),
      getAssetClasses(),
    ]);

    return NextResponse.json({
      success: true,
      assets,
      sleeveTotals,
      assetClasses: classes.map((c) => ({ key: c.key, name: c.name })),
      providers: Object.values(PriceProvider),
      roles: Object.values(VaultAssetRole),
    });
  } catch (error) {
    console.error('[Admin Instruments] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load the instruments.' },
      { status: 500 },
    );
  }
}

/**
 * Add an instrument.
 *
 * It starts at sleeve weight 0 unless one is given, so adding one never
 * silently dilutes the instruments a member already holds. The split is then
 * set deliberately on the policy screen.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.success) return auth.response;

    const result = await createAsset(await request.json());
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.errors.join(' ') },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true, id: result.id, warnings: result.warnings });
  } catch (error) {
    console.error('[Admin Instruments] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not add the instrument.' },
      { status: 500 },
    );
  }
}

/** Edit an instrument, including retiring it with `isActive: false`. */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    if (typeof body.id !== 'string') {
      return NextResponse.json({ success: false, error: 'id is required.' }, { status: 400 });
    }

    const result = await updateAsset(body.id, body);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.errors.join(' ') },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true, warnings: result.warnings });
  } catch (error) {
    console.error('[Admin Instruments] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not save the instrument.' },
      { status: 500 },
    );
  }
}

/** Remove an instrument, if nothing still depends on it. */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.success) return auth.response;

    const id = new URL(request.url).searchParams.get('id');
    if (id === null) {
      return NextResponse.json({ success: false, error: 'id is required.' }, { status: 400 });
    }

    const result = await deleteAsset(id);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.errors.join(' ') },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true, warnings: result.warnings });
  } catch (error) {
    console.error('[Admin Instruments] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not remove the instrument.' },
      { status: 500 },
    );
  }
}
