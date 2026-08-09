import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/chain-account-utils';
import { createChainAccountToken } from '@/lib/chain-account-session';

// In-memory rate limiting store (in production, use Redis)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

function getRateLimitKey(ip: string): string {
  return `chain-login:${ip}`;
}

function checkRateLimit(ip: string): { allowed: boolean; attemptsRemaining: number } {
  const key = getRateLimitKey(ip);
  const now = Date.now();
  
  const attempt = loginAttempts.get(key);
  
  // Reset if window has passed
  if (attempt && now >= attempt.resetAt) {
    loginAttempts.delete(key);
  }
  
  const currentAttempt = loginAttempts.get(key);
  
  if (!currentAttempt) {
    return { allowed: true, attemptsRemaining: MAX_ATTEMPTS - 1 };
  }
  
  if (currentAttempt.count >= MAX_ATTEMPTS) {
    return { allowed: false, attemptsRemaining: 0 };
  }
  
  return { allowed: true, attemptsRemaining: MAX_ATTEMPTS - currentAttempt.count - 1 };
}

function incrementRateLimit(ip: string): void {
  const key = getRateLimitKey(ip);
  const now = Date.now();
  
  const attempt = loginAttempts.get(key);
  
  if (!attempt || now >= attempt.resetAt) {
    loginAttempts.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    });
  } else {
    loginAttempts.set(key, {
      count: attempt.count + 1,
      resetAt: attempt.resetAt,
    });
  }
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  return 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const { accessToken, userId } = await request.json();

    if (!accessToken || typeof accessToken !== 'string') {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      );
    }

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'User authentication required' },
        { status: 401 }
      );
    }

    // Get client IP for rate limiting
    const clientIp = getClientIp(request);

    // Check rate limit
    const { allowed, attemptsRemaining } = checkRateLimit(clientIp);

    if (!allowed) {
      return NextResponse.json(
        {
          error: 'Too many login attempts. Please try again in 15 minutes.',
          attemptsRemaining: 0,
        },
        { status: 429 }
      );
    }

    // Validate token format (6-10 uppercase alphanumeric)
    const tokenRegex = /^[A-Z0-9]{6,10}$/;
    if (!tokenRegex.test(accessToken)) {
      incrementRateLimit(clientIp);
      return NextResponse.json(
        {
          error: 'Invalid token format',
          attemptsRemaining,
        },
        { status: 400 }
      );
    }

    // SECURITY FIX: Find members ONLY for the current user's Chain Accounts
    const members = await prisma.chainAccountMember.findMany({
      where: {
        userId: userId, // Must belong to the current user
        chainAccount: {
          status: 'ACTIVE',
        },
        hasConfirmed: true,
        accessTokenHash: {
          not: null,
        },
      },
      include: {
        chainAccount: {
          select: {
            id: true,
            accountName: true,
            accountNumber: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (members.length === 0) {
      incrementRateLimit(clientIp);
      return NextResponse.json(
        {
          error: 'You do not have any active Chain Account memberships',
          attemptsRemaining,
        },
        { status: 403 }
      );
    }

    // Verify token against each of the current user's member records
    let matchedMember = null;
    for (const member of members) {
      if (member.accessTokenHash && await verifyAccessToken(accessToken, member.accessTokenHash)) {
        matchedMember = member;
        break;
      }
    }

    if (!matchedMember) {
      incrementRateLimit(clientIp);
      return NextResponse.json(
        {
          error: 'Invalid access token for your account',
          attemptsRemaining,
        },
        { status: 401 }
      );
    }

    // Successful authentication - create Chain Account session token
    const sessionToken = createChainAccountToken(
      matchedMember.userId,
      matchedMember.chainAccountId,
      matchedMember.id,
      matchedMember.chainAccount.accountName,
      matchedMember.role
    );

    // Update last access time
    await prisma.chainAccountMember.update({
      where: { id: matchedMember.id },
      data: { updatedAt: new Date() },
    });

    const sessionData = {
      userId: matchedMember.userId,
      userName: matchedMember.user.name,
      userEmail: matchedMember.user.email,
      chainAccountId: matchedMember.chainAccountId,
      memberId: matchedMember.id,
      accountName: matchedMember.chainAccount.accountName,
      accountNumber: matchedMember.chainAccount.accountNumber,
      role: matchedMember.role,
    };

    console.log('Chain Account Login Success:');
    console.log('  chainAccountId:', matchedMember.chainAccountId, '(type:', typeof matchedMember.chainAccountId, ')');
    console.log('  Session data:', sessionData);

    return NextResponse.json({
      success: true,
      token: sessionToken,
      session: sessionData,
    });

  } catch (error: any) {
    console.error('Chain Account login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
