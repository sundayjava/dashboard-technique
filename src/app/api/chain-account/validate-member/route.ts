import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserChainAccountCount } from '@/lib/chain-account-utils';

export async function POST(request: NextRequest) {
  try {
    const { email, excludeUserId } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        name: true,
        email: true,
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'No Acredis account found for this email. This person must register on Acredis first.' },
        { status: 404 }
      );
    }

    // Check if trying to add self
    if (excludeUserId && user.id === excludeUserId) {
      return NextResponse.json(
        { error: 'You cannot add yourself as a co-signatory' },
        { status: 400 }
      );
    }

    // Check if user has reached the 3 Chain Account limit
    const chainAccountCount = await getUserChainAccountCount(user.id);
    
    if (chainAccountCount >= 3) {
      return NextResponse.json(
        { error: `${user.name || 'This user'} has reached their maximum of 3 Chain Accounts and cannot be added.` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      }
    });

  } catch (error) {
    console.error('Error validating member:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
