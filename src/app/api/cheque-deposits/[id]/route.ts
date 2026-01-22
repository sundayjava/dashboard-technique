import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// PATCH - Update cheque deposit
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { amount, status, adminNotes, chequeNumber } = body;

    // Check if deposit exists
    const existingDeposit = await prisma.transaction.findUnique({
      where: {
        id,
        transactionType: 'DEPOSIT',
        channel: 'CHEQUE',
      },
    });

    if (!existingDeposit) {
      return NextResponse.json(
        { error: 'Deposit not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (status !== undefined) {
      updateData.status = status;
      
      // Add processed timestamp if status is COMPLETED
      if (status === 'COMPLETED') {
        updateData.processedAt = new Date();
      }
    }
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    if (chequeNumber !== undefined) {
      updateData.metadata = {
        ...existingDeposit.metadata as any,
        chequeNumber,
      };
    }

    // Use transaction to update deposit and adjust account balance
    const result = await prisma.$transaction(async (tx) => {
      // Update deposit
      const deposit = await tx.transaction.update({
        where: { id },
        data: updateData,
        include: {
          account: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      const depositAmount = amount !== undefined ? parseFloat(amount) : existingDeposit.amount;
      const oldStatus = existingDeposit.status;
      const newStatus = status || oldStatus;

      // Handle balance changes based on status transitions
      if (oldStatus !== newStatus) {
        // Case 1: Changing TO COMPLETED (from any other status) - Credit balance
        if (newStatus === 'COMPLETED' && oldStatus !== 'COMPLETED') {
          const updatedAccount = await tx.account.update({
            where: { id: existingDeposit.accountId },
            data: {
              balance: { increment: depositAmount },
              availableBalance: { increment: depositAmount },
            },
          });

          await tx.transaction.update({
            where: { id },
            data: {
              balanceAfter: updatedAccount.balance,
            },
          });
        }
        
        // Case 2: Changing FROM COMPLETED to FAILED/CANCELLED - Debit balance
        if (oldStatus === 'COMPLETED' && (newStatus === 'FAILED' || newStatus === 'CANCELLED')) {
          const updatedAccount = await tx.account.update({
            where: { id: existingDeposit.accountId },
            data: {
              balance: { decrement: depositAmount },
              availableBalance: { decrement: depositAmount },
            },
          });

          await tx.transaction.update({
            where: { id },
            data: {
              balanceAfter: updatedAccount.balance,
            },
          });
        }
      }

      return deposit;
    });

    // Send notification email to user when status becomes COMPLETED
    try {
      if (status === 'COMPLETED') {
        const deposit = result as any;
        const userEmail = deposit.user?.email;
        const userName = deposit.user?.name || '';
        if (userEmail) {
          await sendEmail({
            to: userEmail,
            subject: `Cheque deposit approved - ${deposit.currency} ${deposit.amount}`,
            html: `<div style="font-family: Arial, sans-serif; max-width:600px;margin:0 auto;">\
              <h2>Cheque Deposit Approved</h2>\
              <p>Hello ${userName || 'user'},</p>\
              <p>Your cheque deposit of <strong>${deposit.currency} ${deposit.amount}</strong> has been approved and credited to your account.</p>\
              <p>Reference: ${deposit.reference}</p>\
            </div>`,
          });
        }
      }
    } catch (emailErr) {
      console.error('Error sending cheque deposit email:', emailErr);
    }

    return NextResponse.json({ deposit: result });
  } catch (error) {
    console.error('Error updating cheque deposit:', error);
    return NextResponse.json(
      { error: 'Failed to update cheque deposit' },
      { status: 500 }
    );
  }
}

// DELETE - Delete cheque deposit
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check if deposit exists
    const existingDeposit = await prisma.transaction.findUnique({
      where: {
        id,
        transactionType: 'DEPOSIT',
        channel: 'CHEQUE',
      },
    });

    if (!existingDeposit) {
      return NextResponse.json(
        { error: 'Deposit not found' },
        { status: 404 }
      );
    }

    // Delete deposit
    await prisma.transaction.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Deposit deleted successfully' });
  } catch (error) {
    console.error('Error deleting cheque deposit:', error);
    return NextResponse.json(
      { error: 'Failed to delete cheque deposit' },
      { status: 500 }
    );
  }
}
