import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get all addresses assigned to a user
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get all addresses assigned to this user
    const userAddresses = await prisma.userDepositAddress.findMany({
      where: {
        userId: userId,
      },
      include: {
        address: true,
      },
    });

    // Extract just the address details
    const addresses = userAddresses.map(ua => ua.address);

    return NextResponse.json({ addresses });
  } catch (error) {
    console.error('Error fetching user addresses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch addresses' },
      { status: 500 }
    );
  }
}
