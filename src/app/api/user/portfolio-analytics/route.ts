import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - User portfolio analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    console.log('Portfolio analytics requested for userId:', userId);

    if (!userId) {
      console.error('No userId provided');
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get all user investments
    const investments = await prisma.investment.findMany({
      where: { userId },
      include: {
        plan: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${investments.length} investments for user ${userId}`);

    // Portfolio overview
    const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0);
    const activeInvestments = investments.filter(i => i.status === 'ACTIVE');
    const completedInvestments = investments.filter(i => i.status === 'COMPLETED');
    
    const totalReturns = completedInvestments.reduce((sum, inv) => 
      sum + inv.amount + (inv.profitEarned || 0), 0
    );
    
    const totalProfit = completedInvestments.reduce((sum, inv) => 
      sum + (inv.profitEarned || 0), 0
    );

    const pendingInvestments = investments.filter(i => i.status === 'PENDING');
    const activeValue = activeInvestments.reduce((sum, inv) => sum + inv.amount, 0);

    // Expected returns from active investments
    const expectedReturns = activeInvestments.reduce((sum, inv) => {
      const expectedProfit = inv.amount * (inv.plan.profitPercentage / 100);
      return sum + inv.amount + expectedProfit;
    }, 0);

    // Calculate ROI
    const roi = totalInvested > 0 ? ((totalProfit / totalInvested) * 100) : 0;

    // Investment by status
    const statusDistribution = {
      PENDING: pendingInvestments.length,
      ACTIVE: activeInvestments.length,
      COMPLETED: completedInvestments.length,
      CANCELLED: investments.filter(i => i.status === 'CANCELLED').length,
      FAILED: investments.filter(i => i.status === 'FAILED').length
    };

    // Investment by plan
    const planDistribution = investments.reduce((acc, inv) => {
      const planName = inv.plan.planName;
      if (!acc[planName]) {
        acc[planName] = {
          count: 0,
          amount: 0,
          profit: 0
        };
      }
      acc[planName].count += 1;
      acc[planName].amount += inv.amount;
      if (inv.status === 'COMPLETED' && inv.profitEarned) {
        acc[planName].profit += inv.profitEarned;
      }
      return acc;
    }, {} as Record<string, { count: number; amount: number; profit: number }>);

    // Monthly performance (last 6 months)
    const now = new Date();
    const monthlyPerformance = [];
    
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthInvestments = investments.filter(inv => {
        const createdAt = new Date(inv.createdAt);
        return createdAt >= monthStart && createdAt <= monthEnd;
      });

      const monthCompleted = investments.filter(inv => {
        if (!inv.completedAt) return false;
        const completedAt = new Date(inv.completedAt);
        return completedAt >= monthStart && completedAt <= monthEnd && inv.status === 'COMPLETED';
      });

      monthlyPerformance.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        invested: monthInvestments.reduce((sum, inv) => sum + inv.amount, 0),
        returns: monthCompleted.reduce((sum, inv) => sum + inv.amount + (inv.profitEarned || 0), 0),
        profit: monthCompleted.reduce((sum, inv) => sum + (inv.profitEarned || 0), 0),
        count: monthInvestments.length
      });
    }

    // Active investments with progress
    const activeInvestmentDetails = activeInvestments.map(inv => {
      const startDate = inv.startDate ? new Date(inv.startDate) : new Date();
      const endDate = inv.endDate ? new Date(inv.endDate) : new Date();
      const totalDuration = endDate.getTime() - startDate.getTime();
      const elapsed = now.getTime() - startDate.getTime();
      const progress = totalDuration > 0 ? Math.min((elapsed / totalDuration) * 100, 100) : 0;
      
      const expectedProfit = inv.amount * (inv.plan.profitPercentage / 100);
      const expectedReturn = inv.amount + expectedProfit;
      const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      return {
        id: inv.id,
        planName: inv.plan.planName,
        amount: inv.amount,
        progress: Math.round(progress),
        daysRemaining,
        expectedProfit,
        expectedReturn,
        startDate: inv.startDate,
        endDate: inv.endDate
      };
    });

    // Performance metrics
    const avgInvestmentSize = investments.length > 0 
      ? totalInvested / investments.length 
      : 0;

    const successRate = investments.length > 0
      ? (completedInvestments.length / investments.length) * 100
      : 0;

    return NextResponse.json({
      overview: {
        totalInvested,
        activeValue,
        totalReturns,
        totalProfit,
        expectedReturns,
        roi,
        avgInvestmentSize,
        successRate
      },
      counts: {
        total: investments.length,
        active: activeInvestments.length,
        completed: completedInvestments.length,
        pending: pendingInvestments.length
      },
      statusDistribution,
      planDistribution,
      monthlyPerformance,
      activeInvestments: activeInvestmentDetails,
      recentInvestments: investments.slice(0, 5).map(inv => ({
        id: inv.id,
        planName: inv.plan.planName,
        amount: inv.amount,
        status: inv.status,
        createdAt: inv.createdAt,
        profitEarned: inv.profitEarned
      }))
    });

  } catch (error) {
    console.error('Error fetching portfolio analytics:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch portfolio analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
