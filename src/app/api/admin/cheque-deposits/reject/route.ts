import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { depositId, adminId, adminNotes } = body;

    if (!depositId || !adminId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!adminNotes) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // Get deposit details
    const deposit = await prisma.chequeDeposit.findUnique({
      where: { id: depositId },
    });

    if (!deposit) {
      return NextResponse.json({ error: 'Deposit not found' }, { status: 404 });
    }

    if (deposit.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'This deposit has already been processed' },
        { status: 400 }
      );
    }

    // Update cheque deposit status
    const updatedDeposit = await prisma.chequeDeposit.update({
      where: { id: depositId },
      data: {
        status: 'REJECTED',
        processedAt: new Date(),
        processedBy: adminId,
        adminNotes,
      },
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: deposit.userId,
        type: 'SYSTEM',
        title: 'Cheque Deposit Rejected',
        message: `Your cheque deposit of $${deposit.amount.toFixed(2)} has been rejected. Reason: ${adminNotes}`,
      },
    });

    // Create activity log for user
    await prisma.activityLog.create({
      data: {
        userId: deposit.userId,
        action: 'CHEQUE_DEPOSIT_REJECTED',
        description: `Cheque deposit of $${deposit.amount.toFixed(2)} was rejected by admin`,
        metadata: {
          depositId: depositId,
          amount: deposit.amount,
          processedBy: adminId,
          rejectionReason: adminNotes,
        },
      },
    });

    // Create activity log for admin
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'ADMIN_CHEQUE_REJECTED',
        description: `Rejected cheque deposit of $${deposit.amount.toFixed(2)} for user ID: ${deposit.userId}`,
        metadata: {
          depositId: depositId,
          targetUserId: deposit.userId,
          amount: deposit.amount,
          rejectionReason: adminNotes,
        },
      },
    });

    return NextResponse.json({
      deposit: updatedDeposit,
      message: 'Cheque deposit rejected successfully',
    });
  } catch (error) {
    console.error('Error rejecting cheque deposit:', error);
    return NextResponse.json(
      { error: 'Failed to reject cheque deposit' },
      { status: 500 }
    );
  }
}
