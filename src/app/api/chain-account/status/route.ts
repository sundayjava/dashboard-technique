import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    // Get user's chain account memberships
    const memberships = await prisma.chainAccountMember.findMany({
      where: { userId },
      include: {
        chainAccount: {
          select: {
            id: true,
            accountName: true,
            accountNumber: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Check if user has any pending memberships
    const hasPending = memberships.some(m => 
      m.chainAccount.status === 'PENDING' && !m.hasConfirmed
    );

    // Check if user has any active memberships
    const hasActive = memberships.some(m => 
      m.chainAccount.status === 'ACTIVE' && m.hasConfirmed
    );

    // Get count
    const totalCount = memberships.filter(m => 
      m.chainAccount.status === 'PENDING' || m.chainAccount.status === 'ACTIVE'
    ).length;

    // Determine state
    let state: 'none' | 'pending' | 'active' = 'none';
    if (hasActive) {
      state = 'active';
    } else if (hasPending) {
      state = 'pending';
    }

    return NextResponse.json({
      success: true,
      data: {
        state,
        totalCount,
        canCreateNew: totalCount < 3,
        memberships: memberships.map(m => ({
          id: m.id,
          accountName: m.chainAccount.accountName,
          accountNumber: m.chainAccount.accountNumber,
          status: m.chainAccount.status,
          role: m.role,
          hasConfirmed: m.hasConfirmed,
          confirmedAt: m.confirmedAt,
          hasAccessToken: !!m.accessTokenHash,
        })),
      },
    });

  } catch (error) {
    console.error('Error fetching chain account status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
