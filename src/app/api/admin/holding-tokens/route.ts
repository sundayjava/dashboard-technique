import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch all holding tokens
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('adminId');

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }

    // Verify admin
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const tokens = await prisma.holdingToken.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { userHoldings: true },
        },
      },
    });

    return NextResponse.json({ tokens });
  } catch (error) {
    console.error('Error fetching holding tokens:', error);
    return NextResponse.json({ error: 'Failed to fetch tokens' }, { status: 500 });
  }
}

// POST - Create new holding token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminId, name, symbol, logo, tokenAddress, interestRate } = body;

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }

    // Verify admin
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!name || !symbol) {
      return NextResponse.json({ error: 'Name and symbol are required' }, { status: 400 });
    }

    // Check if symbol already exists
    const existingToken = await prisma.holdingToken.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });

    if (existingToken) {
      return NextResponse.json({ error: 'Token with this symbol already exists' }, { status: 400 });
    }

    const token = await prisma.holdingToken.create({
      data: {
        name,
        symbol: symbol.toUpperCase(),
        logo: logo || null,
        tokenAddress: tokenAddress || null,
        interestRate: parseFloat(interestRate) || 0,
        currentPrice: 0, // Will be updated by price fetcher
        priceChange24h: 0,
      },
    });

    return NextResponse.json({ message: 'Token created successfully', token });
  } catch (error) {
    console.error('Error creating holding token:', error);
    return NextResponse.json({ error: 'Failed to create token' }, { status: 500 });
  }
}

// PATCH - Update holding token
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminId, tokenId, name, symbol, logo, tokenAddress, interestRate, isActive } = body;

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }

    // Verify admin
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!tokenId) {
      return NextResponse.json({ error: 'Token ID is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (symbol !== undefined) updateData.symbol = symbol.toUpperCase();
    if (logo !== undefined) updateData.logo = logo;
    if (tokenAddress !== undefined) updateData.tokenAddress = tokenAddress;
    if (interestRate !== undefined) updateData.interestRate = parseFloat(interestRate);
    if (isActive !== undefined) updateData.isActive = isActive;

    const token = await prisma.holdingToken.update({
      where: { id: tokenId },
      data: updateData,
    });

    return NextResponse.json({ message: 'Token updated successfully', token });
  } catch (error) {
    console.error('Error updating holding token:', error);
    return NextResponse.json({ error: 'Failed to update token' }, { status: 500 });
  }
}

// DELETE - Delete holding token
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('adminId');
    const tokenId = searchParams.get('tokenId');

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }

    // Verify admin
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!tokenId) {
      return NextResponse.json({ error: 'Token ID is required' }, { status: 400 });
    }

    // Check if token has active holdings
    const activeHoldings = await prisma.userHolding.count({
      where: {
        tokenId,
        status: 'ACTIVE',
      },
    });

    if (activeHoldings > 0) {
      return NextResponse.json(
        { error: `Cannot delete token with ${activeHoldings} active holdings. Please close all holdings first.` },
        { status: 400 }
      );
    }

    await prisma.holdingToken.delete({
      where: { id: tokenId },
    });

    return NextResponse.json({ message: 'Token deleted successfully' });
  } catch (error) {
    console.error('Error deleting holding token:', error);
    return NextResponse.json({ error: 'Failed to delete token' }, { status: 500 });
  }
}
