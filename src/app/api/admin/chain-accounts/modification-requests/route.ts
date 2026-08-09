import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendModificationDecisionEmail } from '@/lib/email';

export async function GET(request: NextRequest) {
  try {
    const modificationRequests = await prisma.chainAccountModificationRequest.findMany({
      where: {
        status: 'PENDING_ADMIN'
      },
      include: {
        chainAccount: {
          select: {
            id: true,
            accountNumber: true,
            accountName: true,
            authorizationModel: true,
            thresholdAmount: true,
            thresholdCurrency: true,
            primaryPurpose: true,
            purposeDescription: true,
          }
        },
        approvals: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const requestsWithDetails = await Promise.all(
      modificationRequests.map(async (request) => {
        const initiator = await prisma.chainAccountMember.findUnique({
          where: { id: request.initiatedBy },
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

        return {
          ...request,
          initiator,
        };
      })
    );

    return NextResponse.json({
      success: true,
      requests: requestsWithDetails,
    });

  } catch (error: any) {
    console.error('Error fetching modification requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch modification requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { requestId, action, adminNotes, adminId } = await request.json();

    if (!requestId || !action || !adminId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const modRequest = await prisma.chainAccountModificationRequest.findUnique({
      where: { id: requestId },
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

    if (action === 'approve') {
      // Apply the changes
      const changes = modRequest.proposedChanges as any;

      await prisma.chainAccount.update({
        where: { id: modRequest.chainAccountId },
        data: {
          ...changes,
        }
      });

      // Update request status
      await prisma.chainAccountModificationRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          processedBy: adminId,
          processedAt: new Date(),
          adminNotes,
        }
      });

      // Notify all members
      const members = await prisma.chainAccountMember.findMany({
        where: { chainAccountId: modRequest.chainAccountId },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            }
          }
        }
      });

      for (const member of members) {
        await prisma.chainAccountNotification.create({
          data: {
            chainAccountId: modRequest.chainAccountId,
            userId: member.userId,
            type: 'ACTION_COMPLETED',
            title: 'Account Modified',
            message: `Account ${modRequest.modificationType.toLowerCase().replace('_', ' ')} has been updated.`,
            isRead: false,
          }
        });
      }

      const approveEmailResults = await Promise.allSettled(
        members
          .filter((member) => member.user?.email)
          .map((member) =>
            sendModificationDecisionEmail({
              to: member.user!.email,
              memberName: member.user!.name || 'Member',
              accountName: modRequest.chainAccount.accountName,
              modificationType: modRequest.modificationType,
              decision: 'APPROVED',
              reasonNote: adminNotes,
            })
          )
      );
      const failedApproveEmails = approveEmailResults.filter((r) => r.status === 'rejected').length;
      if (failedApproveEmails > 0) {
        console.error(`Failed to send ${failedApproveEmails} modification approval email(s)`);
      }

      return NextResponse.json({
        success: true,
        message: 'Modification applied successfully',
      });

    } else if (action === 'reject') {
      await prisma.chainAccountModificationRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          processedBy: adminId,
          processedAt: new Date(),
          adminNotes,
          rejectionReason: adminNotes,
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
            reasonNote: adminNotes,
          });
        } catch (emailError) {
          console.error('Failed to send modification rejection email:', emailError);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Modification request rejected',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('Error processing modification request:', error);
    return NextResponse.json(
      { error: 'Failed to process modification request' },
      { status: 500 }
    );
  }
}
