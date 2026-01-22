import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if already a Plus user
    if (user.isPlusUser) {
      return NextResponse.json(
        { error: 'You are already an Acredis Plus member' },
        { status: 400 }
      );
    }

    // Activate Acredis Plus
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isPlusUser: true
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: 'Welcome to Acredis Plus! 🎉',
        message: 'You now have access to unlimited financial planning, comprehensive wealth guidance, priority IPO access, and exclusive premium benefits.',
        isRead: false
      }
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'ACREDIS_PLUS_ACTIVATED',
        description: 'Activated Acredis Plus premium membership'
      }
    });

    return NextResponse.json({
      message: 'Acredis Plus activated successfully',
      user: {
        id: updatedUser.id,
        isPlusUser: updatedUser.isPlusUser
      }
    });
  } catch (error) {
    console.error('Error activating Acredis Plus:', error);
    return NextResponse.json(
      { error: 'Failed to activate Acredis Plus' },
      { status: 500 }
    );
  }
}
