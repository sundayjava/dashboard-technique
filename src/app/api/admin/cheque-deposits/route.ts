import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'PENDING' | 'APPROVED' | 'REJECTED' | null;

    const deposits = await prisma.chequeDeposit.findMany({
      where: status ? { status } : undefined,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
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
