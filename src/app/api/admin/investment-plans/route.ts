import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - List all investment plans
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const where = activeOnly ? { isActive: true } : {};

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
    console.error('Error fetching investment plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch investment plans' },
      { status: 500 }
    );
  }
}

// POST - Create new investment plan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      planName,
      minAmount,
      maxAmount,
      arkIIAllocation,
      duration,
      profitPercentage,
      compoundingCycles,
      canBeStoppedByUser,
      cryptoAddress,
      cryptoSymbol,
      cryptoIcon,
      createdBy
    } = body;

    // Validation
    if (!planName || !minAmount || !maxAmount || !arkIIAllocation || !duration || !profitPercentage) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (minAmount < 0 || maxAmount < minAmount) {
      return NextResponse.json(
        { error: 'Invalid amount range' },
        { status: 400 }
      );
    }

    if (arkIIAllocation < 0) {
      return NextResponse.json(
        { error: 'ARK_II Allocation cannot be negative' },
        { status: 400 }
      );
    }

    if (duration <= 0) {
      return NextResponse.json(
        { error: 'Duration must be greater than 0' },
        { status: 400 }
      );
    }

    if (profitPercentage < 0) {
      return NextResponse.json(
        { error: 'Profit percentage cannot be negative' },
        { status: 400 }
      );
    }

    const cycles = parseInt(compoundingCycles) || 0;
    if (cycles < 0) {
      return NextResponse.json(
        { error: 'Compounding cycles cannot be negative' },
        { status: 400 }
      );
    }

    const plan = await prisma.investmentPlan.create({
      data: {
        planName,
        minAmount: parseFloat(minAmount),
        maxAmount: parseFloat(maxAmount),
        arkIIAllocation: parseFloat(arkIIAllocation),
        duration: parseInt(duration),
        profitPercentage: parseFloat(profitPercentage),
        compoundingCycles: cycles,
        canBeStoppedByUser: canBeStoppedByUser !== undefined ? canBeStoppedByUser : true,
        cryptoAddress: cryptoAddress || null,
        cryptoSymbol: cryptoSymbol || null,
        cryptoIcon: cryptoIcon || null,
        createdBy
      }
    });

    return NextResponse.json(
      {
        message: 'Investment plan created successfully',
        plan
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating investment plan:', error);
    return NextResponse.json(
      { error: 'Failed to create investment plan' },
      { status: 500 }
    );
  }
}

// PUT - Update investment plan
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      planName,
      minAmount,
      maxAmount,
      arkIIAllocation,
      duration,
      profitPercentage,
      compoundingCycles,
      canBeStoppedByUser,
      cryptoAddress,
      cryptoSymbol,
      cryptoIcon,
      isActive
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    const plan = await prisma.investmentPlan.update({
      where: { id },
      data: {
        ...(planName && { planName }),
        ...(minAmount && { minAmount: parseFloat(minAmount) }),
        ...(maxAmount && { maxAmount: parseFloat(maxAmount) }),
        ...(arkIIAllocation && { arkIIAllocation: parseFloat(arkIIAllocation) }),
        ...(duration && { duration: parseInt(duration) }),
        ...(profitPercentage && { profitPercentage: parseFloat(profitPercentage) }),
        ...(compoundingCycles !== undefined && { compoundingCycles: parseInt(compoundingCycles) || 0 }),
        ...(canBeStoppedByUser !== undefined && { canBeStoppedByUser }),
        ...(cryptoAddress !== undefined && { cryptoAddress }),
        ...(cryptoSymbol !== undefined && { cryptoSymbol }),
        ...(cryptoIcon !== undefined && { cryptoIcon }),
        ...(isActive !== undefined && { isActive })
      }
    });

    return NextResponse.json({
      message: 'Investment plan updated successfully',
      plan
    });
  } catch (error) {
    console.error('Error updating investment plan:', error);
    return NextResponse.json(
      { error: 'Failed to update investment plan' },
      { status: 500 }
    );
  }
}

// DELETE - Delete investment plan
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    // Check if plan has active investments
    const investmentCount = await prisma.investment.count({
      where: {
        planId: id,
        status: 'ACTIVE'
      }
    });

    if (investmentCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete plan with active investments' },
        { status: 400 }
      );
    }

    await prisma.investmentPlan.delete({
      where: { id }
    });

    return NextResponse.json({
      message: 'Investment plan deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting investment plan:', error);
    return NextResponse.json(
      { error: 'Failed to delete investment plan' },
      { status: 500 }
    );
  }
}
