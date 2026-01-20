import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createActivityLog } from '@/app/api/activity-log/route';

// Admin transaction endpoint - credit or debit user account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      accountId,
      amount,
      transactionType,
      senderName,
      senderAccount,
      senderBank,
      description,
      transactionDate,
    } = body;

    // Validation
    if (!userId || !accountId || !amount || !transactionType || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than zero' },
        { status: 400 }
      );
    }

    if (!['CREDIT', 'DEBIT'].includes(transactionType)) {
      return NextResponse.json(
        { error: 'Invalid transaction type' },
        { status: 400 }
      );
    }

    // Map CREDIT/DEBIT to proper TransactionType enum
    const dbTransactionType = transactionType === 'CREDIT' ? 'DEPOSIT' : 'WITHDRAWAL';

    // Get user and account
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'Cannot modify admin account balances' },
        { status: 403 }
      );
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        balance: true,
        currency: true,
        accountNumber: true,
        accountName: true,
        userId: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (account.userId !== userId) {
      return NextResponse.json(
        { error: 'Account does not belong to this user' },
        { status: 403 }
      );
    }

    // Calculate new balance
    const currentBalance = account.balance;
    let newBalance: number;

    if (transactionType === 'CREDIT') {
      newBalance = currentBalance + amount;
    } else {
      // DEBIT
      newBalance = currentBalance - amount;
      if (newBalance < 0) {
        return NextResponse.json(
          { error: 'Insufficient balance for debit transaction' },
          { status: 400 }
        );
      }
    }

    // Create transaction and update balance in a transaction
    const transaction = await prisma.$transaction(async (tx) => {
      // Update account balance
      await tx.account.update({
        where: { id: accountId },
        data: { balance: newBalance },
      });

      // Create transaction record
      const newTransaction = await tx.transaction.create({
        data: {
          userId: userId,
          accountId: accountId,
          transactionType: dbTransactionType,
          amount: transactionType === 'CREDIT' ? amount : -amount,
          balanceAfter: newBalance,
          currency: account.currency,
          description: description,
          reference: `ADMIN-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
          status: 'COMPLETED',
          senderName: senderName || 'Admin',
          senderAccount: senderAccount || 'N/A',
          recipientName: account.accountName,
          recipientAccount: account.accountNumber,
          fee: 0,
          metadata: {
            senderBank: senderBank || 'N/A',
            processedBy: 'admin',
            transactionDate: transactionDate || new Date().toISOString(),
          },
        },
      });

      return newTransaction;
    });

    // Create activity log
    await createActivityLog(
      userId,
      'ADMIN_TRANSACTION',
      `Admin ${transactionType.toLowerCase()}ed ${account.currency} ${amount.toFixed(2)}. New balance: ${account.currency} ${newBalance.toFixed(2)}`
    );

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: userId,
        type: 'TRANSACTION',
        title: transactionType === 'CREDIT' ? 'Account Credited' : 'Account Debited',
        message: `Your account ${account.accountNumber} has been ${transactionType.toLowerCase()}ed with ${account.currency} ${amount.toFixed(2)}. ${description}`,
      },
    });

    return NextResponse.json({
      success: true,
      transaction,
      message: `Successfully ${transactionType.toLowerCase()}ed ${account.currency} ${amount.toFixed(2)}`,
    });
  } catch (error: any) {
    console.error('Error processing admin transaction:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process transaction' },
      { status: 500 }
    );
  }
}
