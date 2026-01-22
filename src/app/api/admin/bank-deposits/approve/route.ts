import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { depositId, adminId, adminNotes } = body;

    if (!depositId || !adminId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get deposit details
    const deposit = await prisma.transaction.findUnique({
      where: {
        id: depositId,
        transactionType: 'DEPOSIT',
        channel: 'BANK',
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        account: true,
      },
    });

    if (!deposit) {
      return NextResponse.json({ error: 'Deposit not found' }, { status: 404 });
    }

    if (deposit.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'This deposit has already been processed' },
        { status: 400 }
      );
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Credit the account
      const updatedAccount = await tx.account.update({
        where: { id: deposit.accountId! },
        data: {
          balance: { increment: deposit.amount },
        },
      });

      // Update deposit transaction status
      const updatedDeposit = await tx.transaction.update({
        where: { id: depositId },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
          processedBy: adminId,
          adminNotes: adminNotes || null,
          balanceAfter: updatedAccount.balance,
        },
      });

      // Create notification for user
      await tx.notification.create({
        data: {
          userId: deposit.userId,
          type: 'TRANSACTION',
          title: 'Bank Deposit Approved',
          message: `Your bank deposit of ${deposit.currency} ${deposit.amount.toFixed(2)} has been approved and credited to your account.`,
        },
      });

      // Create activity log for user
      await tx.activityLog.create({
        data: {
          userId: deposit.userId,
          action: 'BANK_DEPOSIT_APPROVED',
          description: `Bank deposit of ${deposit.currency} ${deposit.amount.toFixed(2)} was approved and credited`,
          metadata: {
            depositId: depositId,
            amount: deposit.amount,
            currency: deposit.currency,
            accountId: deposit.accountId,
            processedBy: adminId,
            adminNotes: adminNotes || null,
          },
        },
      });

      // Create activity log for admin
      await tx.activityLog.create({
        data: {
          userId: adminId,
          action: 'ADMIN_BANK_DEPOSIT_APPROVED',
          description: `Approved bank deposit of ${deposit.currency} ${deposit.amount.toFixed(2)} for user ${deposit.user.name || deposit.user.email}`,
          metadata: {
            depositId: depositId,
            targetUserId: deposit.userId,
            amount: deposit.amount,
            currency: deposit.currency,
            accountId: deposit.accountId,
          },
        },
      });

      return updatedDeposit;
    });

    return NextResponse.json({
      deposit: result,
      message: 'Bank deposit approved and account credited successfully',
    });
  } catch (error) {
    console.error('Error approving bank deposit:', error);
    return NextResponse.json(
      { error: 'Failed to approve bank deposit' },
      { status: 500 }
    );
  }
}
