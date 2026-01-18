import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - List all active crypto tokens
export async function GET() {
  try {
    const tokens = await prisma.cryptoToken.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({ tokens });
  } catch (error) {
    console.error('Error fetching crypto tokens:', error);
    return NextResponse.json(
      { error: 'Failed to fetch crypto tokens' },
      { status: 500 }
    );
  }
}

// POST - Create new crypto token (Admin only)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, symbol, network, address, icon, exchangeRate } = body;

    if (!name || !symbol || !network || !address) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const token = await prisma.cryptoToken.create({
      data: {
        name,
        symbol: symbol.toUpperCase(),
        network,
        address,
        icon: icon || null,
        exchangeRate: parseFloat(exchangeRate) || 0,
      },
    });

    return NextResponse.json({ token }, { status: 201 });
  } catch (error) {
    console.error('Error creating crypto token:', error);
    return NextResponse.json(
      { error: 'Failed to create crypto token' },
      { status: 500 }
    );
  }
}
