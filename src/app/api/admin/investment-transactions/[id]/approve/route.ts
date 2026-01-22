import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Approve investment transaction
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params;

    // Get the transaction
    const transaction = await prisma.investmentTransaction.findUnique({
      where: { id: transactionId }
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    if (transaction.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Transaction is not pending' },
        { status: 400 }
      );
    }

    // Update user's investment balance
    await prisma.$transaction(async (tx) => {
      // Update transaction status
      await tx.investmentTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'COMPLETED',
          updatedAt: new Date()
        }
      });

      // Add to user's investment balance
      await tx.user.update({
        where: { id: transaction.userId },
        data: {
          investmentBalance: { increment: transaction.amount }
        }
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          userId: transaction.userId,
          action: 'INVESTMENT_DEPOSIT_APPROVED',
          description: `Crypto deposit of $${transaction.amount.toFixed(2)} approved by admin`,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown'
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Transaction approved successfully'
    });

  } catch (error) {
    console.error('Error approving transaction:', error);
    return NextResponse.json(
      { error: 'Failed to approve transaction' },
      { status: 500 }
    );
  }
}
