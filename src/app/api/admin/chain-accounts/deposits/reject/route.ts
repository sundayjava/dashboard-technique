import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Reject Chain Account Deposit (Admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { depositId, reason } = body;

    if (!depositId) {
      return NextResponse.json(
        { error: 'Deposit ID is required' },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // Fetch the deposit
    const deposit = await prisma.chainAccountDeposit.findUnique({
      where: { id: depositId },
      include: {
        chainAccount: {
          include: {
            members: true
          }
        }
      }
    });

    if (!deposit) {
      return NextResponse.json(
        { error: 'Deposit not found' },
        { status: 404 }
      );
    }

    if (deposit.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Deposit has already been processed' },
        { status: 400 }
      );
    }

    // Update deposit status
    await prisma.$transaction([
      // Update deposit status
      prisma.chainAccountDeposit.update({
        where: { id: depositId },
        data: {
          status: 'REJECTED'
        }
      }),

      // Update transaction status
      // Note: ChainAccountTransaction doesn't have a status field

      // Create notification for all members
      ...deposit.chainAccount.members.map((member) =>
        prisma.chainAccountNotification.create({
          data: {
            chainAccountId: deposit.chainAccountId,
            userId: member.userId,
            type: 'APPROVAL_REJECTED',
            title: 'Deposit Rejected',
            message: `Your deposit of $${deposit.amount.toFixed(2)} was rejected. Reason: ${reason}`,
            isRead: false
          }
        })
      )
    ]);

    return NextResponse.json({
      message: 'Deposit rejected',
      depositId
    });
  } catch (error) {
    console.error('Error rejecting deposit:', error);
    return NextResponse.json(
      { error: 'Failed to reject deposit' },
      { status: 500 }
    );
  }
}
