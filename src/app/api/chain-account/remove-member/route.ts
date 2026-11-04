import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyChainAccountToken } from '@/lib/chain-account-session';

export async function POST(request: NextRequest) {
  try {
    const { chainAccountId, targetMemberId, reason } = await request.json();

    if (!chainAccountId || !targetMemberId || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const resolved = await resolveSessionMember(request, chainAccountId);
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const sessionData = resolved.member;

    // Get target member details
    const targetMember = await prisma.chainAccountMember.findUnique({
      where: { id: targetMemberId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });

    if (!targetMember || targetMember.chainAccountId !== chainAccountId) {
      return NextResponse.json(
        { error: 'Target member not found' },
        { status: 404 }
      );
    }

    // Cannot remove yourself
    if (sessionData.id === targetMemberId) {
      return NextResponse.json(
        { error: 'You cannot remove yourself from the account' },
        { status: 400 }
      );
    }

    // Generate reference
    const reference = `REM-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create removal request
    const removalRequest = await prisma.chainAccountRemovalRequest.create({
      data: {
        chainAccountId,
        initiatedBy: sessionData.id,
        targetMemberId,
        reason,
        reference,
        status: 'PENDING_TARGET_APPROVAL',
      }
    });

    // The target decides this in their own dashboard, so all they need is the
    // in-app request — no emailed approval link.
    // Create notification for target
    await prisma.chainAccountNotification.create({
      data: {
        chainAccountId,
        userId: targetMember.userId,
        type: 'REMOVAL_REQUEST',
        title: 'Removal Request',
        message: `${sessionData.user.name || 'A member'} has requested to remove you from ${sessionData.chainAccount.accountName}. Open the Approvals panel in your Chain Account dashboard to approve or reject it.`,
        isRead: false,
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Removal request sent. Waiting for target member approval.',
      reference,
    });

  } catch (error: any) {
    console.error('Error creating removal request:', error);
    return NextResponse.json(
      { error: 'Failed to create removal request' },
      { status: 500 }
    );
  }
}

/**
 * Resolve the acting member from their Chain Account session token.
 *
 * This used to look up "any member of this account with a session hash", which
 * meant the request was attributed to whichever member the database happened to
 * return first — not the person who sent it. The member id now comes from the
 * signed session token and is re-checked against the account.
 */
async function resolveSessionMember(request: NextRequest, chainAccountId: string) {
  const headerToken =
    request.headers.get('X-Chain-Access-Token') ||
    request.headers.get('authorization')?.replace(/^Bearer /, '') ||
    null;

  if (!headerToken) return { error: 'Authentication required', status: 401 as const };

  const session = verifyChainAccountToken(headerToken);
  if (!session) return { error: 'Invalid or expired session', status: 401 as const };

  if (session.chainAccountId !== chainAccountId) {
    return { error: 'Access denied', status: 403 as const };
  }

  const member = await prisma.chainAccountMember.findFirst({
    where: { id: session.memberId, chainAccountId, userId: session.userId },
    include: {
      chainAccount: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!member) return { error: 'You are not a member of this Chain Account', status: 403 as const };

  return { member };
}
