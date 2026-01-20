import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Remove address assignment from user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if assignment exists
    const assignment = await prisma.userDepositAddress.findUnique({
      where: { id },
      include: {
        user: true,
        address: true,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Delete the assignment
    await prisma.userDepositAddress.delete({
      where: { id },
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: assignment.userId,
        type: 'SYSTEM',
        title: 'Deposit Address Removed',
        message: `A ${assignment.address.type === 'CRYPTO' ? 'crypto' : 'bank'} deposit address has been removed from your account.`,
      },
    });

    return NextResponse.json({ message: 'Assignment removed successfully' });
  } catch (error: any) {
    console.error('Error removing assignment:', error);
    return NextResponse.json(
      { error: 'Failed to remove assignment' },
      { status: 500 }
    );
  }
}
