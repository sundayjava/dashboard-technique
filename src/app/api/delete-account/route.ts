import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteAvatarFile } from '@/lib/file-utils';

// DELETE - Delete user account
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const requesterId = searchParams.get('requesterId');
    const requesterRole = searchParams.get('requesterRole');

    if (!userId || !requesterId) {
      return NextResponse.json(
        { error: 'User ID and requester ID are required' },
        { status: 400 }
      );
    }

    // Check if requester is admin or deleting their own account
    const isAdmin = requesterRole === 'ADMIN';
    const isSelfDelete = userId === requesterId;

    if (!isAdmin && !isSelfDelete) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this account' },
        { status: 403 }
      );
    }

    // Get user data to retrieve avatar path
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete avatar file if exists
    if (user.avatar) {
      await deleteAvatarFile(user.avatar);
    }

    // Delete user from database
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
