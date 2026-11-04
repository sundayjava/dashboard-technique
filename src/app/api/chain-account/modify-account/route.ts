import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyChainAccountToken } from '@/lib/chain-account-session';
import { sanitizeProposedChanges } from '@/lib/chain-account-modifications';

export async function POST(request: NextRequest) {
  try {
    const { chainAccountId, modificationType, proposedChanges, reason } = await request.json();

    if (!chainAccountId || !modificationType || !proposedChanges || !reason) {
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

    // Only these fields are a member's to change. The proposal is stored and
    // replayed into the account by an admin later, so an unchecked object here
    // would let a caller rewrite any column on the account — the balance
    // included. Anything not on this list is rejected rather than ignored, so a
    // typo fails loudly instead of silently approving nothing.
    const sanitized = sanitizeProposedChanges(proposedChanges);
    if ('error' in sanitized) {
      return NextResponse.json({ error: sanitized.error }, { status: 400 });
    }

    // Generate reference
    const reference = `MOD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Changing how the account is governed needs every party's approval. The
    // parties settle it between themselves — there is no admin step — and the
    // change is applied by whichever approval is the last one in. Nothing is
    // written to the account here.
    const modificationRequest = await prisma.chainAccountModificationRequest.create({
      data: {
        chainAccountId,
        initiatedBy: sessionMember.id,
        modificationType,
        proposedChanges: sanitized.changes,
        reason,
        reference,
        status: 'PENDING_APPROVAL',
      }
    });

    const allMembers = await prisma.chainAccountMember.findMany({
      where: { chainAccountId },
    });

    // Raising the request is the initiator's own approval, so theirs is
    // recorded rather than asked for.
    const initiatorName = sessionMember.user?.name || 'A member';
    const what = modificationType.toLowerCase().replace(/_/g, ' ');

    for (const member of allMembers) {
      const isInitiator = member.id === sessionMember.id;

      await prisma.chainAccountModificationApproval.create({
        data: {
          modificationRequestId: modificationRequest.id,
          memberId: member.id,
          ...(isInitiator
            ? {
                decision: 'APPROVED',
                decidedAt: new Date(),
                notes: 'Raised this change request',
              }
            : {}),
        }
      });

      if (isInitiator) continue;

      await prisma.chainAccountNotification.create({
        data: {
          chainAccountId,
          userId: member.userId,
          type: 'MODIFICATION_REQUEST',
          title: 'Account Change Approval Required',
          message: `${initiatorName} wants to change this account's ${what}. Your approval is required — open the Approvals panel in your Chain Account dashboard to approve or reject it.`,
          isRead: false,
        }
      });
    }

    // A sole remaining member has nobody to wait on.
    const stillToDecide = await prisma.chainAccountModificationApproval.count({
      where: { modificationRequestId: modificationRequest.id, decision: null },
    });

    if (stillToDecide === 0) {
      // Sole remaining member: nobody else to ask, so the change applies now.
      await prisma.$transaction([
        prisma.chainAccount.update({
          where: { id: chainAccountId },
          data: sanitized.changes,
        }),
        prisma.chainAccountModificationRequest.update({
          where: { id: modificationRequest.id },
          data: { status: 'APPROVED', allApproved: true, processedAt: new Date() },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: 'Change applied. You are the only member, so there was nobody else to approve it.',
        reference,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Change requested. It will be applied once all the other members approve it.',
      reference,
    });

  } catch (error: any) {
    console.error('Error creating modification request:', error);
    return NextResponse.json(
      { error: 'Failed to create modification request' },
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
