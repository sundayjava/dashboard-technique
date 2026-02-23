import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const assignment = await prisma.arkIIAssignment.findFirst({
      where: { userId },
      select: { id: true, amount: true, notes: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json({
      assigned: !!assignment,
      amount: assignment?.amount ?? 0,
      notes: assignment?.notes ?? null,
      updatedAt: assignment?.updatedAt ?? null,
    });
  } catch (error) {
    console.error('Error fetching ARK II assignment:', error);
    return NextResponse.json({ error: 'Failed to fetch ARK II data' }, { status: 500 });
  }
}
