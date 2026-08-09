import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Approve Chain Account Withdrawal (Admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { withdrawalId } = body;

    if (!withdrawalId) {
      return NextResponse.json(
        { error: 'Withdrawal ID is required' },
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

    if (withdrawal.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Withdrawal must be in APPROVED status to process' },
        { status: 400 }
      );
    }

    const distributions = withdrawal.distribution as Array<{ memberId: string; amount: number }>;

    // Execute all operations in a transaction
    await prisma.$transaction(async (tx) => {
      // Update withdrawal status
      await tx.chainAccountWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'COMPLETED'
        }
      });

      // Credit each member's personal wallet and notify them
      for (const dist of distributions) {
        const member = withdrawal.chainAccount.members.find(m => m.id === dist.memberId);
        if (!member || !(dist.amount > 0)) continue;

        // Get the user's first account (personal wallet)
        const userAccount = await tx.account.findFirst({
          where: { userId: member.userId },
          orderBy: { createdAt: 'asc' }
        });

        if (userAccount) {
          await tx.account.update({
            where: { id: userAccount.id },
            data: {
              balance: {
                increment: Number(dist.amount)
              },
              availableBalance: {
                increment: Number(dist.amount)
              }
            }
          });
        }

        await tx.chainAccountNotification.create({
          data: {
            chainAccountId: withdrawal.chainAccountId,
            userId: member.userId,
            type: 'ACTION_COMPLETED',
            title: 'Withdrawal Completed',
            message: `Withdrawal approved. $${Number(dist.amount).toFixed(2)} has been credited to your personal wallet.`,
            isRead: false
          }
        });
      }
    });

    return NextResponse.json({
      message: 'Withdrawal approved successfully',
      withdrawalId
    });
  } catch (error) {
    console.error('Error approving withdrawal:', error);
    return NextResponse.json(
      { error: 'Failed to approve withdrawal' },
      { status: 500 }
    );
  }
}
