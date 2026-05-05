import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Get all users (admin only)
export async function GET(request: NextRequest) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        canTransfer: true,
        transferDisabled: true,
        accountDisabled: true,
        isVerified: true,
        requireOTPForInternational: true,
        phoneNumber: true,
        authorizationCode: true,
        createdAt: true,
        accounts: {
          select: {
            id: true,
            accountNumber: true,
            accountName: true,
            balance: true,
            currency: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
