import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const identifier = searchParams.get('identifier'); // Can be accountNumber or email

    if (!identifier) {
      return NextResponse.json(
        { error: 'Account number or email is required' },
        { status: 400 }
      );
    }

    // Try to find user by account number first
    let account = await prisma.account.findUnique({
      where: { accountNumber: identifier },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // If not found by account number, try by email
    if (!account) {
      const user = await prisma.user.findUnique({
        where: { email: identifier },
        include: {
          accounts: {
            where: { status: 'ACTIVE' },
            take: 1,
          },
        },
      });

      if (user && user.accounts.length > 0) {
        account = await prisma.account.findUnique({
          where: { id: user.accounts[0].id },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        });
      }
    }

    if (!account) {
      return NextResponse.json(
        { error: 'Recipient not found' },
        { status: 404 }
      );
    }

    // Check if account is active
    if (account.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Recipient account is not active' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      accountType: account.accountType,
      currency: account.currency,
      userId: account.user.id,
      userName: account.user.name,
      userEmail: account.user.email,
      userAvatar: account.user.avatar,
    });
  } catch (error) {
    console.error('Error verifying recipient:', error);
    return NextResponse.json(
      { error: 'Failed to verify recipient' },
      { status: 500 }
    );
  }
}
