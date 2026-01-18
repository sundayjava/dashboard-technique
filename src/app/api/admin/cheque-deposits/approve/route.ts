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
    const deposit = await prisma.chequeDeposit.findUnique({
      where: { id: depositId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!deposit) {
      return NextResponse.json({ error: 'Deposit not found' }, { status: 404 });
    }

    if (deposit.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'This deposit has already been processed' },
        { status: 400 }
      );
    }

    // Get account to credit
    const account = await prisma.account.findUnique({
      where: { id: deposit.accountId },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Update cheque deposit status
      const updatedDeposit = await tx.chequeDeposit.update({
        where: { id: depositId },
        data: {
          status: 'APPROVED',
          processedAt: new Date(),
          processedBy: adminId,
          adminNotes: adminNotes || null,
        },
      });

      // Credit the account
      const updatedAccount = await tx.account.update({
        where: { id: deposit.accountId },
        data: {
          balance: { increment: deposit.amount },
          availableBalance: { increment: deposit.amount },
        },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId: deposit.userId,
          accountId: deposit.accountId,
          transactionType: 'DEPOSIT',
          amount: deposit.amount,
          currency: account.currency,
          description: `Cheque deposit approved - Ref: ${depositId.substring(0, 8)}`,
          reference: `CHQ-${depositId.substring(0, 8)}-${Date.now()}`,
          status: 'COMPLETED',
          balanceAfter: updatedAccount.balance,
        },
      });

      // Create notification for user
      await tx.notification.create({
        data: {
          userId: deposit.userId,
          type: 'TRANSACTION',
          title: 'Cheque Deposit Approved',
          message: `Your cheque deposit of ${account.currency} ${deposit.amount.toFixed(2)} has been approved and credited to your account.`,
        },
      });

      // Create activity log for user
      await tx.activityLog.create({
        data: {
          userId: deposit.userId,
          action: 'CHEQUE_DEPOSIT_APPROVED',
          description: `Cheque deposit of ${account.currency} ${deposit.amount.toFixed(2)} was approved by admin and credited to account`,
          metadata: {
            depositId: depositId,
            amount: deposit.amount,
            currency: account.currency,
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
          action: 'ADMIN_CHEQUE_APPROVED',
          description: `Approved cheque deposit of ${account.currency} ${deposit.amount.toFixed(2)} for user ${deposit.user.name || deposit.user.email}`,
          metadata: {
            depositId: depositId,
            targetUserId: deposit.userId,
            amount: deposit.amount,
            currency: account.currency,
            accountId: deposit.accountId,
          },
        },
      });

      return updatedDeposit;
    });

    return NextResponse.json({
      deposit: result,
      message: 'Cheque deposit approved and account credited successfully',
    });
  } catch (error) {
    console.error('Error approving cheque deposit:', error);
    return NextResponse.json(
      { error: 'Failed to approve cheque deposit' },
      { status: 500 }
    );
  }
}
