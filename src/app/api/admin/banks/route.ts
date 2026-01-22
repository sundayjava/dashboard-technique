import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET all banks
export async function GET() {
  try {
    const banks = await prisma.bank.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({ banks });
  } catch (error) {
    console.error('Error fetching banks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch banks' },
      { status: 500 }
    );
  }
}

// POST create new bank
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, name, isActive } = body;

    if (!code || !name) {
      return NextResponse.json(
        { error: 'Bank code and name are required' },
        { status: 400 }
      );
    }

    // Check if bank code already exists
    const existingBank = await prisma.bank.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (existingBank) {
      return NextResponse.json(
        { error: 'Bank code already exists' },
        { status: 400 }
      );
    }

    const bank = await prisma.bank.create({
      data: {
        code: code.toUpperCase(),
        name,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json({ bank }, { status: 201 });
  } catch (error) {
    console.error('Error creating bank:', error);
    return NextResponse.json(
      { error: 'Failed to create bank' },
      { status: 500 }
    );
  }
}
