import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Mark notification as read
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    return NextResponse.json({
      message: 'Notification marked as read',
      notification
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}

// Delete notification
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await prisma.notification.delete({
      where: { id }
    });

    return NextResponse.json({
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}
