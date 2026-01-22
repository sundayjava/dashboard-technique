import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Validate trade key and grant investment access
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, tradeKey } = body;

    if (!userId || !tradeKey) {
      return NextResponse.json(
        { error: 'User ID and trade key are required' },
        { status: 400 }
      );
    }

    // Find the trade key
    const key = await prisma.tradeKey.findUnique({
      where: { key: tradeKey },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!key) {
      return NextResponse.json(
        { error: 'Invalid trade key' },
        { status: 404 }
      );
    }

    // Validate key is active
    if (!key.isActive) {
      return NextResponse.json(
        { error: 'This trade key has been deactivated' },
        { status: 403 }
      );
    }

    // Check if key has expired
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'This trade key has expired' },
        { status: 403 }
      );
    }

    // Check max uses
    if (key.maxUses && key.currentUses >= key.maxUses) {
      return NextResponse.json(
        { error: 'This trade key has reached its maximum usage limit' },
        { status: 403 }
      );
    }

    // Check if user already has access using this key
    const existingAccess = await prisma.investmentAccess.findUnique({
      where: {
        userId_tradeKeyId: {
          userId,
          tradeKeyId: key.id,
        },
      },
    });

    if (existingAccess) {
      return NextResponse.json({
        message: 'Access already granted',
        alreadyHasAccess: true,
        tradeKey: {
          owner: key.user?.name || key.user?.email || 'Unassigned',
          accessedAt: existingAccess.accessedAt,
        },
      });
    }

    // Grant access and increment usage counter
    await prisma.$transaction([
      prisma.investmentAccess.create({
        data: {
          userId,
          tradeKeyId: key.id,
        },
      }),
      prisma.tradeKey.update({
        where: { id: key.id },
        data: {
          currentUses: {
            increment: 1,
          },
        },
      }),
      // Create activity log
      prisma.activityLog.create({
        data: {
          userId,
          action: 'INVESTMENT_ACCESS_GRANTED',
          description: `Investment access granted using trade key from ${key.user?.name || key.user?.email || 'Unassigned'}`,
          metadata: {
            tradeKeyId: key.id,
            keyOwner: key.user?.email || 'unassigned',
          },
        },
      }),
    ]);

    return NextResponse.json({
      message: 'Investment access granted successfully',
      alreadyHasAccess: false,
      tradeKey: {
        owner: key.user?.name || key.user?.email || 'Unassigned',
      },
    });
  } catch (error) {
    console.error('Error validating trade key:', error);
    return NextResponse.json(
      { error: 'Failed to validate trade key' },
      { status: 500 }
    );
  }
}
