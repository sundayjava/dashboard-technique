import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Public endpoint - no auth required to browse plans
export async function GET(request: NextRequest) {
  try {
    const investmentPlans = await prisma.investmentPlan.findMany({
      where: {
        isActive: true,
        chainAccountsEnabled: true,
      },
      orderBy: {
        profitPercentage: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      plans: investmentPlans.map(plan => ({
        id: plan.id,
        planName: plan.planName,
        minAmount: plan.minAmount,
        maxAmount: plan.maxAmount,
        profitPercentage: plan.profitPercentage,
        duration: plan.duration,
        chainAccountsEnabled: plan.chainAccountsEnabled,
      })),
    });

  } catch (error: any) {
    console.error('Error fetching investment plans:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
