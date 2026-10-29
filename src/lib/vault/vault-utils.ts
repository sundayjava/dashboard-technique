import { VaultStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Generate the next vault number, in the house format RV-YYYY-NNNNN.
 *
 * Mirrors generateChainAccountNumber. The sequence is per-year and derived
 * from the latest existing number, so it stays readable for support staff.
 *
 * Retries on collision: two members onboarding in the same moment can both
 * read the same "latest" row, and vaultNumber is unique, so the loser of that
 * race must try again rather than fail onboarding.
 */
export async function generateVaultNumber(maxAttempts = 5): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RV-${year}-`;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const latest = await prisma.retirementVault.findFirst({
      where: { vaultNumber: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { vaultNumber: true },
    });

    let next = 1;
    if (latest !== null) {
      const match = latest.vaultNumber.match(/RV-\d{4}-(\d+)/);
      if (match?.[1] !== undefined) next = parseInt(match[1], 10) + 1;
    }

    // Skip ahead by the attempt count so a retry does not simply recollide.
    const candidate = `${prefix}${(next + attempt).toString().padStart(5, '0')}`;

    const taken = await prisma.retirementVault.findUnique({
      where: { vaultNumber: candidate },
      select: { id: true },
    });

    if (taken === null) return candidate;
  }

  throw new Error('Could not allocate a unique vault number. Please try again.');
}

/** Vault states that still count as a member having a vault. */
export const OPEN_VAULT_STATUSES: VaultStatus[] = [
  VaultStatus.DRAFT,
  VaultStatus.PENDING_ACTIVATION,
  VaultStatus.ACTIVE,
  VaultStatus.SUSPENDED,
  VaultStatus.CLOSING,
];

/**
 * The member's current vault, if any.
 *
 * A member holds one retirement vault at a time. Unlike Chain Accounts, where
 * several serve different purposes, multiple retirement vaults would fragment
 * a single retirement goal and make the 401k benchmark meaningless.
 */
export async function getOpenVaultForUser(userId: string) {
  return prisma.retirementVault.findFirst({
    where: { userId, status: { in: OPEN_VAULT_STATUSES } },
    orderBy: { createdAt: 'desc' },
  });
}

export const MIN_INITIAL_DEPOSIT = 100;
export const MAX_INITIAL_DEPOSIT = 10_000_000;
export const MIN_AGE = 18;
export const MAX_AGE = 100;

/** Terms version recorded against a sign-off, so consent is auditable. */
export const CURRENT_TERMS_VERSION = '2026-10-v1';
