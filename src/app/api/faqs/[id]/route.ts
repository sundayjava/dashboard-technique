import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Get single FAQ
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const faq = await prisma.fAQ.findUnique({
      where: { id },
    });

    if (!faq) {
      return NextResponse.json(
        { error: 'FAQ not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(faq);
  } catch (error) {
    console.error('Error fetching FAQ:', error);
    return NextResponse.json(
      { error: 'Failed to fetch FAQ' },
      { status: 500 }
    );
  }
}

// Update FAQ (Admin only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { category, question, answer, order, isActive } = body;

    const faq = await prisma.fAQ.update({
      where: { id },
      data: {
        category,
        question,
        answer,
        order,
        isActive,
      },
    });

    return NextResponse.json({
      message: 'FAQ updated successfully',
      faq,
    });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    return NextResponse.json(
      { error: 'Failed to update FAQ' },
      { status: 500 }
    );
  }
}

// Delete FAQ (Admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.fAQ.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'FAQ deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    return NextResponse.json(
      { error: 'Failed to delete FAQ' },
      { status: 500 }
    );
  }
}
