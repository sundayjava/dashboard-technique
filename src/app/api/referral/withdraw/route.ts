import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { userId, amount } = await req.json();

    // Validate input
    if (!userId || !amount) {
      return NextResponse.json(
        { error: 'User ID and amount are required' },
        { status: 400 }
      );
    }

    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid withdrawal amount' },
        { status: 400 }
      );
    }

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        referralBonus: true,
        investmentBalance: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has sufficient bonus balance
    if (user.referralBonus < withdrawAmount) {
      return NextResponse.json(
        { error: 'Insufficient referral bonus balance' },
        { status: 400 }
      );
    }

    // Perform the withdrawal - deduct from referralBonus and add to investmentBalance
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        referralBonus: {
          decrement: withdrawAmount,
        },
        investmentBalance: {
          increment: withdrawAmount,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        referralBonus: true,
        investmentBalance: true,
      },
    });

    // Create transaction record for audit trail
    const balanceBefore = user.investmentBalance;
    const balanceAfter = user.investmentBalance + withdrawAmount;
    const reference = `REF-BONUS-${Date.now()}-${userId.slice(0, 8)}`;

    await prisma.investmentTransaction.create({
      data: {
        userId: userId,
        transactionType: 'BONUS',
        amount: withdrawAmount,
        balanceBefore: balanceBefore,
        balanceAfter: balanceAfter,
        description: `Referral bonus withdrawal - $${withdrawAmount.toFixed(2)}`,
        reference: reference,
        status: 'COMPLETED',
      },
    });

    return NextResponse.json(
      {
        message: 'Withdrawal successful',
        user: updatedUser,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return NextResponse.json(
      { error: 'Failed to process withdrawal' },
      { status: 500 }
    );
  }
}
