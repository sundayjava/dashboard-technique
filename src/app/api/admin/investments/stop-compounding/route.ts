import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Stop compounding for an investment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { investmentId, stoppedBy } = body;

    if (!investmentId) {
      return NextResponse.json(
        { error: 'Investment ID is required' },
        { status: 400 }
      );
    }

    // Get investment with plan details
    const investment = await prisma.investment.findUnique({
      where: { id: investmentId },
      include: {
        plan: true,
        user: true
      }
    });

    if (!investment) {
      return NextResponse.json(
        { error: 'Investment not found' },
        { status: 404 }
      );
    }

    // Check if it's a compounding investment
    if (investment.plan.compoundingCycles === 0) {
      return NextResponse.json(
        { error: 'This is not a compounding investment' },
        { status: 400 }
      );
    }

    // Check if already stopped
    if (investment.isStopped) {
      return NextResponse.json(
        { error: 'Compounding has already been stopped for this investment' },
        { status: 400 }
      );
    }

    // Check if investment is active
    if (investment.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Only active investments can have compounding stopped' },
        { status: 400 }
      );
    }

    // Update investment to stop compounding
    const updatedInvestment = await prisma.investment.update({
      where: { id: investmentId },
      data: {
        isStopped: true,
        stoppedBy: stoppedBy || 'ADMIN',
        stoppedAt: new Date()
      },
      include: {
        plan: true,
        user: true
      }
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: investment.userId,
        type: 'INVESTMENT',
        title: 'Compounding Stopped',
        message: `Compounding has been stopped for your investment in ${investment.plan.planName}. The current cycle will complete normally, but no further cycles will be created.`,
        link: '/investment/my-investments'
      }
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        userId: investment.userId,
        action: 'Investment Compounding Stopped',
        description: `Compounding stopped for investment in ${investment.plan.planName} by ${stoppedBy || 'ADMIN'}`,
        ipAddress: '0.0.0.0'
      }
    });

    return NextResponse.json({
      message: 'Compounding stopped successfully. The investment will complete at the end of the current cycle.',
      investment: updatedInvestment
    });

  } catch (error) {
    console.error('Error stopping compounding:', error);
    return NextResponse.json(
      { error: 'Failed to stop compounding' },
      { status: 500 }
    );
  }
}
