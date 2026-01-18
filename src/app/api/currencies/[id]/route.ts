import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch single currency
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currency = await prisma.currency.findUnique({
      where: { id },
    });

    if (!currency) {
      return NextResponse.json(
        { error: 'Currency not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(currency);
  } catch (error) {
    console.error('Error fetching currency:', error);
    return NextResponse.json(
      { error: 'Failed to fetch currency' },
      { status: 500 }
    );
  }
}

// PATCH - Update currency (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { code, name, symbol, isActive } = body;

    const currency = await prisma.currency.update({
      where: { id },
      data: {
        ...(code && { code: code.toUpperCase() }),
        ...(name && { name }),
        ...(symbol && { symbol }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({
      currency,
      message: 'Currency updated successfully',
    });
  } catch (error) {
    console.error('Error updating currency:', error);
    return NextResponse.json(
      { error: 'Failed to update currency' },
      { status: 500 }
    );
  }
}

// DELETE - Delete currency (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.currency.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Currency deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting currency:', error);
    return NextResponse.json(
      { error: 'Failed to delete currency' },
      { status: 500 }
    );
  }
}
