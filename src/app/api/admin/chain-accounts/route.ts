import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - List all Chain Accounts (Admin only)
export async function GET(request: NextRequest) {
  try {
    const accounts = await prisma.chainAccount.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        _count: {
          select: {
            members: true,
            deposits: true,
            investments: true,
            withdrawals: true
          }
        },
        investments: {
          where: { status: 'ACTIVE' },
          select: { amount: true }
        }
      }
    });

    const accountsWithInvestmentBalance = accounts.map(({ investments, ...account }) => ({
      ...account,
      investmentBalance: investments.reduce((sum, inv) => sum + inv.amount, 0)
    }));

    return NextResponse.json({ accounts: accountsWithInvestmentBalance });
  } catch (error) {
    console.error('Error fetching chain accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chain accounts' },
      { status: 500 }
    );
  }
}
