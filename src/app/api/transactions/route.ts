import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = searchParams.get('limit');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Build query
    const query: any = {
      where: { userId },
      include: {
        account: {
          select: {
            accountNumber: true,
            currency: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    };

    // Add limit if provided
    if (limit) {
      query.take = parseInt(limit);
    }

    // Fetch transactions
    const transactions = await prisma.transaction.findMany(query);

    // Transform transactions for frontend
    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      type: tx.transactionType,
      amount: Math.abs(tx.amount),
      status: tx.status,
      createdAt: tx.createdAt,
      description: tx.description,
      reference: tx.reference,
      currency: tx.currency,
      recipientName: tx.recipientName,
      senderName: tx.senderName,
      balanceAfter: tx.balanceAfter,
    }));

    return NextResponse.json({ transactions: formattedTransactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
