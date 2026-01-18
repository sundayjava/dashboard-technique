import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch user bank accounts
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

    const bankAccounts = await prisma.userBankAccount.findMany({
      where: { userId },
      include: {
        bank: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ bankAccounts });
  } catch (error) {
    console.error('Error fetching user bank accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bank accounts' },
      { status: 500 }
    );
  }
}

// POST - Assign bank account to user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, bankId, accountName, accountNumber, bankBranch, instructions } = body;

    if (!userId || !bankId || !accountName || !accountNumber) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user already has an account for this bank
    const existing = await prisma.userBankAccount.findUnique({
      where: {
        userId_bankId: {
          userId,
          bankId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'User already has an account assigned for this bank' },
        { status: 400 }
      );
    }

    const bankAccount = await prisma.userBankAccount.create({
      data: {
        userId,
        bankId,
        accountName,
        accountNumber,
        bankBranch: bankBranch || null,
        instructions: instructions || null,
      },
      include: {
        bank: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return NextResponse.json({
      bankAccount,
      message: 'Bank account assigned successfully',
    });
  } catch (error) {
    console.error('Error creating user bank account:', error);
    return NextResponse.json(
      { error: 'Failed to assign bank account' },
      { status: 500 }
    );
  }
}
