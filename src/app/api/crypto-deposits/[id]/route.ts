import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// PATCH - Update crypto deposit
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { amount, status, adminNotes, tokenName, network, transactionHash } = body;

    console.log('[Crypto Deposit PATCH] Updating deposit:', id, 'with data:', body);

    // Check if deposit exists
    const existingDeposit = await prisma.transaction.findUnique({
      where: {
        id,
        transactionType: 'DEPOSIT',
        channel: 'CRYPTO',
      },
    });

    if (!existingDeposit) {
      console.error('[Crypto Deposit PATCH] Deposit not found:', id);
      return NextResponse.json(
        { error: 'Deposit not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (status !== undefined) {
      // Map old status values to new ones
      const statusMap: Record<string, string> = {
        'VERIFIED': 'COMPLETED',
        'APPROVED': 'COMPLETED',
        'REJECTED': 'FAILED',
        'PENDING': 'PENDING',
        'PROCESSING': 'PROCESSING',
        'COMPLETED': 'COMPLETED',
        'FAILED': 'FAILED',
        'CANCELLED': 'CANCELLED',
        'REVERSED': 'REVERSED',
      };
      
      updateData.status = statusMap[status.toUpperCase()] || status;
      
      // Add verification timestamp if status is COMPLETED
      if (updateData.status === 'COMPLETED') {
        updateData.processedAt = new Date();
      }
    }
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    if (tokenName !== undefined) updateData.tokenName = tokenName;
    if (network !== undefined) updateData.network = network;
    if (transactionHash !== undefined) updateData.transactionHash = transactionHash;

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
      const newStatus = updateData.status || oldStatus;

      // Handle balance changes based on status transitions
      if (oldStatus !== newStatus) {
        // Case 1: Changing TO COMPLETED (from any other status) - Credit balance
        if (newStatus === 'COMPLETED' && oldStatus !== 'COMPLETED') {
          const updatedAccount = await tx.account.update({
            where: { id: existingDeposit.accountId! },
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
            where: { id: existingDeposit.accountId! },
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
      if (updateData.status === 'COMPLETED') {
        const deposit = result as any;
        const userEmail = deposit.user?.email;
        const userName = deposit.user?.name || '';
        if (userEmail) {
          await sendEmail({
            to: userEmail,
            subject: `Crypto deposit verified - ${deposit.currency} ${deposit.amount}`,
            html: `<div style="font-family: Arial, sans-serif; max-width:600px;margin:0 auto;">\
              <h2>Crypto Deposit Verified</h2>\
              <p>Hello ${userName || 'user'},</p>\
              <p>Your crypto deposit of <strong>${deposit.currency} ${deposit.amount}</strong> has been verified and credited to your account.</p>\
              <p>Token: ${deposit.tokenName || deposit.tokenSymbol || 'Cryptocurrency'}</p>\
              <p>Network: ${deposit.network || 'N/A'}</p>\
              <p>Transaction Hash: ${deposit.transactionHash || 'N/A'}</p>\
              <p>Reference: ${deposit.reference}</p>\
            </div>`,
          });
        }
      }
    } catch (emailErr) {
      console.error('Error sending crypto deposit email:', emailErr);
    }

    return NextResponse.json({ deposit: result });
  } catch (error: any) {
    console.error('[Crypto Deposit PATCH] Error updating crypto deposit:', error);
    console.error('[Crypto Deposit PATCH] Error stack:', error.stack);
    return NextResponse.json(
      { error: error.message || 'Failed to update crypto deposit' },
      { status: 500 }
    );
  }
}

// DELETE - Delete crypto deposit
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check if deposit exists
    const existingDeposit = await prisma.transaction.findUnique({
      where: {
        id,
        transactionType: 'DEPOSIT',
        channel: 'CRYPTO',
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
    console.error('Error deleting crypto deposit:', error);
    return NextResponse.json(
      { error: 'Failed to delete crypto deposit' },
      { status: 500 }
    );
  }
}
