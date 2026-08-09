import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Reject Chain Account Withdrawal (Admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { withdrawalId, reason } = body;

    if (!withdrawalId) {
      return NextResponse.json(
        { error: 'Withdrawal ID is required' },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // Fetch the withdrawal
    const withdrawal = await prisma.chainAccountWithdrawal.findUnique({
      where: { id: withdrawalId },
      include: {
        chainAccount: {
          include: {
            members: true
          }
        }
      }
    });

    if (!withdrawal) {
      return NextResponse.json(
        { error: 'Withdrawal not found' },
        { status: 404 }
      );
    }

    if (withdrawal.status !== 'APPROVED' && withdrawal.status !== 'PENDING_APPROVAL') {
      return NextResponse.json(
        { error: 'Withdrawal has already been processed' },
        { status: 400 }
      );
    }

    // Update withdrawal status and refund the Chain Account balance
    await prisma.$transaction([
      // Update withdrawal status
      prisma.chainAccountWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'REJECTED'
        }
      }),

      // Refund the Chain Account balance
      prisma.chainAccount.update({
        where: { id: withdrawal.chainAccountId },
        data: {
          balance: {
            increment: withdrawal.totalAmount
          }
        }
      }),

      // Note: ChainAccountTransaction doesn't have a status field

      // Create notification for all members
      ...withdrawal.chainAccount.members.map((member) =>
        prisma.chainAccountNotification.create({
          data: {
            chainAccountId: withdrawal.chainAccountId,
            userId: member.userId,
            type: 'APPROVAL_REJECTED',
            title: 'Withdrawal Rejected',
            message: `Withdrawal of $${withdrawal.totalAmount.toFixed(2)} was rejected. Reason: ${reason}. The amount has been refunded to the account.`,
            isRead: false
          }
        })
      )
    ]);

    return NextResponse.json({
      message: 'Withdrawal rejected',
      withdrawalId
    });
  } catch (error) {
    console.error('Error rejecting withdrawal:', error);
    return NextResponse.json(
      { error: 'Failed to reject withdrawal' },
      { status: 500 }
    );
  }
}
