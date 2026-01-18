import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Create new FAQ (Admin only)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { category, question, answer, order, isActive } = body;

    const faq = await prisma.fAQ.create({
      data: {
        category,
        question,
        answer,
        order: order || 0,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({
      message: 'FAQ created successfully',
      faq,
    });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    return NextResponse.json(
      { error: 'Failed to create FAQ' },
      { status: 500 }
    );
  }
}
