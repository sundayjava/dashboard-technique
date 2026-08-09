import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendModificationDecisionEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('X-Chain-Access-Token');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { modificationRequestId, decision, notes } = await request.json();

    if (!modificationRequestId || !decision) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const modRequest = await prisma.chainAccountModificationRequest.findUnique({
      where: { id: modificationRequestId },
      include: {
        chainAccount: true,
      }
    });

    if (!modRequest) {
      return NextResponse.json(
        { error: 'Modification request not found' },
        { status: 404 }
      );
    }

    // Get session member
    const sessionMember = await prisma.chainAccountMember.findFirst({
      where: {
        chainAccountId: modRequest.chainAccountId,
        accessTokenHash: { not: null }
      }
    });

    if (!sessionMember) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 401 }
      );
    }

    // Find approval record
    const approval = await prisma.chainAccountModificationApproval.findUnique({
      where: {
        modificationRequestId_memberId: {
          modificationRequestId,
          memberId: sessionMember.id,
        }
      }
    });

    if (!approval) {
      return NextResponse.json(
        { error: 'You are not authorized to vote on this request' },
        { status: 403 }
      );
    }

    if (approval.decision) {
      return NextResponse.json(
        { error: 'You have already voted on this request' },
        { status: 400 }
      );
    }

    // Record the vote
    await prisma.chainAccountModificationApproval.update({
      where: { id: approval.id },
      data: {
        decision,
        decidedAt: new Date(),
        notes,
      }
    });

    // Check if all members have voted
    const allApprovals = await prisma.chainAccountModificationApproval.findMany({
      where: { modificationRequestId }
    });

    const pendingVotes = allApprovals.filter(a => !a.decision).length;
    const rejectedVotes = allApprovals.filter(a => a.decision === 'REJECTED').length;

    if (rejectedVotes > 0) {
      // Any rejection cancels the request
      await prisma.chainAccountModificationRequest.update({
        where: { id: modificationRequestId },
        data: {
          status: 'REJECTED',
          allApproved: false,
        }
      });

      const initiator = await prisma.chainAccountMember.findUnique({
        where: { id: modRequest.initiatedBy },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            }
          }
        }
      });

      if (initiator?.user?.email) {
        try {
          await sendModificationDecisionEmail({
            to: initiator.user.email,
            memberName: initiator.user.name || 'Member',
            accountName: modRequest.chainAccount.accountName,
            modificationType: modRequest.modificationType,
            decision: 'REJECTED',
            reasonNote: notes,
          });
        } catch (emailError) {
          console.error('Failed to send modification rejection email:', emailError);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Modification request rejected by member vote.',
      });
    }

    if (pendingVotes === 0) {
      // All approved - move to admin review
      await prisma.chainAccountModificationRequest.update({
        where: { id: modificationRequestId },
        data: {
          status: 'PENDING_ADMIN',
          allApproved: true,
        }
      });

      return NextResponse.json({
        success: true,
        message: 'All members approved. Request sent to admin for final approval.',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Your vote has been recorded.',
    });

  } catch (error: any) {
    console.error('Error voting on modification:', error);
    return NextResponse.json(
      { error: 'Failed to record vote' },
      { status: 500 }
    );
  }
}
