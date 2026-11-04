import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyChainAccountToken } from '@/lib/chain-account-session';

export async function POST(request: NextRequest) {
  try {
    const { chainAccountId, reason } = await request.json();

    if (!chainAccountId || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const resolved = await resolveSessionMember(request, chainAccountId);
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const sessionMember = resolved.member;

    // Check if account has balance
    if (sessionMember.chainAccount.balance > 0) {
      return NextResponse.json(
        { error: 'Cannot close account with remaining balance. Please withdraw all funds first.' },
        { status: 400 }
      );
    }

    // Generate reference
    const reference = `CLO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create closure request
    const closureRequest = await prisma.chainAccountClosureRequest.create({
      data: {
        chainAccountId,
        initiatedBy: sessionMember.id,
        reason,
        reference,
        status: 'PENDING_APPROVAL',
      }
    });

    // Get all members
    const allMembers = await prisma.chainAccountMember.findMany({
      where: { chainAccountId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          }
        }
      }
    });

    // Closing the account needs every party's approval. Raising the request is
    // the initiator's own approval, so theirs is recorded rather than asked for
    // — the audit trail still shows a decision from every member.
    const initiatorName = sessionMember.user?.name || 'A member';

    for (const member of allMembers) {
      const isInitiator = member.id === sessionMember.id;

      await prisma.chainAccountClosureApproval.create({
        data: {
          closureRequestId: closureRequest.id,
          memberId: member.id,
          ...(isInitiator
            ? {
                decision: 'APPROVED',
                decidedAt: new Date(),
                notes: 'Raised this closure request',
              }
            : {}),
        }
      });

      if (isInitiator) continue;

      // Notify member
      await prisma.chainAccountNotification.create({
        data: {
          chainAccountId,
          userId: member.userId,
          type: 'CLOSURE_REQUEST',
          title: 'Account Closure Request',
          message: `${initiatorName} has requested to close this Chain Account. Your approval is required — open the Approvals panel in your Chain Account dashboard to confirm or reject it.`,
          isRead: false,
        }
      });
    }

    // A sole remaining member closing their own account has nobody to wait on.
    const stillToDecide = await prisma.chainAccountClosureApproval.count({
      where: { closureRequestId: closureRequest.id, decision: null },
    });

    if (stillToDecide === 0) {
      await prisma.chainAccountClosureRequest.update({
        where: { id: closureRequest.id },
        data: { status: 'PENDING_ADMIN', allApproved: true },
      });

      return NextResponse.json({
        success: true,
        message: 'Closure request created and sent to an admin for final closure.',
        reference,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Closure request created. All members must approve.',
      reference,
    });

  } catch (error: any) {
    console.error('Error creating closure request:', error);
    return NextResponse.json(
      { error: 'Failed to create closure request' },
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
