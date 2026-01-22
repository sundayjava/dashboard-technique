import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get user investment transactions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const type = searchParams.get('type'); // Filter by transaction type

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const where: any = { userId };
    if (type) {
      where.transactionType = type;
    }

    const transactions = await prisma.investmentTransaction.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    return NextResponse.json({
      success: true,
      transactions
    });

  } catch (error) {
    console.error('Error fetching investment transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch investment transactions' },
      { status: 500 }
    );
  }
}
