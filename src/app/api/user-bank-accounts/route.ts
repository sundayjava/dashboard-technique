import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get user's assigned bank accounts
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
      where: {
        userId,
        isActive: true,
      },
      include: {
        bank: {
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        bank: {
          name: 'asc',
        },
      },
    });

    // Filter to only include active banks
    const activeBankAccounts = bankAccounts.filter(ba => ba.bank.isActive);

    return NextResponse.json({ bankAccounts: activeBankAccounts });
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bank accounts' },
      { status: 500 }
    );
  }
}
