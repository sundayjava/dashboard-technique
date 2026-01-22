import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Withdraw from investment wallet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, amount } = body;

    if (!userId || !amount) {
      return NextResponse.json(
        { error: 'User ID and amount are required' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Get user and their main account
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { investmentBalance: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has sufficient investment balance
    if (user.investmentBalance < amount) {
      return NextResponse.json(
        { error: 'Insufficient balance in investment wallet' },
        { status: 400 }
      );
    }

    const account = await prisma.account.findFirst({
      where: { userId }
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Perform the transfer
    await prisma.$transaction(async (tx) => {
      const balanceBefore = user.investmentBalance;
      const balanceAfter = balanceBefore - amount;

      // Deduct from investment balance
      await tx.user.update({
        where: { id: userId },
        data: {
          investmentBalance: { decrement: amount }
        }
      });

      // Add to main account
      await tx.account.update({
        where: { id: account.id },
        data: {
          balance: { increment: amount },
          availableBalance: { increment: amount }
        }
      });

      // Create investment transaction record
      await tx.investmentTransaction.create({
        data: {
          userId,
          transactionType: 'WITHDRAWAL',
          amount: -amount,
          balanceBefore,
          balanceAfter,
          description: 'Withdrawal from Investment Wallet',
          reference: `INV-WD-${Date.now()}`,
          status: 'COMPLETED',
          relatedAccountId: account.id,
          metadata: {
            destinationAccount: account.accountNumber,
            timestamp: new Date().toISOString()
          }
        }
      });

      // Create transaction record for main account
      await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          transactionType: 'INVESTMENT_WITHDRAWAL',
          amount: amount,
          balanceAfter: account.balance + amount,
          currency: account.currency,
          description: 'Transfer from Investment Wallet',
          reference: `INV-WD-${Date.now()}`,
          status: 'COMPLETED'
        }
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          userId,
          action: 'INVESTMENT_WITHDRAWAL',
          description: `Withdrew $${amount.toFixed(2)} from investment wallet`,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown'
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Withdrawal successful'
    });

  } catch (error) {
    console.error('Error processing investment withdrawal:', error);
    return NextResponse.json(
      { error: 'Failed to process withdrawal' },
      { status: 500 }
    );
  }
}
