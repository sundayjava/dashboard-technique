import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET single bank
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bank = await prisma.bank.findUnique({
      where: { id },
    });

    if (!bank) {
      return NextResponse.json(
        { error: 'Bank not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ bank });
  } catch (error) {
    console.error('Error fetching bank:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bank' },
      { status: 500 }
    );
  }
}

// PUT update bank
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { code, name, isActive } = body;

    if (!code || !name) {
      return NextResponse.json(
        { error: 'Bank code and name are required' },
        { status: 400 }
      );
    }

    // Check if bank exists
    const existingBank = await prisma.bank.findUnique({
      where: { id },
    });

    if (!existingBank) {
      return NextResponse.json(
        { error: 'Bank not found' },
        { status: 404 }
      );
    }

    // Check if new code conflicts with another bank
    if (code.toUpperCase() !== existingBank.code) {
      const codeConflict = await prisma.bank.findUnique({
        where: { code: code.toUpperCase() },
      });

      if (codeConflict) {
        return NextResponse.json(
          { error: 'Bank code already exists' },
          { status: 400 }
        );
      }
    }

    const bank = await prisma.bank.update({
      where: { id },
      data: {
        code: code.toUpperCase(),
        name,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json({ bank });
  } catch (error) {
    console.error('Error updating bank:', error);
    return NextResponse.json(
      { error: 'Failed to update bank' },
      { status: 500 }
    );
  }
}

// DELETE bank
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Check if bank exists
    const existingBank = await prisma.bank.findUnique({
      where: { id },
    });

    if (!existingBank) {
      return NextResponse.json(
        { error: 'Bank not found' },
        { status: 404 }
      );
    }

    await prisma.bank.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Bank deleted successfully' });
  } catch (error) {
    console.error('Error deleting bank:', error);
    return NextResponse.json(
      { error: 'Failed to delete bank' },
      { status: 500 }
    );
  }
}
