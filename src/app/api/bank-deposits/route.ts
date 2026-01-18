import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    const deposits = await prisma.bankDeposit.findMany({
      where: { userId },
      include: {
        userBankAccount: {
          include: {
            bank: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
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
    const { userId, userBankAccountId, accountId, amount, referenceNumber, proofImage } = body;

    if (!userId || !userBankAccountId || !accountId || !amount || !referenceNumber) {
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

    // Verify the user bank account exists and belongs to the user
    const userBankAccount = await prisma.userBankAccount.findFirst({
      where: {
        id: userBankAccountId,
        userId,
        isActive: true,
      },
      include: {
        bank: true,
      },
    });

    if (!userBankAccount) {
      return NextResponse.json(
        { error: 'Invalid bank account' },
        { status: 400 }
      );
    }

    // Create the deposit
    const deposit = await prisma.bankDeposit.create({
      data: {
        userId,
        userBankAccountId,
        accountId,
        amount: parseFloat(amount),
        referenceNumber: referenceNumber.trim(),
        proofImage: proofImage || null,
        status: 'PENDING',
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
          message: `A new bank deposit of $${amount} has been submitted via ${userBankAccount.bank.name}`,
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
        message: `Your bank deposit of $${amount} via ${userBankAccount.bank.name} is awaiting admin verification`,
      },
    });

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
