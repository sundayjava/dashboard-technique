import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { convertCurrency } from '@/lib/currency-converter';

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
      select: { 
        investmentBalance: true,
        accounts: {
          select: {
            id: true,
            accountNumber: true,
            currency: true,
            balance: true,
            availableBalance: true
          },
          take: 1
        }
      }
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

    const account = user.accounts?.[0];

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Convert amount from USD to account currency
    const accountCurrency = account.currency || 'USD';
    let convertedAmount = amount;
    let exchangeRate = 1;

    if (accountCurrency !== 'USD') {
      try {
        convertedAmount = await convertCurrency(amount, 'USD', accountCurrency);
        exchangeRate = convertedAmount / amount;
      } catch (error) {
        return NextResponse.json(
          { error: `Currency conversion not supported for ${accountCurrency}` },
          { status: 400 }
        );
      }

      if (convertedAmount <= 0) {
        return NextResponse.json(
          { error: 'Invalid conversion amount' },
          { status: 400 }
        );
      }
    }

    // Perform the transfer
    await prisma.$transaction(async (tx) => {
      const balanceBefore = user.investmentBalance;
      const balanceAfter = balanceBefore - amount;

      // Deduct from investment balance (in USD)
      await tx.user.update({
        where: { id: userId },
        data: {
          investmentBalance: { decrement: amount }
        }
      });

      // Add to main account (in account currency)
      await tx.account.update({
        where: { id: account.id },
        data: {
          balance: { increment: convertedAmount },
          availableBalance: { increment: convertedAmount }
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
          description: `Withdrawal to Bank Wallet${accountCurrency !== 'USD' ? ` (USD ${amount.toFixed(2)} → ${accountCurrency} ${convertedAmount.toFixed(2)})` : ''}`,
          reference: `INV-WD-${Date.now()}`,
          status: 'COMPLETED',
          relatedAccountId: account.id,
          metadata: {
            destinationAccount: account.accountNumber,
            destinationCurrency: accountCurrency,
            destinationAmount: convertedAmount,
            exchangeRate: exchangeRate,
            sourceAmount: amount,
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
          amount: convertedAmount,
          balanceAfter: account.balance + convertedAmount,
          currency: account.currency,
          description: `Transfer from Investment Wallet (USD ${amount.toFixed(2)})`,
          reference: `INV-WD-${Date.now()}`,
          status: 'COMPLETED'
        }
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          userId,
          action: 'INVESTMENT_WITHDRAWAL',
          description: `Withdrew $${amount.toFixed(2)} from investment wallet${accountCurrency !== 'USD' ? ` (${accountCurrency} ${convertedAmount.toFixed(2)})` : ''}`,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown'
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Withdrawal successful',
      conversion: accountCurrency !== 'USD' ? {
        sourceAmount: amount,
        sourceCurrency: 'USD',
        convertedAmount: convertedAmount,
        destinationCurrency: accountCurrency,
        exchangeRate: exchangeRate
      } : undefined
    });

  } catch (error) {
    console.error('Error processing investment withdrawal:', error);
    return NextResponse.json(
      { error: 'Failed to process withdrawal' },
      { status: 500 }
    );
  }
}
