import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

/**
 * Generate a unique Chain Account access token
 * - Length: 6-10 characters (random)
 * - Characters: Uppercase A-Z and 0-9 only
 * - Must be unique across all ChainAccountMembers
 */
export async function generateUniqueAccessToken(): Promise<string> {
  const length = Math.floor(Math.random() * 5) + 6; // Random length between 6-10
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let attempts = 0;
  const maxAttempts = 50;

  while (attempts < maxAttempts) {
    let token = '';
    for (let i = 0; i < length; i++) {
      token += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Check if token already exists (by hashing and comparing - but for uniqueness check, we need to check all)
    // Since tokens are hashed, we need to maintain a separate unique constraint
    // For now, we'll check if any existing token matches when hashed
    const existingMembers = await prisma.chainAccountMember.findMany({
      where: {
        accessTokenHash: { not: null }
      },
      select: { accessTokenHash: true }
    });

    // Check if this token matches any existing hash
    let isUnique = true;
    for (const member of existingMembers) {
      if (member.accessTokenHash) {
        const matches = await bcrypt.compare(token, member.accessTokenHash);
        if (matches) {
          isUnique = false;
          break;
        }
      }
    }

    if (isUnique) {
      return token;
    }

    attempts++;
  }

  throw new Error('Failed to generate unique access token after maximum attempts');
}

/**
 * Hash an access token using bcrypt
 */
export async function hashAccessToken(token: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(token, saltRounds);
}

/**
 * Verify an access token against a hash
 */
export async function verifyAccessToken(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash);
}

/**
 * Generate a unique signing token for memorandum confirmation
 * This is a one-time use token sent in the email link
 */
export function generateSigningToken(): string {
  // Generate a secure random token (32 characters hex)
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate account name from member names
 */
export function generateAccountName(memberNames: string[]): string {
  if (memberNames.length === 0) return 'Chain Account';
  
  // Take last names or first names if no last name
  const names = memberNames.map(name => {
    const parts = name.trim().split(' ');
    return parts.length > 1 ? parts[parts.length - 1] : parts[0];
  });

  return `${names.join('-')} Chain Account`;
}

/**
 * Generate unique Chain Account number
 * Format: CA-YYYY-NNNNN (e.g., CA-2024-00142)
 */
export async function generateChainAccountNumber(): Promise<string> {
  const year = new Date().getFullYear();
  
  // Get the count of existing chain accounts this year
  const prefix = `CA-${year}-`;
  const lastAccount = await prisma.chainAccount.findFirst({
    where: {
      accountNumber: {
        startsWith: prefix
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    select: {
      accountNumber: true
    }
  });

  let nextNumber = 1;
  if (lastAccount) {
    // Extract the number from the last account
    const match = lastAccount.accountNumber.match(/CA-\d{4}-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  // Pad with zeros to 5 digits
  const paddedNumber = nextNumber.toString().padStart(5, '0');
  return `${prefix}${paddedNumber}`;
}

/**
 * Generate memorandum document reference
 * Format: CA-YYYY-NNNNN (same as account number)
 */
export function generateMemorandumReference(accountNumber: string): string {
  return accountNumber;
}

/**
 * Check if a user has reached the maximum number of Chain Accounts (3)
 */
export async function hasReachedChainAccountLimit(userId: string): Promise<boolean> {
  const count = await prisma.chainAccountMember.count({
    where: {
      userId,
      chainAccount: {
        status: {
          in: ['PENDING', 'ACTIVE']
        }
      }
    }
  });

  return count >= 3;
}

/**
 * Get user's active Chain Accounts count
 */
export async function getUserChainAccountCount(userId: string): Promise<number> {
  return prisma.chainAccountMember.count({
    where: {
      userId,
      chainAccount: {
        status: {
          in: ['PENDING', 'ACTIVE']
        }
      }
    }
  });
}

/**
 * Check if all members have confirmed the memorandum
 */
export async function allMembersConfirmed(chainAccountId: string): Promise<boolean> {
  const totalMembers = await prisma.chainAccountMember.count({
    where: { chainAccountId }
  });

  const confirmedMembers = await prisma.chainAccountMember.count({
    where: {
      chainAccountId,
      hasConfirmed: true
    }
  });

  return totalMembers > 0 && totalMembers === confirmedMembers;
}

/**
 * Calculate if approval threshold is met based on authorization model
 */
export async function isApprovalThresholdMet(
  chainAccountId: string,
  actionId: string,
  actionType: 'INVESTMENT' | 'WITHDRAWAL'
): Promise<{ isMet: boolean; reason: string }> {
  // Get chain account with authorization model
  const chainAccount = await prisma.chainAccount.findUnique({
    where: { id: chainAccountId },
    select: {
      authorizationModel: true
    }
  });

  if (!chainAccount) {
    return { isMet: false, reason: 'Chain account not found' };
  }

  // Get total active members
  const totalMembers = await prisma.chainAccountMember.count({
    where: {
      chainAccountId,
      hasConfirmed: true // Only count confirmed members
    }
  });

  // Get approvals for this action
  const approvals = await prisma.chainAccountApproval.findMany({
    where: {
      chainAccountId,
      actionId,
      actionType
    }
  });

  const approved = approvals.filter(a => a.decision === 'APPROVED').length;
  const rejected = approvals.filter(a => a.decision === 'REJECTED').length;

  // Check based on authorization model
  switch (chainAccount.authorizationModel) {
    case 'THRESHOLD':
      // All members must approve
      if (rejected > 0) {
        return { isMet: false, reason: 'Action rejected by one or more members' };
      }
      if (approved === totalMembers) {
        return { isMet: true, reason: 'All members approved' };
      }
      return { isMet: false, reason: `Waiting for ${totalMembers - approved} more approvals` };

    case 'MAJORITY':
      // More than half must approve
      const requiredApprovals = Math.floor(totalMembers / 2) + 1;
      
      if (approved >= requiredApprovals) {
        return { isMet: true, reason: 'Majority approved' };
      }
      
      // Check if it's still possible to reach majority
      const remainingVotes = totalMembers - (approved + rejected);
      const possibleApprovals = approved + remainingVotes;
      
      if (possibleApprovals < requiredApprovals) {
        return { isMet: false, reason: 'Majority approval no longer achievable' };
      }
      
      return { isMet: false, reason: `${requiredApprovals - approved} more approvals needed for majority` };

    case 'INDEPENDENT':
      // No approval needed
      return { isMet: true, reason: 'Independent authorization - no approval required' };

    default:
      return { isMet: false, reason: 'Unknown authorization model' };
  }
}

/**
 * Check if a transaction requires approval based on amount and threshold
 */
export async function requiresApproval(
  chainAccountId: string,
  amount: number
): Promise<boolean> {
  const chainAccount = await prisma.chainAccount.findUnique({
    where: { id: chainAccountId },
    select: {
      authorizationModel: true,
      thresholdAmount: true
    }
  });

  if (!chainAccount) {
    throw new Error('Chain account not found');
  }

  // Independent model never requires approval
  if (chainAccount.authorizationModel === 'INDEPENDENT') {
    return false;
  }

  // Threshold and Majority models require approval if amount >= threshold
  if (chainAccount.authorizationModel === 'THRESHOLD' || chainAccount.authorizationModel === 'MAJORITY') {
    if (chainAccount.thresholdAmount === null) {
      // No threshold set, all transactions require approval
      return true;
    }
    return amount >= chainAccount.thresholdAmount;
  }

  return false;
}
