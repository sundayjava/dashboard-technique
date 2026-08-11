import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

// PUT - Update withdrawal (approve/reject)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, adminNotes, rejectionReason } = body;

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            accounts: true
          }
        }
      }
    });

    if (!withdrawal) {
      return NextResponse.json(
        { error: 'Withdrawal not found' },
        { status: 404 }
      );
    }

    if (withdrawal.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Withdrawal has already been processed' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      // Check if user has sufficient balance
      const account = withdrawal.user.accounts[0];
      if (!account || account.balance < withdrawal.totalAmount) {
        return NextResponse.json(
          { error: 'Insufficient balance' },
          { status: 400 }
        );
      }

      // Start transaction
      const [updatedWithdrawal, updatedAccount, transaction] = await prisma.$transaction([
        // Update withdrawal status
        prisma.withdrawal.update({
          where: { id },
          data: {
            status: 'APPROVED',
            adminNotes,
            processedAt: new Date()
          }
        }),

        // Deduct from user account
        prisma.account.update({
          where: { id: account.id },
          data: {
            balance: { decrement: withdrawal.totalAmount },
            availableBalance: { decrement: withdrawal.totalAmount }
          }
        }),

        // Create transaction record
        prisma.transaction.create({
          data: {
            userId: withdrawal.userId,
            accountId: account.id,
            transactionType: 'WITHDRAWAL',
            amount: withdrawal.amount,
            balanceAfter: account.balance - withdrawal.totalAmount,
            currency: withdrawal.currency,
            description: withdrawal.method === 'CRYPTO'
              ? `Crypto Withdrawal (${withdrawal.cryptoToken}) to ${withdrawal.cryptoAddress}`
              : `International Wire Transfer to ${withdrawal.beneficiaryName}`,
            reference: withdrawal.reference,
            status: 'COMPLETED',
            channel: withdrawal.method === 'CRYPTO' ? 'CRYPTO' : 'BANK',
            fee: withdrawal.fee,
            processedAt: new Date(),
            ...(withdrawal.method === 'CRYPTO'
              ? {
                  tokenName: withdrawal.cryptoToken,
                  tokenSymbol: withdrawal.cryptoToken,
                  network: withdrawal.cryptoNetwork,
                  walletAddress: withdrawal.cryptoAddress,
                }
              : {
                  recipientName: withdrawal.beneficiaryName,
                  recipientAccount: withdrawal.accountNumber,
                  bankName: withdrawal.bankName,
                  swiftCode: withdrawal.swiftCode,
                  iban: withdrawal.iban,
                  routingNumber: withdrawal.routingNumber,
                }),
          }
        })
      ]);

      // Create notification for user
      await prisma.notification.create({
        data: {
          userId: withdrawal.userId,
          title: 'Withdrawal Approved',
          message: `Your withdrawal request of ${withdrawal.currency} ${withdrawal.amount.toFixed(2)} has been approved and processed.`,
          type: 'TRANSACTION',
          isRead: false
        }
      });

      // Send email to user
      try {
        await sendEmail({
          to: withdrawal.user.email,
          subject: 'Withdrawal Approved',
          html: `
            <h2>Withdrawal Approved</h2>
            <p>Dear ${withdrawal.user.name || 'Customer'},</p>
            <p>Your withdrawal request has been approved and processed:</p>
            <ul>
              <li><strong>Amount:</strong> ${withdrawal.currency} ${withdrawal.amount.toFixed(2)}</li>
              <li><strong>Fee:</strong> ${withdrawal.currency} ${withdrawal.fee.toFixed(2)}</li>
              <li><strong>Total Debited:</strong> ${withdrawal.currency} ${withdrawal.totalAmount.toFixed(2)}</li>
              ${withdrawal.method === 'CRYPTO' ? `
              <li><strong>Token:</strong> ${withdrawal.cryptoToken}</li>
              <li><strong>Network:</strong> ${withdrawal.cryptoNetwork}</li>
              <li><strong>Address:</strong> ${withdrawal.cryptoAddress}</li>
              ` : `
              <li><strong>Beneficiary:</strong> ${withdrawal.beneficiaryName}</li>
              `}
              <li><strong>Reference:</strong> ${withdrawal.reference}</li>
            </ul>
            <p>${withdrawal.method === 'CRYPTO'
              ? 'The funds will be sent to the provided wallet address shortly.'
              : "The funds will be transferred to the beneficiary's account within 1-3 business days."}</p>
            ${adminNotes ? `<p><strong>Admin Notes:</strong> ${adminNotes}</p>` : ''}
            <p>Thank you for banking with us!</p>
          `
        });
      } catch (emailError) {
        console.error('Error sending approval email:', emailError);
      }

      return NextResponse.json({
        success: true,
        withdrawal: updatedWithdrawal,
        message: 'Withdrawal approved successfully'
      });

    } else if (action === 'reject') {
      if (!rejectionReason) {
        return NextResponse.json(
          { error: 'Rejection reason is required' },
          { status: 400 }
        );
      }

      // Update withdrawal status
      const updatedWithdrawal = await prisma.withdrawal.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason,
          adminNotes,
          processedAt: new Date()
        }
      });

      // Create notification for user
      await prisma.notification.create({
        data: {
          userId: withdrawal.userId,
          title: 'Withdrawal Rejected',
          message: `Your withdrawal request of ${withdrawal.currency} ${withdrawal.amount.toFixed(2)} has been rejected. Reason: ${rejectionReason}`,
          type: 'TRANSACTION',
          isRead: false
        }
      });

      // Send email to user
      try {
        await sendEmail({
          to: withdrawal.user.email,
          subject: 'Withdrawal Request Rejected',
          html: `
            <h2>Withdrawal Request Rejected</h2>
            <p>Dear ${withdrawal.user.name || 'Customer'},</p>
            <p>We regret to inform you that your withdrawal request has been rejected:</p>
            <ul>
              <li><strong>Amount:</strong> ${withdrawal.currency} ${withdrawal.amount.toFixed(2)}</li>
              <li><strong>Reference:</strong> ${withdrawal.reference}</li>
              <li><strong>Reason:</strong> ${rejectionReason}</li>
            </ul>
            ${adminNotes ? `<p><strong>Admin Notes:</strong> ${adminNotes}</p>` : ''}
            <p>If you have any questions, please contact our support team.</p>
          `
        });
      } catch (emailError) {
        console.error('Error sending rejection email:', emailError);
      }

      return NextResponse.json({
        success: true,
        withdrawal: updatedWithdrawal,
        message: 'Withdrawal rejected successfully'
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error updating withdrawal:', error);
    return NextResponse.json(
      { error: 'Failed to update withdrawal' },
      { status: 500 }
    );
  }
}

// DELETE - Delete withdrawal
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id }
    });

    if (!withdrawal) {
      return NextResponse.json(
        { error: 'Withdrawal not found' },
        { status: 404 }
      );
    }

    // Delete the withdrawal
    await prisma.withdrawal.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'Withdrawal deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting withdrawal:', error);
    return NextResponse.json(
      { error: 'Failed to delete withdrawal' },
      { status: 500 }
    );
  }
}
