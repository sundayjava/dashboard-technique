import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendOTPEmail } from '@/lib/email';

// Generate and send OTP for transfer verification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, type } = body; // type: 'international_transfer' or 'domestic_transfer'

    if (!userId || !type) {
      return NextResponse.json(
        { error: 'User ID and type are required' },
        { status: 400 }
      );
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, accountDisabled: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.accountDisabled) {
      return NextResponse.json(
        { error: 'Your account has been disabled. Please contact support.' },
        { status: 403 }
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiry to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Invalidate any existing unverified OTPs for this user and type
    await prisma.transferOTP.updateMany({
      where: {
        userId: user.id,
        type,
        verified: false,
      },
      data: {
        verified: true, // Mark as verified to invalidate
      },
    });

    // Create new OTP
    await prisma.transferOTP.create({
      data: {
        userId: user.id,
        otp,
        type,
        expiresAt,
      },
    });

    // Send OTP via email
    const transferTypeName = type === 'international_transfer' 
      ? 'International Transfer' 
      : 'Domestic Transfer';

    await sendOTPEmail(user.email, otp, user.name || 'valued customer', type);

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your email address',
      expiresAt,
    });
  } catch (error: any) {
    console.error('Error generating OTP:', error);
    return NextResponse.json(
      { error: 'Failed to generate OTP. Please try again.' },
      { status: 500 }
    );
  }
}
