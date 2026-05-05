import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get restrictions for a plan or all restrictions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');
    const userId = searchParams.get('userId');

    const where: any = {};
    if (planId) where.planId = planId;
    if (userId) where.userId = userId;

    const restrictions = await prisma.investmentPlanRestriction.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            authorizationCode: true,
          },
        },
        plan: {
          select: {
            id: true,
            planName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ restrictions });
  } catch (error) {
    console.error('Error fetching restrictions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch restrictions' },
      { status: 500 }
    );
  }
}

// POST - Add restriction(s) for a user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, userIds, createdBy } = body;

    if (!planId || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'Plan ID and user IDs are required' },
        { status: 400 }
      );
    }

    // Verify plan exists
    const plan = await prisma.investmentPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json(
        { error: 'Investment plan not found' },
        { status: 404 }
      );
    }

    // Create restrictions for multiple users
    const restrictions = await prisma.$transaction(
      userIds.map((userId: string) =>
        prisma.investmentPlanRestriction.upsert({
          where: {
            userId_planId: {
              userId,
              planId,
            },
          },
          update: {},
          create: {
            userId,
            planId,
            createdBy,
          },
        })
      )
    );

    return NextResponse.json({
      message: `Successfully restricted ${userIds.length} user(s) from accessing this plan`,
      restrictions,
    });
  } catch (error) {
    console.error('Error creating restriction:', error);
    return NextResponse.json(
      { error: 'Failed to create restriction' },
      { status: 500 }
    );
  }
}

// DELETE - Remove restriction
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const restrictionId = searchParams.get('id');
    const planId = searchParams.get('planId');
    const userId = searchParams.get('userId');

    if (restrictionId) {
      // Delete by restriction ID
      await prisma.investmentPlanRestriction.delete({
        where: { id: restrictionId },
      });
    } else if (planId && userId) {
      // Delete by planId and userId
      await prisma.investmentPlanRestriction.delete({
        where: {
          userId_planId: {
            userId,
            planId,
          },
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Restriction ID or both planId and userId are required' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Restriction removed successfully',
    });
  } catch (error) {
    console.error('Error deleting restriction:', error);
    return NextResponse.json(
      { error: 'Failed to delete restriction' },
      { status: 500 }
    );
  }
}
