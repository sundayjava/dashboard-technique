import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get user's investments
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

    const investments = await prisma.investment.findMany({
      where: { userId },
      include: {
        plan: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ investments });
  } catch (error) {
    console.error('Error fetching investments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch investments' },
      { status: 500 }
    );
  }
}

// POST - Create new investment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      planId,
      amount,
      paymentMethod,
      transactionPin
    } = body;

    // Validation
    if (!userId || !planId || !amount || !paymentMethod) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Get the investment plan
    const plan = await prisma.investmentPlan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      return NextResponse.json(
        { error: 'Investment plan not found' },
        { status: 404 }
      );
    }

    if (!plan.isActive) {
      return NextResponse.json(
        { error: 'This investment plan is no longer active' },
        { status: 400 }
      );
    }

    const investmentAmount = parseFloat(amount);

    // Validate amount range
    if (investmentAmount < plan.minAmount || investmentAmount > plan.maxAmount) {
      return NextResponse.json(
        { error: `Investment amount must be between $${plan.minAmount} and $${plan.maxAmount}` },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Handle payment method
    if (paymentMethod === 'BANK_WALLET') {
      // Verify transaction PIN
      if (transactionPin !== user.transactionPin) {
        return NextResponse.json(
          { error: 'Invalid transaction PIN' },
          { status: 401 }
        );
      }

      // Get user's account
      const account = await prisma.account.findFirst({
        where: {
          userId,
          status: 'ACTIVE'
        }
      });

      if (!account) {
        return NextResponse.json(
          { error: 'No active account found' },
          { status: 404 }
        );
      }

      // Check sufficient balance
      if (account.availableBalance < investmentAmount) {
        return NextResponse.json(
          { error: 'Insufficient funds. Please top up your account or use crypto payment.' },
          { status: 400 }
        );
      }

      // Create investment and deduct from account in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Deduct from account
        await tx.account.update({
          where: { id: account.id },
          data: {
            balance: {
              decrement: investmentAmount
            },
            availableBalance: {
              decrement: investmentAmount
            }
          }
        });

        // Create transaction record
        const transactionRef = `INV-${Date.now()}`;
        await tx.transaction.create({
          data: {
            userId,
            accountId: account.id,
            type: 'INVESTMENT',
            amount: investmentAmount,
            currency: account.currency,
            status: 'COMPLETED',
            description: `Investment in ${plan.planName}`,
            reference: transactionRef
          }
        });

        // Create investment with PENDING status (admin will approve)
        const investment = await tx.investment.create({
          data: {
            userId,
            planId,
            amount: investmentAmount,
            paymentMethod: 'BANK_WALLET',
            transactionRef,
            status: 'PENDING'
          },
          include: {
            plan: true
          }
        });

        // Create notification
        await tx.notification.create({
          data: {
            userId,
            type: 'INVESTMENT',
            title: 'Investment Submitted',
            message: `Your investment of $${investmentAmount} in ${plan.planName} is pending admin approval.`,
            link: '/investment/my-investments'
          }
        });

        return investment;
      });

      return NextResponse.json(
        {
          message: 'Investment created successfully',
          investment: result
        },
        { status: 201 }
      );

    } else if (paymentMethod === 'CRYPTO') {
      // For crypto payment, create pending investment
      const investment = await prisma.investment.create({
        data: {
          userId,
          planId,
          amount: investmentAmount,
          paymentMethod: 'CRYPTO',
          status: 'PENDING'
        },
        include: {
          plan: true
        }
      });

      // Create notification
      await prisma.notification.create({
        data: {
          userId,
          type: 'INVESTMENT',
          title: 'Pending Crypto Payment',
          message: `Please send $${investmentAmount} to the crypto address provided to activate your investment in ${plan.planName}.`,
          link: '/investment/my-investments'
        }
      });

      return NextResponse.json(
        {
          message: 'Investment created. Please complete crypto payment.',
          investment,
          cryptoAddress: plan.cryptoAddress
        },
        { status: 201 }
      );
    } else {
      return NextResponse.json(
        { error: 'Invalid payment method' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error creating investment:', error);
    return NextResponse.json(
      { error: 'Failed to create investment' },
      { status: 500 }
    );
  }
}
