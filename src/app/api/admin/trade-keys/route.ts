import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch user's trade keys
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

    const tradeKeys = await prisma.tradeKey.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            investmentAccess: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ tradeKeys });
  } catch (error) {
    console.error('Error fetching trade keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trade keys' },
      { status: 500 }
    );
  }
}

// POST - Create new trade key (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, createdBy, maxUses, expiresAt } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Generate unique trade key
    const key = `TK-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    const tradeKey = await prisma.tradeKey.create({
      data: {
        key,
        userId,
        createdBy,
        maxUses: maxUses || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        userId: createdBy || userId,
        action: 'TRADE_KEY_CREATED',
        description: `Trade key created for ${tradeKey.user.name || tradeKey.user.email}`,
        metadata: {
          tradeKeyId: tradeKey.id,
          targetUserId: userId,
          key: tradeKey.key,
        },
      },
    });

    return NextResponse.json({
      message: 'Trade key created successfully',
      tradeKey,
    });
  } catch (error) {
    console.error('Error creating trade key:', error);
    return NextResponse.json(
      { error: 'Failed to create trade key' },
      { status: 500 }
    );
  }
}
