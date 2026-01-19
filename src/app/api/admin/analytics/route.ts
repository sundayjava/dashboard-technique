import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Admin analytics data
export async function GET(request: NextRequest) {
  try {
    // Get date ranges
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    // Get total counts
    const [totalUsers, totalInvestments, totalPlans, totalTradeKeys] = await Promise.all([
      prisma.user.count(),
      prisma.investment.count(),
      prisma.investmentPlan.count({ where: { isActive: true } }),
      prisma.tradeKey.count({ where: { isActive: true } })
    ]);

    // Get investment statistics
    const investments = await prisma.investment.findMany({
      include: {
        plan: true
      }
    });

    const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0);
    const totalReturns = investments
      .filter(inv => inv.status === 'COMPLETED' && inv.profitEarned)
      .reduce((sum, inv) => sum + inv.amount + (inv.profitEarned || 0), 0);

    // Investment status breakdown
    const statusBreakdown = {
      PENDING: investments.filter(i => i.status === 'PENDING').length,
      ACTIVE: investments.filter(i => i.status === 'ACTIVE').length,
      COMPLETED: investments.filter(i => i.status === 'COMPLETED').length,
      CANCELLED: investments.filter(i => i.status === 'CANCELLED').length,
      FAILED: investments.filter(i => i.status === 'FAILED').length
    };

    // Revenue by status
    const revenueByStatus = {
      PENDING: investments.filter(i => i.status === 'PENDING').reduce((sum, inv) => sum + inv.amount, 0),
      ACTIVE: investments.filter(i => i.status === 'ACTIVE').reduce((sum, inv) => sum + inv.amount, 0),
      COMPLETED: investments.filter(i => i.status === 'COMPLETED').reduce((sum, inv) => sum + inv.amount, 0)
    };

    // Top investment plans
    const planStats = await prisma.investmentPlan.findMany({
      include: {
        investments: true,
        _count: {
          select: {
            investments: true
          }
        }
      }
    });

    const topPlans = planStats
      .map(plan => ({
        planName: plan.planName,
        totalInvestments: plan._count.investments,
        totalAmount: plan.investments.reduce((sum, inv) => sum + inv.amount, 0),
        avgAmount: plan.investments.length > 0 
          ? plan.investments.reduce((sum, inv) => sum + inv.amount, 0) / plan.investments.length 
          : 0
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);

    // Monthly trends (last 6 months)
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthInvestments = investments.filter(inv => {
        const createdAt = new Date(inv.createdAt);
        return createdAt >= monthStart && createdAt <= monthEnd;
      });

      const monthUsers = await prisma.user.count({
        where: {
          createdAt: {
            gte: monthStart,
            lte: monthEnd
          }
        }
      });

      monthlyData.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        investments: monthInvestments.length,
        revenue: monthInvestments.reduce((sum, inv) => sum + inv.amount, 0),
        newUsers: monthUsers,
        completedInvestments: monthInvestments.filter(i => i.status === 'COMPLETED').length
      });
    }

    // Recent 30 days activity
    const recentInvestments = investments.filter(inv => 
      new Date(inv.createdAt) >= thirtyDaysAgo
    );

    const recentUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    });

    // User statistics
    const users = await prisma.user.findMany({
      include: {
        investments: true
      }
    });

    const activeInvestors = users.filter(u => 
      u.investments.some(i => i.status === 'ACTIVE')
    ).length;

    // Payment method breakdown
    const paymentMethods = {
      BANK_WALLET: investments.filter(i => i.paymentMethod === 'BANK_WALLET').length,
      CRYPTO: investments.filter(i => i.paymentMethod === 'CRYPTO').length
    };

    // ROI statistics
    const completedInvestments = investments.filter(i => i.status === 'COMPLETED' && i.profitEarned);
    const avgROI = completedInvestments.length > 0
      ? completedInvestments.reduce((sum, inv) => {
          const roi = ((inv.profitEarned || 0) / inv.amount) * 100;
          return sum + roi;
        }, 0) / completedInvestments.length
      : 0;

    return NextResponse.json({
      overview: {
        totalUsers,
        totalInvestments,
        totalInvested,
        totalReturns,
        totalPlans,
        totalTradeKeys,
        activeInvestors
      },
      recentActivity: {
        newUsersLast30Days: recentUsers,
        newInvestmentsLast30Days: recentInvestments.length,
        revenueLast30Days: recentInvestments.reduce((sum, inv) => sum + inv.amount, 0)
      },
      statusBreakdown,
      revenueByStatus,
      topPlans,
      monthlyTrends: monthlyData,
      paymentMethods,
      performance: {
        avgROI,
        completedInvestments: completedInvestments.length,
        totalProfit: completedInvestments.reduce((sum, inv) => sum + (inv.profitEarned || 0), 0)
      }
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
