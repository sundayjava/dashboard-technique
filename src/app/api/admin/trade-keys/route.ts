import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch trade keys (all for admin, or by userId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const where: any = userId ? { userId } : {};

    const tradeKeys = await prisma.tradeKey.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        investmentAccess: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            accessedAt: 'desc',
          },
        },
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
    const { createdBy, maxUses, expiresAt } = body;

    // Generate unique trade key
    const key = `TK-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    const data: any = {
      key,
      // userId is omitted to leave it null (unassigned)
    };
    
    if (createdBy) data.createdBy = createdBy;
    if (maxUses) data.maxUses = maxUses;
    if (expiresAt) data.expiresAt = new Date(expiresAt);

    const tradeKey = await prisma.tradeKey.create({
      data,
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

// PUT - Update trade key (toggle active status)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Trade key ID is required' },
        { status: 400 }
      );
    }

    const tradeKey = await prisma.tradeKey.update({
      where: { id },
      data: { isActive },
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

    return NextResponse.json({
      message: 'Trade key updated successfully',
      tradeKey,
    });
  } catch (error) {
    console.error('Error updating trade key:', error);
    return NextResponse.json(
      { error: 'Failed to update trade key' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a trade key
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Trade key ID is required' },
        { status: 400 }
      );
    }

    // Delete the trade key
    await prisma.tradeKey.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Trade key deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting trade key:', error);
    return NextResponse.json(
      { error: 'Failed to delete trade key' },
      { status: 500 }
    );
  }
}
