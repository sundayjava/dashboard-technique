import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Check if user has investment access
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

    // Check if user has any investment access
    const access = await prisma.investmentAccess.findFirst({
      where: { userId },
      include: {
        tradeKey: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        accessedAt: 'desc',
      },
    });

    return NextResponse.json({
      hasAccess: !!access,
      access: access
        ? {
            accessedAt: access.accessedAt,
            keyOwner: access.tradeKey.user.name || access.tradeKey.user.email,
          }
        : null,
    });
  } catch (error) {
    console.error('Error checking investment access:', error);
    return NextResponse.json(
      { error: 'Failed to check investment access' },
      { status: 500 }
    );
  }
}
