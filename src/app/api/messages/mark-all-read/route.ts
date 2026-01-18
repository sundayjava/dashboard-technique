import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Mark all messages as read for a user
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const result = await prisma.message.updateMany({
      where: {
        receiverId: userId,
        isRead: false
      },
      data: {
        isRead: true
      }
    });

    return NextResponse.json({
      message: 'All messages marked as read',
      count: result.count
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark messages as read' },
      { status: 500 }
    );
  }
}
