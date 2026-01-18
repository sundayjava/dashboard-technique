import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, pin } = body;

    // Validate input
    if (!email || !pin) {
      return NextResponse.json(
        { error: 'Email and PIN are required' },
        { status: 400 }
      );
    }

    // Validate PIN format (4 digits)
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: 'Invalid PIN format. Must be 4 digits' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        transactionPin: true,
        emailVerified: true,
        authorizationCode: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify transaction PIN
    const isPinValid = await bcrypt.compare(pin, user.transactionPin);

    if (!isPinValid) {
      return NextResponse.json(
        { error: 'Invalid transaction PIN' },
        { status: 401 }
      );
    }

    // Return user data (excluding PIN)
    const { transactionPin: _, ...userWithoutPin } = user;

    return NextResponse.json(
      {
        message: 'PIN verified successfully',
        user: userWithoutPin,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('PIN verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed. Please try again.' },
      { status: 500 }
    );
  }
}
