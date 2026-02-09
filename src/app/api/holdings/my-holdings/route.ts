import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyAdminsOfUserActivity } from '@/lib/email';
import { convertCurrency } from '@/lib/currency-converter';

// GET - Get user's holdings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const holdings = await prisma.userHolding.findMany({
      where: { userId },
      include: {
        token: true,
        user: {
          select: {
            accounts: {
              select: {
                currency: true,
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate total value
    const totalValue = holdings
      .filter(h => h.status === 'ACTIVE')
      .reduce((sum, h) => sum + h.currentValue + h.interestEarned, 0);

    return NextResponse.json({ holdings, totalValue });
  } catch (error) {
    console.error('Error fetching user holdings:', error);
    return NextResponse.json({ error: 'Failed to fetch holdings' }, { status: 500 });
  }
}

// POST - Create new holding
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, tokenId, amount } = body;

    if (!userId || !tokenId || !amount) {
      return NextResponse.json(
        { error: 'User ID, token ID, and amount are required' },
        { status: 400 }
      );
    }

    const depositAmount = parseFloat(amount);
    if (depositAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    // Get user's account
    const account = await prisma.account.findFirst({
      where: { userId },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Check if user has sufficient balance
    if (account.balance < depositAmount) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Get token details
    const token = await prisma.holdingToken.findUnique({
      where: { id: tokenId },
    });

    if (!token || !token.isActive) {
      return NextResponse.json({ error: 'Token not found or inactive' }, { status: 404 });
    }

    // Convert deposited amount to USD if account currency is not USD
    const depositAmountUSD = account.currency === 'USD' 
      ? depositAmount 
      : await convertCurrency(depositAmount, account.currency, 'USD');

    // Calculate token amount based on current price (which is in USD)
    const tokenAmount = token.currentPrice > 0 ? depositAmountUSD / token.currentPrice : depositAmountUSD;

    console.log(`[Holdings Create] User deposited: ${depositAmount} ${account.currency}`);
    console.log(`[Holdings Create] Converted to USD: ${depositAmountUSD} USD`);
    console.log(`[Holdings Create] Token price: ${token.currentPrice} USD`);
    console.log(`[Holdings Create] Token amount: ${tokenAmount} ${token.symbol}`);

    // Create holding and deduct from account in a transaction
    const holding = await prisma.$transaction(async (tx) => {
      // Deduct from account and capture updated account
      const updatedAccount = await tx.account.update({
        where: { id: account.id },
        data: {
          balance: {
            decrement: depositAmount,
          },
        },
      });

      // Create transaction record (debit)
      const reference = `HLD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          transactionType: 'PAYMENT',
          amount: -depositAmount,
          balanceAfter: updatedAccount.balance,
          currency: account.currency,
          status: 'COMPLETED',
          description: `Holding deposit: ${tokenAmount.toFixed(8)} ${token.symbol}`,
          reference,
        },
      });

      // Create holding
      return await tx.userHolding.create({
        data: {
          userId,
          tokenId,
          depositedAmount: depositAmount, // Store in user's currency for display
          tokenAmount,
          currentValue: depositAmountUSD, // Store in USD for calculations
          interestEarned: 0,
          status: 'PENDING',
        },
        include: {
          token: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });
    });

    // Send email notification to admins
    try {
      await notifyAdminsOfUserActivity(
        userId,
        holding.user?.name || 'Unknown User',
        `a Crypto Holding Request for ${depositAmount.toFixed(2)} ${account.currency} in ${token.name} (${token.symbol})`
      );
    } catch (emailError) {
      console.error('Failed to send admin notification email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      message: 'Holding created successfully',
      holding,
    });
  } catch (error) {
    console.error('Error creating holding:', error);
    return NextResponse.json({ error: 'Failed to create holding' }, { status: 500 });
  }
}

// PATCH - Withdraw holding
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, holdingId } = body;

    if (!userId || !holdingId) {
      return NextResponse.json(
        { error: 'User ID and holding ID are required' },
        { status: 400 }
      );
    }

    // Get holding
    const holding = await prisma.userHolding.findUnique({
      where: { id: holdingId },
      include: { token: true },
    });

    if (!holding) {
      return NextResponse.json({ error: 'Holding not found' }, { status: 404 });
    }

    if (holding.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (holding.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Holding is not active' }, { status: 400 });
    }

    // Recalculate interest with current value before withdrawal
    const daysSinceCreation = Math.floor(
      (Date.now() - holding.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const dailyRate = holding.token.interestRate / 365 / 100;
    const finalInterest = holding.currentValue * dailyRate * daysSinceCreation;

    console.log(`[Holdings Withdraw] Token amount: ${holding.tokenAmount} ${holding.token.symbol}`);
    console.log(`[Holdings Withdraw] Current value: ${holding.currentValue} USD`);
    console.log(`[Holdings Withdraw] Days held: ${daysSinceCreation}`);
    console.log(`[Holdings Withdraw] Interest earned: ${finalInterest} USD`);

    // Get user's account
    const account = await prisma.account.findFirst({
      where: { userId },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Calculate total amount to return in USD (current value + recalculated interest)
    const totalAmountUSD = holding.currentValue + finalInterest;

    // Convert USD amount back to user's account currency
    const totalAmount = account.currency === 'USD'
      ? totalAmountUSD
      : await convertCurrency(totalAmountUSD, 'USD', account.currency);

    console.log(`[Holdings Withdraw] Total USD: ${totalAmountUSD} USD`);
    console.log(`[Holdings Withdraw] Converted to ${account.currency}: ${totalAmount}`);

    // Update holding and add to account in a transaction
    await prisma.$transaction(async (tx) => {
      // Add to account and capture updated account
      const updatedAccount = await tx.account.update({
        where: { id: account.id },
        data: {
          balance: {
            increment: totalAmount,
          },
        },
      });

      // Create transaction record (credit)
      const reference = `HLD-WD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          transactionType: 'DEPOSIT',
          amount: totalAmount,
          balanceAfter: updatedAccount.balance,
          currency: account.currency,
          status: 'COMPLETED',
          description: `Holding withdrawal: ${holding.tokenAmount.toFixed(8)} ${holding.token.symbol} + ${totalAmountUSD.toFixed(2)} USD (${totalAmount.toFixed(2)} ${account.currency})`,
          reference,
        },
      });

      // Update holding status
      await tx.userHolding.update({
        where: { id: holdingId },
        data: {
          status: 'WITHDRAWN',
        },
      });
    });

    return NextResponse.json({
      message: 'Holding withdrawn successfully',
      amount: totalAmount,
    });
  } catch (error) {
    console.error('Error withdrawing holding:', error);
    return NextResponse.json({ error: 'Failed to withdraw holding' }, { status: 500 });
  }
}
