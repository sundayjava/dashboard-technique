import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - List crypto deposits
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');

    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const deposits = await prisma.cryptoDeposit.findMany({
      where,
      include: {
        token: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ deposits });
  } catch (error) {
    console.error('Error fetching crypto deposits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch crypto deposits' },
      { status: 500 }
    );
  }
}

// POST - Create new crypto deposit
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, tokenId, amount, transactionId } = body;

    if (!userId || !tokenId || !amount || !transactionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    const deposit = await prisma.cryptoDeposit.create({
      data: {
        userId,
        tokenId,
        amount: parseFloat(amount),
        transactionId,
      },
      include: {
        token: true,
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        title: 'Crypto Deposit Submitted',
        message: `Your ${deposit.token.name} deposit of ${amount} ${deposit.token.symbol} has been submitted for verification.`,
        type: 'SYSTEM',
      },
    });

    return NextResponse.json({ deposit }, { status: 201 });
  } catch (error) {
    console.error('Error creating crypto deposit:', error);
    return NextResponse.json(
      { error: 'Failed to create crypto deposit' },
      { status: 500 }
    );
  }
}
