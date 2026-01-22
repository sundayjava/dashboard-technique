import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Deposit to investment wallet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, amount, method, transactionId } = body;

    if (!userId || !amount || !method) {
      return NextResponse.json(
        { error: 'User ID, amount, and method are required' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    if (method === 'bank') {
      // Handle bank wallet deposit (immediate)
      const account = await prisma.account.findFirst({
        where: { userId }
      });

      if (!account) {
        return NextResponse.json(
          { error: 'Account not found' },
          { status: 404 }
        );
      }

      // Check if user has sufficient balance
      if (account.balance < amount) {
        return NextResponse.json(
          { error: 'Insufficient balance in main wallet' },
          { status: 400 }
        );
      }

      // Perform the transfer
      await prisma.$transaction(async (tx) => {
        // Get current investment balance
        const currentUser = await tx.user.findUnique({
          where: { id: userId },
          select: { investmentBalance: true }
        });

        const balanceBefore = currentUser?.investmentBalance || 0;
        const balanceAfter = balanceBefore + amount;

        // Deduct from main account
        await tx.account.update({
          where: { id: account.id },
          data: {
            balance: { decrement: amount },
            availableBalance: { decrement: amount }
          }
        });

        // Add to investment balance
        await tx.user.update({
          where: { id: userId },
          data: {
            investmentBalance: { increment: amount }
          }
        });

        // Create investment transaction record
        await tx.investmentTransaction.create({
          data: {
            userId,
            transactionType: 'DEPOSIT',
            amount,
            balanceBefore,
            balanceAfter,
            description: 'Deposit from Bank Wallet',
            reference: `INV-DEP-${Date.now()}`,
            status: 'COMPLETED',
            relatedAccountId: account.id,
            metadata: {
              method: 'bank',
              sourceAccount: account.accountNumber,
              timestamp: new Date().toISOString()
            }
          }
        });

        // Create transaction record for main account
        await tx.transaction.create({
          data: {
            userId,
            accountId: account.id,
            transactionType: 'INVESTMENT_DEPOSIT',
            amount: -amount,
            balanceAfter: account.balance - amount,
            currency: account.currency,
            description: 'Transfer to Investment Wallet',
            reference: `INV-DEP-${Date.now()}`,
            status: 'COMPLETED'
          }
        });

        // Log activity
        await tx.activityLog.create({
          data: {
            userId,
            action: 'INVESTMENT_DEPOSIT',
            description: `Deposited $${amount.toFixed(2)} to investment wallet from bank`,
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown'
          }
        });
      });

      return NextResponse.json({
        success: true,
        message: 'Deposit successful'
      });

    } else if (method === 'crypto') {
      // Handle crypto deposit (pending admin approval)
      if (!transactionId) {
        return NextResponse.json(
          { error: 'Transaction ID is required for crypto deposits' },
          { status: 400 }
        );
      }

      // Get current investment balance for balanceBefore
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { investmentBalance: true }
      });

      const balanceBefore = user?.investmentBalance || 0;
      const balanceAfter = balanceBefore + amount;

      // Create pending investment transaction
      await prisma.investmentTransaction.create({
        data: {
          userId,
          transactionType: 'DEPOSIT',
          amount,
          balanceBefore,
          balanceAfter,
          description: 'Crypto Deposit - Pending Confirmation',
          reference: `INV-CRYPTO-${Date.now()}`,
          status: 'PENDING',
          metadata: {
            method: 'crypto',
            transactionId,
            timestamp: new Date().toISOString()
          }
        }
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId,
          action: 'INVESTMENT_DEPOSIT_PENDING',
          description: `Crypto deposit request for $${amount.toFixed(2)} - Pending admin confirmation`,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown'
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Deposit request submitted. Awaiting admin confirmation.'
      });
    }

    return NextResponse.json(
      { error: 'Invalid deposit method' },
      { status: 400 }
    );

    return NextResponse.json({
      success: true,
      message: 'Deposit successful'
    });

  } catch (error) {
    console.error('Error processing investment deposit:', error);
    return NextResponse.json(
      { error: 'Failed to process deposit' },
      { status: 500 }
    );
  }
}
