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
    const deposit = await prisma.bankDeposit.findUnique({
      where: { id: depositId },
      include: {
        userBankAccount: {
          include: {
            bank: true,
          },
        },
      },
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

    // Update bank deposit status
    const updatedDeposit = await prisma.bankDeposit.update({
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
        title: 'Bank Deposit Rejected',
        message: `Your bank deposit of $${deposit.amount.toFixed(2)} via ${deposit.userBankAccount.bank.name} has been rejected. Reason: ${adminNotes}`,
      },
    });

    // Create activity log for user
    await prisma.activityLog.create({
      data: {
        userId: deposit.userId,
        action: 'BANK_DEPOSIT_REJECTED',
        description: `Bank deposit of $${deposit.amount.toFixed(2)} via ${deposit.userBankAccount.bank.name} was rejected`,
        metadata: {
          depositId: depositId,
          amount: deposit.amount,
          bankName: deposit.userBankAccount.bank.name,
          processedBy: adminId,
          rejectionReason: adminNotes,
        },
      },
    });

    // Create activity log for admin
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'ADMIN_BANK_DEPOSIT_REJECTED',
        description: `Rejected bank deposit of $${deposit.amount.toFixed(2)} for user ID: ${deposit.userId}`,
        metadata: {
          depositId: depositId,
          targetUserId: deposit.userId,
          amount: deposit.amount,
          bankName: deposit.userBankAccount.bank.name,
          rejectionReason: adminNotes,
        },
      },
    });

    return NextResponse.json({
      deposit: updatedDeposit,
      message: 'Bank deposit rejected successfully',
    });
  } catch (error) {
    console.error('Error rejecting bank deposit:', error);
    return NextResponse.json(
      { error: 'Failed to reject bank deposit' },
      { status: 500 }
    );
  }
}
