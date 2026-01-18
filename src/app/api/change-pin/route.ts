import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, currentPin, newPin } = body;

    if (!userId || !currentPin || !newPin) {
      return NextResponse.json(
        { error: 'User ID, current PIN, and new PIN are required' },
        { status: 400 }
      );
    }

    // Validate PIN format (4 digits)
    if (!/^\d{4}$/.test(newPin)) {
      return NextResponse.json(
        { error: 'PIN must be exactly 4 digits' },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(currentPin)) {
      return NextResponse.json(
        { error: 'Current PIN must be exactly 4 digits' },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        transactionPin: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify current PIN
    const isPinValid = await bcrypt.compare(currentPin, user.transactionPin);

    if (!isPinValid) {
      return NextResponse.json(
        { error: 'Current PIN is incorrect' },
        { status: 401 }
      );
    }

    // Check if new PIN is same as current
    const isSamePin = await bcrypt.compare(newPin, user.transactionPin);
    if (isSamePin) {
      return NextResponse.json(
        { error: 'New PIN must be different from current PIN' },
        { status: 400 }
      );
    }

    // Hash new PIN
    const hashedPin = await bcrypt.hash(newPin, 12);

    // Update PIN
    await prisma.user.update({
      where: { id: userId },
      data: { transactionPin: hashedPin },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'PIN_CHANGED',
        description: 'User changed their transaction PIN',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        type: 'SECURITY',
        title: 'Transaction PIN Changed',
        message: 'Your transaction PIN has been successfully changed. If you did not make this change, please contact support immediately.',
      },
    });

    return NextResponse.json({
      message: 'Transaction PIN changed successfully',
    });
  } catch (error: any) {
    console.error('Error changing PIN:', error);
    return NextResponse.json(
      { error: 'Failed to change PIN' },
      { status: 500 }
    );
  }
}
