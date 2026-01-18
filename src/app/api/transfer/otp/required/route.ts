import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Check if user requires OTP for international transfers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        requireOTPForInternational: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      requireOTP: user.requireOTPForInternational,
    });
  } catch (error: any) {
    console.error('Error checking OTP requirement:', error);
    return NextResponse.json(
      { error: 'Failed to check OTP requirement' },
      { status: 500 }
    );
  }
}
