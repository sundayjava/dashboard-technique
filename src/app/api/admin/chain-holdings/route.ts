import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch all Chain Account holdings (admin)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('adminId');
    const status = searchParams.get('status');

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }

    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const whereClause: any = {};
    if (status) whereClause.status = status;

    const holdings = await prisma.chainAccountHolding.findMany({
      where: whereClause,
      include: {
        chainAccount: {
          select: { id: true, accountName: true, accountNumber: true, currency: true },
        },
        initiator: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        token: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const stats = {
      totalHoldings: holdings.length,
      pendingHoldings: holdings.filter(h => h.status === 'PENDING').length,
      activeHoldings: holdings.filter(h => h.status === 'ACTIVE').length,
      totalValue: holdings
        .filter(h => h.status === 'ACTIVE')
        .reduce((sum, h) => sum + h.currentValue, 0),
      totalInterest: holdings
        .filter(h => h.status === 'ACTIVE')
        .reduce((sum, h) => sum + h.interestEarned, 0),
    };

    return NextResponse.json({ holdings, stats });
  } catch (error) {
    console.error('Error fetching chain account holdings:', error);
    return NextResponse.json({ error: 'Failed to fetch holdings' }, { status: 500 });
  }
}
