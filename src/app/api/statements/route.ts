import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const accountId = searchParams.get('accountId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const transactionType = searchParams.get('type');
    const status = searchParams.get('status');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Build where clause
    const where: any = { userId };

    if (accountId) {
      where.accountId = accountId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    if (transactionType) {
      where.transactionType = transactionType;
    }

    if (status) {
      where.status = status;
    }

    // Fetch transactions
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        account: {
          select: {
            accountNumber: true,
            accountName: true,
            currency: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Fetch account summary if specific account
    let accountSummary = null;
    if (accountId) {
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: {
          id: true,
          accountNumber: true,
          accountName: true,
          currency: true,
          balance: true,
          availableBalance: true,
          status: true,
        },
      });
      accountSummary = account;
    }

    // Calculate summary statistics
    const summary = {
      totalTransactions: transactions.length,
      totalDeposits: transactions
        .filter((t: any) => ['DEPOSIT', 'TRANSFER_IN', 'REFUND'].includes(t.transactionType))
        .reduce((sum: number, t: any) => sum + t.amount, 0),
      totalWithdrawals: transactions
        .filter((t: any) => ['WITHDRAWAL', 'TRANSFER_OUT', 'PAYMENT'].includes(t.transactionType))
        .reduce((sum: number, t: any) => sum + t.amount, 0),
      totalFees: transactions.reduce((sum: number, t: any) => sum + t.fee, 0),
    };

    return NextResponse.json({
      transactions,
      summary,
      accountSummary,
    });
  } catch (error) {
    console.error('Error fetching statement:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statement' },
      { status: 500 }
    );
  }
}
