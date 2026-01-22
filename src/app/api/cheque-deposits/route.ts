import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyAdminsOfUserActivity } from '@/lib/email';

// GET - Fetch user's cheque deposits
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const deposits = await prisma.transaction.findMany({
      where: {
        userId,
        transactionType: 'DEPOSIT',
        channel: 'CHEQUE',
      },
      include: {
        account: {
          select: {
            id: true,
            accountNumber: true,
            currency: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
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
    const { userId, accountId, amount, chequeImage, chequeNumber } = body;

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

    // Verify account belongs to user
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        userId,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Invalid account' },
        { status: 400 }
      );
    }

    // Generate unique reference
    const txReference = `CHQ-DEP-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Prepare metadata
    const metadata: any = {};
    if (chequeNumber) {
      metadata.chequeNumber = chequeNumber;
    }

    // Create cheque deposit transaction
    const deposit = await prisma.transaction.create({
      data: {
        userId,
        accountId,
        transactionType: 'DEPOSIT',
        channel: 'CHEQUE',
        paymentMethod: 'CHEQUE',
        amount: parseFloat(amount),
        balanceAfter: account.balance, // Will be updated when approved
        currency: account.currency,
        description: 'Cheque deposit',
        reference: txReference,
        status: 'PENDING',
        chequeImage,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
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
          message: `A new cheque deposit of ${account.currency} ${amount} has been submitted for approval.`,
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
        message: `Your cheque deposit of ${account.currency} ${amount} has been submitted and is awaiting approval.`,
      },
    });

    // Get user details for admin email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Notify admins via email
    notifyAdminsOfUserActivity(
      userId,
      user?.name || 'Unknown User',
      `a Cheque Deposit of ${account.currency} ${amount}`
    );

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
