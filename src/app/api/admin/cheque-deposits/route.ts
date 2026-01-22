import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');

    const deposits = await prisma.transaction.findMany({
      where: {
        transactionType: 'DEPOSIT',
        channel: 'CHEQUE',
        ...(statusParam ? { status: statusParam as any } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
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
