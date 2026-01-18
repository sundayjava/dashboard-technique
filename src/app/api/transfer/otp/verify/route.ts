import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Verify OTP for transfer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, otp, type } = body;

    if (!userId || !otp || !type) {
      return NextResponse.json(
        { error: 'User ID, OTP, and type are required' },
        { status: 400 }
      );
    }

    // Find the OTP
    const otpRecord = await prisma.transferOTP.findFirst({
      where: {
        userId,
        otp,
        type,
        verified: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpRecord) {
      return NextResponse.json(
        { error: 'Invalid OTP. Please check and try again.' },
        { status: 400 }
      );
    }

    // Check if OTP has expired
    if (new Date() > otpRecord.expiresAt) {
      return NextResponse.json(
        { error: 'OTP has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Mark OTP as verified
    await prisma.transferOTP.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
      otpId: otpRecord.id,
    });
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json(
      { error: 'Failed to verify OTP. Please try again.' },
      { status: 500 }
    );
  }
}
