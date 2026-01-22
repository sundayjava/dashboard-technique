import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Reject investment transaction
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

    // Update transaction status
    await prisma.$transaction(async (tx) => {
      await tx.investmentTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'FAILED',
          updatedAt: new Date()
        }
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          userId: transaction.userId,
          action: 'INVESTMENT_DEPOSIT_REJECTED',
          description: `Crypto deposit of $${transaction.amount.toFixed(2)} rejected by admin`,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown'
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Transaction rejected successfully'
    });

  } catch (error) {
    console.error('Error rejecting transaction:', error);
    return NextResponse.json(
      { error: 'Failed to reject transaction' },
      { status: 500 }
    );
  }
}
