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
    console.log('🔍 Looking up user with ID:', userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, accountDisabled: true },
    });

    if (!user) {
      console.error('❌ User not found with ID:', userId);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('✅ User found:', { id: user.id, email: user.email, name: user.name });

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

    try {
      console.log('📧 Attempting to send OTP email to:', user.email);
      console.log('   OTP:', otp);
      console.log('   Name:', user.name || 'valued customer');
      console.log('   Type:', type);
      await sendOTPEmail(user.email, otp, user.name || 'valued customer', type);
      console.log('✅ OTP email sent successfully to:', user.email);
    } catch (emailError: any) {
      console.error('❌ Error sending OTP email:', emailError);
      // Delete the OTP since we couldn't send the email
      await prisma.transferOTP.deleteMany({
        where: {
          userId: user.id,
          otp,
        },
      });
      return NextResponse.json(
        { 
          error: emailError.message || 'Failed to send OTP email. Please check your email configuration.',
          details: 'Email server is not properly configured. Contact support if this persists.'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your email address',
      expiresAt,
    });
  } catch (error: any) {
    console.error('Error generating OTP:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate OTP. Please try again.' },
      { status: 500 }
    );
  }
}
