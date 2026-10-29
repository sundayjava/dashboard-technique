import { NextResponse } from 'next/server';
import { loadCopy } from '@/lib/vault/content-store';

export const dynamic = 'force-dynamic';

/**
 * Onboarding copy for the member-facing page.
 *
 * Deliberately unauthenticated: it is the same marketing-grade text for every
 * visitor, contains nothing personal, and the onboarding page needs it before
 * a vault exists. Gating it would only add a failure mode.
 */
export async function GET() {
  try {
    return NextResponse.json({ success: true, copy: await loadCopy() });
  } catch (error) {
    console.error('[Vault Content] error:', error);
    // The page falls back to its shipped strings, so an empty map is safe.
    return NextResponse.json({ success: true, copy: {} });
  }
}
