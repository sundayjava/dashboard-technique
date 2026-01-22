import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyAdminsOfUserActivity } from '@/lib/email';

// GET - Fetch user's bank deposit history
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

    const deposits = await prisma.transaction.findMany({
      where: {
        userId,
        transactionType: 'DEPOSIT',
        channel: 'BANK',
      },
      include: {
        account: {
          select: {
            id: true,
            accountNumber: true,
            currency: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ deposits });
  } catch (error) {
    console.error('Error fetching bank deposits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deposits' },
      { status: 500 }
    );
  }
}

// POST - Submit new bank deposit
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, accountId, amount, referenceNumber, proofImage, bankName, bankCode, accountNumber } = body;

    if (!userId || !accountId || !amount || !referenceNumber) {
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
    const txReference = `BANK-DEP-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Create the deposit transaction
    const deposit = await prisma.transaction.create({
      data: {
        userId,
        accountId,
        transactionType: 'DEPOSIT',
        channel: 'BANK',
        paymentMethod: 'BANK',
        amount: parseFloat(amount),
        balanceAfter: account.balance, // Will be updated when approved
        currency: account.currency,
        description: `Bank deposit via ${bankName || 'Bank Transfer'}`,
        reference: txReference,
        status: 'PENDING',
        proofImage: proofImage || null,
        bankName: bankName || null,
        bankCode: bankCode || null,
        accountNumber: accountNumber || null,
        metadata: {
          referenceNumber: referenceNumber.trim(),
        },
      },
    });

    // Notify all admins
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: 'SYSTEM',
          title: 'New Bank Deposit',
          message: `A new bank deposit of ${account.currency} ${amount} has been submitted via ${bankName || 'Bank Transfer'}`,
          link: `/admin/bank-deposits`,
        },
      });
    }

    // Notify user
    await prisma.notification.create({
      data: {
        userId,
        type: 'TRANSACTION',
        title: 'Bank Deposit Submitted',
        message: `Your bank deposit of ${account.currency} ${amount} via ${bankName || 'Bank Transfer'} is awaiting admin verification`,
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
      `a Bank Deposit of ${account.currency} ${amount}`
    );

    return NextResponse.json({
      deposit,
      message: 'Bank deposit submitted successfully',
    });
  } catch (error) {
    console.error('Error submitting bank deposit:', error);
    return NextResponse.json(
      { error: 'Failed to submit deposit' },
      { status: 500 }
    );
  }
}
