import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get user investment statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get user investment balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { investmentBalance: true }
    });

    // Get all user investments
    const investments = await prisma.investment.findMany({
      where: { userId },
      include: {
        plan: true
      }
    });

    // Calculate statistics
    const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0);
    const activeInvestments = investments.filter(i => i.status === 'ACTIVE');
    const completedInvestments = investments.filter(i => i.status === 'COMPLETED');

    const totalReturns = completedInvestments.reduce((sum, inv) => {
      const profit = inv.profitEarned || 0;
      return sum + inv.amount + profit;
    }, 0);

    // Calculate portfolio value (active investments + expected returns)
    const portfolioValue = activeInvestments.reduce((sum, inv) => {
      const expectedProfit = inv.amount * (inv.plan.profitPercentage / 100);
      return sum + inv.amount + expectedProfit;
    }, 0);

    return NextResponse.json({
      investmentBalance: user?.investmentBalance || 0,
      totalInvested,
      activeInvestments: activeInvestments.length,
      totalReturns,
      portfolioValue
    });

  } catch (error) {
    console.error('Error fetching investment stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch investment statistics' },
      { status: 500 }
    );
  }
}
