import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, adminNotes } = body;

    // Get existing transaction with account details
    const existingTransaction = await prisma.transaction.findUnique({
      where: { id },
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

    if (!existingTransaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const existingMetadata = existingTransaction.metadata as Record<string, any> | null;
    const oldStatus = existingTransaction.status;
    
    // Map status values to valid TransactionStatus enum values
    const statusMap: Record<string, string> = {
      'REJECTED': 'FAILED',
      'APPROVED': 'COMPLETED',
      'VERIFIED': 'COMPLETED',
    };
  
    const newStatus = statusMap[status] || status;

    // Use transaction to handle balance updates
    const result = await prisma.$transaction(async (tx) => {
      let updatedAccount = existingTransaction.account;
      
      // Handle balance updates for status changes
      if (oldStatus !== newStatus && existingTransaction.account) {
        const transactionAmount = Math.abs(existingTransaction.amount);
        const totalAmount = transactionAmount + (existingTransaction.fee || 0);
        
        // For TRANSFER_OUT: Approve or Reject (includes domestic and international transfers)
        if (existingTransaction.transactionType === 'TRANSFER_OUT') {
          if (newStatus === 'COMPLETED' && oldStatus === 'PENDING') {
            // Approve: Balance was already deducted when transfer was created, no action needed
            const account = await tx.account.findUnique({
              where: { id: existingTransaction.accountId! },
            });
            if (!account) {
              throw new Error('Account not found');
            }
            updatedAccount = account;
          } else if ((newStatus === 'FAILED' || newStatus === 'CANCELLED') && oldStatus === 'PENDING') {
            // Reject/Cancel: Refund the amount back to balance
            updatedAccount = await tx.account.update({
              where: { id: existingTransaction.accountId! },
              data: {
                balance: { increment: totalAmount },
              },
            });
          }
        }
        
        // For TRANSFER_IN: Credit when approved
        if (existingTransaction.transactionType === 'TRANSFER_IN') {
          if (newStatus === 'COMPLETED' && oldStatus === 'PENDING') {
            // Credit recipient account
            updatedAccount = await tx.account.update({
              where: { id: existingTransaction.accountId! },
              data: {
                balance: { increment: transactionAmount },
                availableBalance: { increment: transactionAmount },
              },
            });
          }
        }
      }

      // Update transaction with correct balanceAfter
      const transaction = await tx.transaction.update({
        where: { id },
        data: {
          status: newStatus,
          processedAt: newStatus === 'COMPLETED' ? new Date() : existingTransaction.processedAt,
          balanceAfter: updatedAccount ? updatedAccount.balance : existingTransaction.balanceAfter,
          metadata: adminNotes 
            ? {
                ...(existingMetadata || {}),
                adminNotes,
              }
            : existingMetadata || undefined,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          account: true,
        },
      });

      return transaction;
    });

    return NextResponse.json({ transaction: result });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.transaction.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}
