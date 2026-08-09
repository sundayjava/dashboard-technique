import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('X-Chain-Access-Token');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { removalRequestId, decision, notes } = await request.json();

    if (!removalRequestId || !decision) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const removalRequest = await prisma.chainAccountRemovalRequest.findUnique({
      where: { id: removalRequestId },
    });

    if (!removalRequest) {
      return NextResponse.json(
        { error: 'Removal request not found' },
        { status: 404 }
      );
    }

    // Get session member
    const sessionMember = await prisma.chainAccountMember.findFirst({
      where: {
        chainAccountId: removalRequest.chainAccountId,
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
    const approval = await prisma.chainAccountRemovalApproval.findUnique({
      where: {
        removalRequestId_memberId: {
          removalRequestId,
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
    await prisma.chainAccountRemovalApproval.update({
      where: { id: approval.id },
      data: {
        decision,
        decidedAt: new Date(),
        notes,
      }
    });

    // Check if all members have voted
    const allApprovals = await prisma.chainAccountRemovalApproval.findMany({
      where: { removalRequestId }
    });

    const pendingVotes = allApprovals.filter(a => !a.decision).length;
    const rejectedVotes = allApprovals.filter(a => a.decision === 'REJECTED').length;

    if (rejectedVotes > 0) {
      // Any rejection cancels the request
      await prisma.chainAccountRemovalRequest.update({
        where: { id: removalRequestId },
        data: {
          status: 'REJECTED',
          allApproved: false,
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Removal request rejected by member vote.',
      });
    }

    if (pendingVotes === 0) {
      // All approved - move to admin review
      await prisma.chainAccountRemovalRequest.update({
        where: { id: removalRequestId },
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
    console.error('Error voting on removal:', error);
    return NextResponse.json(
      { error: 'Failed to record vote' },
      { status: 500 }
    );
  }
}
