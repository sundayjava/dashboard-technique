import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendModificationDecisionEmail } from '@/lib/email';

export async function GET(request: NextRequest) {
  try {
    const closureRequests = await prisma.chainAccountClosureRequest.findMany({
      where: {
        status: 'PENDING_ADMIN'
      },
      include: {
        chainAccount: {
          select: {
            id: true,
            accountNumber: true,
            accountName: true,
            balance: true,
            currency: true,
          }
        },
        approvals: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const requestsWithDetails = await Promise.all(
      closureRequests.map(async (request) => {
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
    console.error('Error fetching closure requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch closure requests' },
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

    const closureRequest = await prisma.chainAccountClosureRequest.findUnique({
      where: { id: requestId },
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

    if (action === 'approve') {
      // Check if account has balance
      if (closureRequest.chainAccount.balance > 0) {
        return NextResponse.json(
          { error: 'Cannot close account with remaining balance. Please withdraw all funds first.' },
          { status: 400 }
        );
      }

      // Get all members before closing
      const members = await prisma.chainAccountMember.findMany({
        where: { chainAccountId: closureRequest.chainAccountId },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            }
          }
        }
      });

      // Close the account
      await prisma.chainAccount.update({
        where: { id: closureRequest.chainAccountId },
        data: {
          status: 'CLOSED',
        }
      });

      // Update request status
      await prisma.chainAccountClosureRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          processedBy: adminId,
          processedAt: new Date(),
          adminNotes,
        }
      });

      // Notify all members in their main notifications
      for (const member of members) {
        await prisma.notification.create({
          data: {
            userId: member.userId,
            type: 'SYSTEM',
            title: 'Chain Account Closed',
            message: `Chain Account "${closureRequest.chainAccount.accountName}" has been closed.`,
            isRead: false,
          }
        });
      }

      const closeEmailResults = await Promise.allSettled(
        members
          .filter((member) => member.user?.email)
          .map((member) =>
            sendModificationDecisionEmail({
              to: member.user!.email,
              memberName: member.user!.name || 'Member',
              accountName: closureRequest.chainAccount.accountName,
              modificationType: 'CLOSURE',
              decision: 'APPROVED',
              reasonNote: adminNotes,
            })
          )
      );
      const failedCloseEmails = closeEmailResults.filter((r) => r.status === 'rejected').length;
      if (failedCloseEmails > 0) {
        console.error(`Failed to send ${failedCloseEmails} closure approval email(s)`);
      }

      return NextResponse.json({
        success: true,
        message: 'Account closed successfully',
      });

    } else if (action === 'reject') {
      await prisma.chainAccountClosureRequest.update({
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
            reasonNote: adminNotes,
          });
        } catch (emailError) {
          console.error('Failed to send closure rejection email:', emailError);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Closure request rejected',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('Error processing closure request:', error);
    return NextResponse.json(
      { error: 'Failed to process closure request' },
      { status: 500 }
    );
  }
}
