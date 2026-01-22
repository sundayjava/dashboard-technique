import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { depositId, adminId, rejectionReason } = body;

    if (!depositId || !adminId || !rejectionReason) {
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
      },
    });

    if (!deposit) {
      return NextResponse.json({ error: 'Deposit not found' }, { status: 404 });
    }

    if (deposit.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending deposits can be rejected' },
        { status: 400 }
      );
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Update deposit status to FAILED
      const updatedDeposit = await tx.transaction.update({
        where: { id: depositId },
        data: {
          status: 'FAILED',
          processedAt: new Date(),
          processedBy: adminId,
          rejectionReason: rejectionReason,
        },
      });

      // Create notification for user
      await tx.notification.create({
        data: {
          userId: deposit.userId,
          type: 'TRANSACTION',
          title: 'Crypto Deposit Rejected',
          message: `Your crypto deposit of ${deposit.amount.toFixed(8)} ${deposit.tokenSymbol || deposit.currency} has been rejected. Reason: ${rejectionReason}`,
        },
      });

      // Create activity log for user
      await tx.activityLog.create({
        data: {
          userId: deposit.userId,
          action: 'CRYPTO_DEPOSIT_REJECTED',
          description: `Crypto deposit of ${deposit.amount.toFixed(8)} ${deposit.tokenSymbol || deposit.currency} was rejected`,
          metadata: {
            depositId: depositId,
            amount: deposit.amount,
            currency: deposit.currency,
            tokenSymbol: deposit.tokenSymbol,
            rejectionReason: rejectionReason,
            processedBy: adminId,
          },
        },
      });

      // Create activity log for admin
      await tx.activityLog.create({
        data: {
          userId: adminId,
          action: 'ADMIN_CRYPTO_DEPOSIT_REJECTED',
          description: `Rejected crypto deposit of ${deposit.amount.toFixed(8)} ${deposit.tokenSymbol || deposit.currency} for user ${deposit.user.name || deposit.user.email}`,
          metadata: {
            depositId: depositId,
            userId: deposit.userId,
            amount: deposit.amount,
            currency: deposit.currency,
            tokenSymbol: deposit.tokenSymbol,
            rejectionReason: rejectionReason,
          },
        },
      });

      return updatedDeposit;
    });

    return NextResponse.json({
      message: 'Crypto deposit rejected successfully',
      deposit: result,
    });
  } catch (error) {
    console.error('Error rejecting crypto deposit:', error);
    return NextResponse.json(
      { error: 'Failed to reject crypto deposit' },
      { status: 500 }
    );
  }
}
