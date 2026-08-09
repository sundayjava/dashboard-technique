import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Approve Chain Account Deposit (Admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { depositId } = body;

    if (!depositId) {
      return NextResponse.json(
        { error: 'Deposit ID is required' },
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

    // Update deposit status and credit the Chain Account balance
    await prisma.$transaction([
      // Update deposit status
      prisma.chainAccountDeposit.update({
        where: { id: depositId },
        data: {
          status: 'CONFIRMED'
        }
      }),

      // Credit the Chain Account balance
      prisma.chainAccount.update({
        where: { id: deposit.chainAccountId },
        data: {
          balance: {
            increment: deposit.amount
          }
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
            type: 'DEPOSIT_CONFIRMED',
            title: 'Deposit Confirmed',
            message: `Your deposit of $${deposit.amount.toFixed(2)} has been confirmed and credited to the account.`,
            isRead: false
          }
        })
      )
    ]);

    return NextResponse.json({
      message: 'Deposit approved successfully',
      depositId
    });
  } catch (error) {
    console.error('Error approving deposit:', error);
    return NextResponse.json(
      { error: 'Failed to approve deposit' },
      { status: 500 }
    );
  }
}
