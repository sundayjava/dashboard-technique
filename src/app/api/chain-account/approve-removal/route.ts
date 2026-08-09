import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendModificationDecisionEmail } from '@/lib/email';

// GET - Load removal request by reference
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('ref');

    if (!reference) {
      return NextResponse.json(
        { error: 'Reference required' },
        { status: 400 }
      );
    }

    const removalRequest = await prisma.chainAccountRemovalRequest.findUnique({
      where: { reference },
      include: {
        chainAccount: {
          select: {
            accountName: true,
            accountNumber: true,
          }
        }
      }
    });

    if (!removalRequest) {
      return NextResponse.json(
        { error: 'Removal request not found' },
        { status: 404 }
      );
    }

    // Get initiator and target details
    const initiator = await prisma.chainAccountMember.findUnique({
      where: { id: removalRequest.initiatedBy },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          }
        }
      }
    });

    const target = await prisma.chainAccountMember.findUnique({
      where: { id: removalRequest.targetMemberId },
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
        ...removalRequest,
        initiator,
        target,
      }
    });

  } catch (error: any) {
    console.error('Error fetching removal request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch removal request' },
      { status: 500 }
    );
  }
}

// POST - Approve or reject removal
export async function POST(request: NextRequest) {
  try {
    const { reference, action } = await request.json();

    if (!reference || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const removalRequest = await prisma.chainAccountRemovalRequest.findUnique({
      where: { reference },
      include: {
        chainAccount: true,
      }
    });

    if (!removalRequest) {
      return NextResponse.json(
        { error: 'Removal request not found' },
        { status: 404 }
      );
    }

    if (removalRequest.status !== 'PENDING_TARGET_APPROVAL') {
      return NextResponse.json(
        { error: 'This request has already been processed' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      const targetMember = await prisma.chainAccountMember.findUnique({
        where: { id: removalRequest.targetMemberId },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            }
          }
        }
      });

      // Target approved their own removal - remove them immediately, no further votes needed
      await prisma.chainAccountMember.delete({
        where: { id: removalRequest.targetMemberId }
      });

      await prisma.chainAccountRemovalRequest.update({
        where: { reference },
        data: {
          targetApproved: true,
          targetApprovedAt: new Date(),
          status: 'APPROVED',
          allApproved: true,
          processedAt: new Date(),
        }
      });

      // Get all remaining members
      const remainingMembers = await prisma.chainAccountMember.findMany({
        where: {
          chainAccountId: removalRequest.chainAccountId,
        },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            }
          }
        }
      });

      // Notify remaining members
      for (const member of remainingMembers) {
        await prisma.chainAccountNotification.create({
          data: {
            chainAccountId: removalRequest.chainAccountId,
            userId: member.userId,
            type: 'ACTION_COMPLETED',
            title: 'Member Removed',
            message: `${targetMember?.user?.name || 'A member'} has been removed from the Chain Account.`,
            isRead: false,
          }
        });
      }

      const emailResults = await Promise.allSettled(
        remainingMembers
          .filter((member) => member.user?.email)
          .map((member) =>
            sendModificationDecisionEmail({
              to: member.user!.email,
              memberName: member.user!.name || 'Member',
              accountName: removalRequest.chainAccount.accountName,
              modificationType: 'MEMBER_REMOVAL',
              decision: 'APPROVED',
              reasonNote: removalRequest.reason,
            })
          )
      );
      const failedEmails = emailResults.filter((r) => r.status === 'rejected').length;
      if (failedEmails > 0) {
        console.error(`Failed to send ${failedEmails} member removal notification email(s)`);
      }

      return NextResponse.json({
        success: true,
        message: 'You have been removed from the Chain Account.',
      });

    } else if (action === 'reject') {
      // Target rejected - cancel the request
      await prisma.chainAccountRemovalRequest.update({
        where: { reference },
        data: {
          status: 'REJECTED',
        }
      });

      // Notify initiator
      const initiator = await prisma.chainAccountMember.findUnique({
        where: { id: removalRequest.initiatedBy },
      });

      if (initiator) {
        await prisma.chainAccountNotification.create({
          data: {
            chainAccountId: removalRequest.chainAccountId,
            userId: initiator.userId,
            type: 'APPROVAL_REJECTED',
            title: 'Removal Request Rejected',
            message: 'The member rejected their removal from the Chain Account.',
            isRead: false,
          }
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Removal request rejected and cancelled.',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('Error processing removal approval:', error);
    return NextResponse.json(
      { error: 'Failed to process approval' },
      { status: 500 }
    );
  }
}
