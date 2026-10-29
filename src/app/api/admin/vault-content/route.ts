import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { COPY_GROUPS } from '@/lib/vault/onboarding-copy';
import { getContentForAdmin, updateContent } from '@/lib/vault/content-store';

export const dynamic = 'force-dynamic';

/** Every editable string, with its current value and whether it is overridden. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.success) return auth.response;

    const entries = await getContentForAdmin();
    return NextResponse.json({
      success: true,
      groups: COPY_GROUPS,
      entries,
      overriddenCount: entries.filter((e) => e.isOverridden).length,
    });
  } catch (error) {
    console.error('[Admin Vault Content] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load the onboarding copy.' },
      { status: 500 },
    );
  }
}

/** Save edits. Clearing a field, or restoring the default, removes the override. */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.success) return auth.response;

    const body = (await request.json()) as {
      entries?: Array<{ key?: string; value?: string }>;
    };

    const entries = (body.entries ?? [])
      .filter((e) => typeof e.key === 'string')
      .map((e) => ({ key: String(e.key), value: String(e.value ?? '') }));

    if (entries.length === 0) {
      return NextResponse.json({ success: false, error: 'Nothing to save.' }, { status: 400 });
    }

    const result = await updateContent(entries, auth.user.userId);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.errors.join(' ') },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, updated: result.updated });
  } catch (error) {
    console.error('[Admin Vault Content] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not save the copy.' },
      { status: 500 },
    );
  }
}
