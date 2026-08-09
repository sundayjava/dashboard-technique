import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const removalRequests = await prisma.chainAccountRemovalRequest.findMany({
      where: {
        status: {
          in: ['PENDING_ADMIN']
        }
      },
      include: {
        chainAccount: {
          select: {
            accountNumber: true,
            accountName: true,
          }
        },
        approvals: {
          include: {
            removalRequest: {
              include: {
                chainAccount: {
                  include: {
                    members: {
                      include: {
                        user: {
                          select: {
                            id: true,
                            name: true,
                            email: true,
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get member details for each request
    const requestsWithDetails = await Promise.all(
      removalRequests.map(async (request) => {
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

        const target = await prisma.chainAccountMember.findUnique({
          where: { id: request.targetMemberId },
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
          target,
        };
      })
    );

    return NextResponse.json({
      success: true,
      requests: requestsWithDetails,
    });

  } catch (error: any) {
    console.error('Error fetching removal requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch removal requests' },
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

    const removalRequest = await prisma.chainAccountRemovalRequest.findUnique({
      where: { id: requestId },
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

    if (action === 'approve') {
      // Remove the member
      await prisma.chainAccountMember.delete({
        where: { id: removalRequest.targetMemberId }
      });

      // Update request status
      await prisma.chainAccountRemovalRequest.update({
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
        where: { chainAccountId: removalRequest.chainAccountId }
      });

      for (const member of members) {
        await prisma.chainAccountNotification.create({
          data: {
            chainAccountId: removalRequest.chainAccountId,
            userId: member.userId,
            type: 'ACTION_COMPLETED',
            title: 'Member Removed',
            message: 'A member has been removed from the Chain Account.',
            isRead: false,
          }
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Member removed successfully',
      });

    } else if (action === 'reject') {
      await prisma.chainAccountRemovalRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          processedBy: adminId,
          processedAt: new Date(),
          adminNotes,
          rejectionReason: adminNotes,
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Removal request rejected',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('Error processing removal request:', error);
    return NextResponse.json(
      { error: 'Failed to process removal request' },
      { status: 500 }
    );
  }
}
