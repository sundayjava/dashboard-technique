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
        channel: 'CRYPTO',
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
          title: 'Crypto Deposit Approved',
          message: `Your crypto deposit of ${deposit.amount.toFixed(8)} ${deposit.tokenSymbol || deposit.currency} has been approved and credited to your account.`,
        },
      });

      // Create activity log for user
      await tx.activityLog.create({
        data: {
          userId: deposit.userId,
          action: 'CRYPTO_DEPOSIT_APPROVED',
          description: `Crypto deposit of ${deposit.amount.toFixed(8)} ${deposit.tokenSymbol || deposit.currency} was approved and credited`,
          metadata: {
            depositId: depositId,
            amount: deposit.amount,
            currency: deposit.currency,
            tokenSymbol: deposit.tokenSymbol,
            network: deposit.network,
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
          action: 'ADMIN_CRYPTO_DEPOSIT_APPROVED',
          description: `Approved crypto deposit of ${deposit.amount.toFixed(8)} ${deposit.tokenSymbol || deposit.currency} for user ${deposit.user.name || deposit.user.email}`,
          metadata: {
            depositId: depositId,
            userId: deposit.userId,
            amount: deposit.amount,
            currency: deposit.currency,
            tokenSymbol: deposit.tokenSymbol,
            network: deposit.network,
            adminNotes: adminNotes || null,
          },
        },
      });

      return { deposit: updatedDeposit, account: updatedAccount };
    });

    return NextResponse.json({
      message: 'Crypto deposit approved successfully',
      deposit: result.deposit,
    });
  } catch (error) {
    console.error('Error approving crypto deposit:', error);
    return NextResponse.json(
      { error: 'Failed to approve crypto deposit' },
      { status: 500 }
    );
  }
}
