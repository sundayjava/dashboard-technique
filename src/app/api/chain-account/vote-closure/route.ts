import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendModificationDecisionEmail, sendClosureAdminReviewEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('X-Chain-Access-Token');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { closureRequestId, decision, notes } = await request.json();

    if (!closureRequestId || !decision) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const closureRequest = await prisma.chainAccountClosureRequest.findUnique({
      where: { id: closureRequestId },
      include: {
        chainAccount: true,
      }
    });

    if (!closureRequest) {
      return NextResponse.json(
        { error: 'Closure request not found' },
        { status: 404 }
      );
    }

    // Get session member
    const sessionMember = await prisma.chainAccountMember.findFirst({
      where: {
        chainAccountId: closureRequest.chainAccountId,
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
    const approval = await prisma.chainAccountClosureApproval.findUnique({
      where: {
        closureRequestId_memberId: {
          closureRequestId,
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
    await prisma.chainAccountClosureApproval.update({
      where: { id: approval.id },
      data: {
        decision,
        decidedAt: new Date(),
        notes,
      }
    });

    // Check if all members have voted
    const allApprovals = await prisma.chainAccountClosureApproval.findMany({
      where: { closureRequestId }
    });

    const pendingVotes = allApprovals.filter(a => !a.decision).length;
    const rejectedVotes = allApprovals.filter(a => a.decision === 'REJECTED').length;

    if (rejectedVotes > 0) {
      // Any rejection cancels the request
      await prisma.chainAccountClosureRequest.update({
        where: { id: closureRequestId },
        data: {
          status: 'REJECTED',
          allApproved: false,
        }
      });

      const initiator = await prisma.chainAccountMember.findUnique({
        where: { id: closureRequest.initiatedBy },
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
            accountName: closureRequest.chainAccount.accountName,
            modificationType: 'CLOSURE',
            decision: 'REJECTED',
            reasonNote: notes,
          });
        } catch (emailError) {
          console.error('Failed to send closure rejection email:', emailError);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Closure request rejected by member vote.',
      });
    }

    if (pendingVotes === 0) {
      // All approved - move to admin review
      await prisma.chainAccountClosureRequest.update({
        where: { id: closureRequestId },
        data: {
          status: 'PENDING_ADMIN',
          allApproved: true,
        }
      });

      const closureInitiator = await prisma.chainAccountMember.findUnique({
        where: { id: closureRequest.initiatedBy },
        include: {
          user: {
            select: {
              name: true,
            }
          }
        }
      });

      try {
        await sendClosureAdminReviewEmail({
          accountName: closureRequest.chainAccount.accountName,
          accountNumber: closureRequest.chainAccount.accountNumber,
          initiatorName: closureInitiator?.user?.name || 'A member',
          reason: closureRequest.reason,
        });
      } catch (emailError) {
        console.error('Failed to send admin closure review email:', emailError);
      }

      return NextResponse.json({
        success: true,
        message: 'All members approved. Request sent to admin for final closure.',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Your vote has been recorded.',
    });

  } catch (error: any) {
    console.error('Error voting on closure:', error);
    return NextResponse.json(
      { error: 'Failed to record vote' },
      { status: 500 }
    );
  }
}
