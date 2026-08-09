import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySessionToken } from '@/lib/session';
import { sendModificationDecisionEmail, sendClosureAdminReviewEmail } from '@/lib/email';

// GET - Load a member's closure approval by reference + member id
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('ref');
    const memberId = searchParams.get('member');

    if (!reference || !memberId) {
      return NextResponse.json(
        { error: 'Reference and member are required' },
        { status: 400 }
      );
    }

    const closureRequest = await prisma.chainAccountClosureRequest.findUnique({
      where: { reference },
      include: {
        chainAccount: {
          select: {
            accountName: true,
            accountNumber: true,
            balance: true,
            currency: true,
          }
        }
      }
    });

    if (!closureRequest) {
      return NextResponse.json(
        { error: 'Closure request not found' },
        { status: 404 }
      );
    }

    const approval = await prisma.chainAccountClosureApproval.findUnique({
      where: {
        closureRequestId_memberId: {
          closureRequestId: closureRequest.id,
          memberId,
        }
      }
    });

    if (!approval) {
      return NextResponse.json(
        { error: 'You are not authorized to vote on this request' },
        { status: 403 }
      );
    }

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

    return NextResponse.json({
      success: true,
      data: {
        reference: closureRequest.reference,
        status: closureRequest.status,
        reason: closureRequest.reason,
        chainAccount: closureRequest.chainAccount,
        initiator,
        myDecision: approval.decision,
      }
    });

  } catch (error: any) {
    console.error('Error fetching closure approval:', error);
    return NextResponse.json(
      { error: 'Failed to fetch closure request' },
      { status: 500 }
    );
  }
}

// POST - Confirm or reject the closure as a specific member
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const session = verifySessionToken(authHeader.substring(7));
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    const { reference, memberId, action, notes } = await request.json();

    if (!reference || !memberId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const closureRequest = await prisma.chainAccountClosureRequest.findUnique({
      where: { reference },
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

    if (closureRequest.status !== 'PENDING_APPROVAL') {
      return NextResponse.json(
        { error: 'This request has already been processed' },
        { status: 400 }
      );
    }

    const member = await prisma.chainAccountMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.userId !== session.userId) {
      return NextResponse.json(
        { error: 'You are not authorized to vote on this request' },
        { status: 403 }
      );
    }

    const approval = await prisma.chainAccountClosureApproval.findUnique({
      where: {
        closureRequestId_memberId: {
          closureRequestId: closureRequest.id,
          memberId,
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

    const decision = action === 'approve' ? 'APPROVED' : 'REJECTED';

    await prisma.chainAccountClosureApproval.update({
      where: { id: approval.id },
      data: {
        decision,
        decidedAt: new Date(),
        notes,
      }
    });

    const allApprovals = await prisma.chainAccountClosureApproval.findMany({
      where: { closureRequestId: closureRequest.id }
    });

    const pendingVotes = allApprovals.filter((a) => !a.decision).length;
    const rejectedVotes = allApprovals.filter((a) => a.decision === 'REJECTED').length;

    if (rejectedVotes > 0) {
      await prisma.chainAccountClosureRequest.update({
        where: { id: closureRequest.id },
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
        message: 'Closure request rejected.',
      });
    }

    if (pendingVotes === 0) {
      await prisma.chainAccountClosureRequest.update({
        where: { id: closureRequest.id },
        data: {
          status: 'PENDING_ADMIN',
          allApproved: true,
        }
      });

      const initiator = await prisma.chainAccountMember.findUnique({
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
          initiatorName: initiator?.user?.name || 'A member',
          reason: closureRequest.reason,
        });
      } catch (emailError) {
        console.error('Failed to send admin closure review email:', emailError);
      }

      return NextResponse.json({
        success: true,
        message: 'All members have confirmed. Request sent to admin for final closure.',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Your confirmation has been recorded.',
    });

  } catch (error: any) {
    console.error('Error processing closure approval:', error);
    return NextResponse.json(
      { error: 'Failed to process closure approval' },
      { status: 500 }
    );
  }
}
