import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getOpenVaultForUser } from '@/lib/vault/vault-utils';

export const dynamic = 'force-dynamic';

/**
 * Whether the member already holds a vault.
 *
 * The onboarding page calls this first so someone with a vault is sent to
 * their dashboard rather than being walked through creating a second one.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const vault = await getOpenVaultForUser(auth.user.userId);

    if (vault === null) {
      return NextResponse.json({ success: true, hasVault: false, vault: null });
    }

    return NextResponse.json({
      success: true,
      hasVault: true,
      vault: {
        id: vault.id,
        vaultNumber: vault.vaultNumber,
        status: vault.status,
        riskProfile: vault.riskProfile,
        allocationMode: vault.allocationMode,
        currency: vault.currency,
        totalContributed: vault.totalContributed,
        cashBalance: vault.cashBalance,
        activatedAt: vault.activatedAt,
        createdAt: vault.createdAt,
      },
    });
  } catch (error) {
    console.error('[Vault Status] error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load vault status' },
      { status: 500 },
    );
  }
}
