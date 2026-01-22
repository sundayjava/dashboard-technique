import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get all investment transactions (admin only)
export async function GET(request: NextRequest) {
  try {
    const transactions = await prisma.investmentTransaction.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
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
