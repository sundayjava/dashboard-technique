import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { createActivityLog } from '@/app/api/activity-log/route';
import { convertCurrency, getExchangeRate } from '@/lib/currency-converter';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      senderId, 
      senderAccountId,
      recipientAccountNumber, 
      amount, 
      transactionPin,
      description 
    } = body;

    // Validate required fields
    if (!senderId || !senderAccountId || !recipientAccountNumber || !amount || !transactionPin) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate amount
    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than zero' },
        { status: 400 }
      );
    }

    // Get sender user and verify PIN
    const sender = await prisma.user.findUnique({
      where: { id: senderId },
    });

    if (!sender) {
      return NextResponse.json(
        { error: 'Sender not found' },
        { status: 404 }
      );
    }

    // Verify transaction PIN
    const isPinValid = await bcrypt.compare(transactionPin, sender.transactionPin);
    if (!isPinValid) {
      return NextResponse.json(
        { error: 'Invalid transaction PIN' },
        { status: 401 }
      );
    }

    // Check if transfers are disabled for this user
    if (sender.transferDisabled) {
      return NextResponse.json(
        { error: 'Transfers have been disabled for your account. Please contact support.' },
        { status: 403 }
      );
    }

    // Get sender account
    const senderAccount = await prisma.account.findUnique({
      where: { id: senderAccountId },
      include: { user: true },
    });

    if (!senderAccount) {
      return NextResponse.json(
        { error: 'Sender account not found' },
        { status: 404 }
      );
    }

    // Verify sender owns the account
    if (senderAccount.userId !== senderId) {
      return NextResponse.json(
        { error: 'Unauthorized access to account' },
        { status: 403 }
      );
    }

    // Check if sender account is active
    if (senderAccount.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Your account is not active' },
        { status: 400 }
      );
    }

    // Check sufficient balance
    if (senderAccount.availableBalance < amount) {
      return NextResponse.json(
        { error: 'Insufficient funds' },
        { status: 400 }
      );
    }

    // Get recipient account
    const recipientAccount = await prisma.account.findUnique({
      where: { accountNumber: recipientAccountNumber },
      include: { user: true },
    });

    if (!recipientAccount) {
      return NextResponse.json(
        { error: 'Recipient account not found' },
        { status: 404 }
      );
    }

    // Check if recipient account is active
    if (recipientAccount.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Recipient account is not active' },
        { status: 400 }
      );
    }

    // Prevent self-transfer
    if (senderAccount.id === recipientAccount.id) {
      return NextResponse.json(
        { error: 'Cannot transfer to the same account' },
        { status: 400 }
      );
    }

    // Calculate converted amount if currencies are different
    let recipientAmount = amount;
    let exchangeRate = 1;
    
    if (senderAccount.currency !== recipientAccount.currency) {
      try {
        exchangeRate = getExchangeRate(senderAccount.currency, recipientAccount.currency);
        recipientAmount = convertCurrency(amount, senderAccount.currency, recipientAccount.currency);
      } catch (error) {
        return NextResponse.json(
          { error: 'Currency conversion failed. Please try again.' },
          { status: 400 }
        );
      }
    }

    // Generate unique reference
    const reference = `TRF${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Perform transfer in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // Deduct from sender
      const updatedSenderAccount = await tx.account.update({
        where: { id: senderAccount.id },
        data: {
          balance: { decrement: amount },
          availableBalance: { decrement: amount },
        },
      });

      // Add to recipient
      const updatedRecipientAccount = await tx.account.update({
        where: { id: recipientAccount.id },
        data: {
          balance: { increment: recipientAmount },
          availableBalance: { increment: recipientAmount },
        },
      });

      // Create sender transaction (TRANSFER_OUT)
      const senderTransaction = await tx.transaction.create({
        data: {
          userId: senderAccount.userId,
          accountId: senderAccount.id,
          transactionType: 'TRANSFER_OUT',
          amount: -amount, // Negative for debit
          balanceAfter: updatedSenderAccount.balance,
          currency: senderAccount.currency,
          description: description || `Transfer to ${recipientAccount.accountName}`,
          reference: reference,
          status: 'COMPLETED',
          recipientName: recipientAccount.accountName,
          recipientAccount: recipientAccount.accountNumber,
          senderName: senderAccount.accountName,
          senderAccount: senderAccount.accountNumber,
          fee: 0, // No fee for internal transfers
          metadata: {
            transferType: 'ACREDIS_TO_ACREDIS',
            recipientUserId: recipientAccount.userId,
            exchangeRate: exchangeRate,
            recipientAmount: recipientAmount,
            recipientCurrency: recipientAccount.currency,
          },
        },
      });

      // Create recipient transaction (TRANSFER_IN)
      const recipientTransaction = await tx.transaction.create({
        data: {
          userId: recipientAccount.userId,
          accountId: recipientAccount.id,
          transactionType: 'TRANSFER_IN',
          amount: recipientAmount, // Positive for credit (converted amount)
          balanceAfter: updatedRecipientAccount.balance,
          currency: recipientAccount.currency,
          description: description || `Transfer from ${senderAccount.accountName}`,
          reference: reference,
          status: 'COMPLETED',
          recipientName: recipientAccount.accountName,
          recipientAccount: recipientAccount.accountNumber,
          senderName: senderAccount.accountName,
          senderAccount: senderAccount.accountNumber,
          fee: 0,
          metadata: {
            transferType: 'ACREDIS_TO_ACREDIS',
            senderUserId: senderAccount.userId,
            exchangeRate: exchangeRate,
            senderAmount: amount,
            senderCurrency: senderAccount.currency,
          },
        },
      });

      // Create notification for sender
      await tx.notification.create({
        data: {
          userId: senderAccount.userId,
          type: 'TRANSACTION',
          title: 'Transfer Successful',
          message: `You have successfully sent ${amount} ${senderAccount.currency} to ${recipientAccount.accountName}`,
          link: '/dashboard/account/statement',
        },
      });

      // Create notification for recipient
      await tx.notification.create({
        data: {
          userId: recipientAccount.userId,
          type: 'TRANSACTION',
          title: 'Money Received',
          message: `You received ${amount} ${recipientAccount.currency} from ${senderAccount.accountName}`,
          link: '/dashboard/account/statement',
        },
      });

      return {
        senderTransaction,
        recipientTransaction,
        senderBalance: updatedSenderAccount.balance,
        recipientBalance: updatedRecipientAccount.balance,
      };
    });

    // Create activity log (outside transaction to avoid blocking)
    try {
      await createActivityLog(
        senderId,
        'TRANSACTION',
        `Transferred ${amount} ${senderAccount.currency} to ${recipientAccount.accountName}`,
        request,
        {
          transactionType: 'TRANSFER_OUT',
          amount,
          reference,
          recipientAccount: recipientAccount.accountNumber,
        }
      );
    } catch (logError) {
      console.error('Error creating activity log:', logError);
      // Don't fail the transfer if logging fails
    }

    return NextResponse.json({
      message: 'Transfer successful',
      reference,
      amount,
      currency: senderAccount.currency,
      recipient: {
        name: recipientAccount.accountName,
        accountNumber: recipientAccount.accountNumber,
      },
      sender: {
        name: senderAccount.accountName,
        accountNumber: senderAccount.accountNumber,
        newBalance: result.senderBalance,
      },
    });
  } catch (error) {
    console.error('Error processing transfer:', error);
    return NextResponse.json(
      { error: 'Failed to process transfer' },
      { status: 500 }
    );
  }
}
