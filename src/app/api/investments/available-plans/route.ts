import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - List investment plans available to a specific user (excludes restricted plans)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get all restricted plan IDs for this user
    const restrictions = await prisma.investmentPlanRestriction.findMany({
      where: { userId },
      select: { planId: true }
    });

    const restrictedPlanIds = restrictions.map(r => r.planId);

    // Build where clause
    const where: any = {
      id: {
        notIn: restrictedPlanIds
      }
    };

    if (activeOnly) {
      where.isActive = true;
    }

    // Fetch plans excluding restricted ones
    const plans = await prisma.investmentPlan.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        _count: {
          select: { investments: true }
        }
      }
    });

    return NextResponse.json({ plans });
  } catch (error) {
    console.error('Error fetching available plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch investment plans' },
      { status: 500 }
    );
  }
}
