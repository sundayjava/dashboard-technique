import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get user's accounts
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });

    const accountIds = accounts.map(acc => acc.id);

    if (accountIds.length === 0) {
      return NextResponse.json({
        totalInflow: 0,
        totalOutflow: 0,
      });
    }

    // Calculate total inflow (money coming in)
    const inflowResult = await prisma.transaction.aggregate({
      where: {
        accountId: { in: accountIds },
        status: 'COMPLETED',
        transactionType: {
          in: ['DEPOSIT', 'TRANSFER_IN', 'REFUND', 'INTEREST', 'BONUS']
        }
      },
      _sum: {
        amount: true,
      },
    });

    // Calculate total outflow (money going out)
    const outflowResult = await prisma.transaction.aggregate({
      where: {
        accountId: { in: accountIds },
        status: 'COMPLETED',
        transactionType: {
          in: ['WITHDRAWAL', 'TRANSFER_OUT', 'PAYMENT', 'FEE']
        }
      },
      _sum: {
        amount: true,
      },
    });

    return NextResponse.json({
      totalInflow: inflowResult._sum?.amount || 0,
      totalOutflow: Math.abs(outflowResult._sum?.amount || 0),
    });
  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction statistics' },
      { status: 500 }
    );
  }
}
