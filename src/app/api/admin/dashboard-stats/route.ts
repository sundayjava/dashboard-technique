import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get total users
    const totalUsers = await prisma.user.count();

    // Get total balance across all accounts
    const accountsBalance = await prisma.account.aggregate({
      _sum: {
        balance: true,
      },
    });

    // Get total transactions count
    const totalTransactions = await prisma.transaction.count();

    // Get pending approvals (bank deposits + cheque deposits)
    const pendingBankDeposits = await prisma.bankDeposit.count({
      where: { status: 'PENDING' },
    });

    const pendingChequeDeposits = await prisma.chequeDeposit.count({
      where: { status: 'PENDING' },
    });

    const pendingApprovals = pendingBankDeposits + pendingChequeDeposits;

    // Get recent users (last 5)
    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Get recent transactions (last 5)
    const recentTransactions = await prisma.transaction.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        transactionType: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      totalUsers,
      totalBalance: accountsBalance._sum.balance || 0,
      totalTransactions,
      pendingApprovals,
      recentUsers,
      recentTransactions,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}
