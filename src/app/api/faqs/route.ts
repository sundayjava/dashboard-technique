import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    let where: any = { isActive: true };

    if (category && category !== 'All') {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { answer: { contains: search, mode: 'insensitive' } },
      ];
    }

    const faqs = await prisma.fAQ.findMany({
      where,
      orderBy: { order: 'asc' },
    });

    // Get unique categories
    const categories = await prisma.fAQ.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ['category'],
    });

    return NextResponse.json({
      faqs,
      categories: categories.map((c: { category: string }) => c.category),
    });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch FAQs' },
      { status: 500 }
    );
  }
}
