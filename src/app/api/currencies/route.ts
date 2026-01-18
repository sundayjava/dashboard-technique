import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch all currencies
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const currencies = await prisma.currency.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { code: 'asc' },
    });

    return NextResponse.json(currencies);
  } catch (error) {
    console.error('Error fetching currencies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch currencies' },
      { status: 500 }
    );
  }
}

// POST - Create new currency (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, name, symbol } = body;

    if (!code || !name || !symbol) {
      return NextResponse.json(
        { error: 'Code, name, and symbol are required' },
        { status: 400 }
      );
    }

    // Check if currency already exists
    const existing = await prisma.currency.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Currency with this code already exists' },
        { status: 400 }
      );
    }

    const currency = await prisma.currency.create({
      data: {
        code: code.toUpperCase(),
        name,
        symbol,
      },
    });

    return NextResponse.json({
      currency,
      message: 'Currency created successfully',
    });
  } catch (error) {
    console.error('Error creating currency:', error);
    return NextResponse.json(
      { error: 'Failed to create currency' },
      { status: 500 }
    );
  }
}
