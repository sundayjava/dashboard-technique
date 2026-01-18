import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch user's cheque deposits
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const deposits = await prisma.chequeDeposit.findMany({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
    });

    return NextResponse.json({ deposits });
  } catch (error) {
    console.error('Error fetching cheque deposits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cheque deposits' },
      { status: 500 }
    );
  }
}

// POST - Submit new cheque deposit
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, accountId, amount, chequeImage } = body;

    if (!userId || !accountId || !amount || !chequeImage) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Create cheque deposit
    const deposit = await prisma.chequeDeposit.create({
      data: {
        userId,
        accountId,
        amount: parseFloat(amount),
        chequeImage,
        status: 'PENDING',
      },
    });

    // Create notification for admin
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: 'SYSTEM',
          title: 'New Cheque Deposit',
          message: `A new cheque deposit of $${amount} has been submitted for approval.`,
          link: `/admin/cheque-deposits`,
        },
      });
    }

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId,
        type: 'TRANSACTION',
        title: 'Cheque Deposit Submitted',
        message: `Your cheque deposit of $${amount} has been submitted and is awaiting approval.`,
      },
    });

    return NextResponse.json({
      deposit,
      message: 'Cheque deposit submitted successfully',
    });
  } catch (error) {
    console.error('Error creating cheque deposit:', error);
    return NextResponse.json(
      { error: 'Failed to submit cheque deposit' },
      { status: 500 }
    );
  }
}
