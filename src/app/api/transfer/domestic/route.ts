import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { createActivityLog } from '@/app/api/activity-log/route';
import { getSettingValue } from '@/app/api/settings/route';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      accountId,
      amount,
      beneficiaryAccountName,
      beneficiaryAccountNumber,
      beneficiaryBank,
      narration,
      transactionPin,
      saveBeneficiary,
    } = body;

    // Validation
    if (!userId || !accountId || !amount || !beneficiaryAccountName || !beneficiaryAccountNumber || !beneficiaryBank || !transactionPin) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than zero' },
        { status: 400 }
      );
    }

    // Verify user exists and has transaction PIN
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if transfers are disabled for this user
    if (user.transferDisabled) {
      return NextResponse.json(
        { error: 'network error' },
        { status: 403 }
      );
    }

    if (!user.canTransfer) {
      return NextResponse.json(
        { error: 'Transfer privileges have been disabled for your account. Please contact support.' },
        { status: 403 }
      );
    }

    if (!user.transactionPin) {
      return NextResponse.json(
        { error: 'Please set up your transaction PIN first' },
        { status: 400 }
      );
    }

    // Verify transaction PIN
    const isPinValid = await bcrypt.compare(transactionPin, user.transactionPin);
    if (!isPinValid) {
      return NextResponse.json(
        { error: 'Invalid transaction PIN' },
        { status: 401 }
      );
    }

    // Get sender account
    const senderAccount = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!senderAccount) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    if (senderAccount.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized access to account' },
        { status: 403 }
      );
    }

    if (senderAccount.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Account is not active' },
        { status: 400 }
      );
    }

    // Check sufficient balance
    if (senderAccount.availableBalance < amount) {
      return NextResponse.json(
        { error: 'Insufficient balance' },
        { status: 400 }
      );
    }

    // Validate bank (check from database)
    const bankExists = await prisma.bank.findFirst({
      where: {
        AND: [
          { isActive: true },
          {
            OR: [
              { name: beneficiaryBank },
              { code: beneficiaryBank }
            ]
          }
        ]
      }
    });

    if (!bankExists) {
      return NextResponse.json(
        { error: 'Invalid bank selected' },
        { status: 400 }
      );
    }

    // Get domestic transfer fee from settings
    const feeFromSettings = await getSettingValue('domestic_transfer_fee');
    const fee = typeof feeFromSettings === 'number' ? feeFromSettings : 3; // Default to $3 if setting not found
    const totalAmount = amount + fee;

    if (senderAccount.availableBalance < totalAmount) {
      return NextResponse.json(
        { error: `Insufficient balance. Transfer amount: ${amount}, Fee: ${fee}, Total: ${totalAmount}` },
        { status: 400 }
      );
    }

    // Generate unique reference
    const reference = `DOM${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create transaction in database
    const result = await prisma.$transaction(async (tx: any) => {
      // Deduct from sender account (lock the funds)
      const updatedSenderAccount = await tx.account.update({
        where: { id: senderAccount.id },
        data: {
          availableBalance: { decrement: totalAmount },
        },
      });

      // Create PENDING transaction for sender
      const transaction = await tx.transaction.create({
        data: {
          userId: senderAccount.userId,
          accountId: senderAccount.id,
          transactionType: 'TRANSFER_OUT',
          amount: -amount,
          balanceAfter: senderAccount.balance - amount,
          currency: senderAccount.currency,
          description: narration || `Domestic transfer to ${beneficiaryAccountName} at ${bankExists.name}`,
          reference: reference,
          status: 'PENDING',
          recipientName: beneficiaryAccountName,
          recipientAccount: beneficiaryAccountNumber,
          senderName: senderAccount.accountName,
          senderAccount: senderAccount.accountNumber,
          fee: fee,
          metadata: {
            transferType: 'DOMESTIC',
            beneficiaryBank: bankExists.name,
            beneficiaryBankCode: bankExists.code,
            requiresApproval: true,
            narration: narration,
          },
        },
      });

      // Create notification for user
      await tx.notification.create({
        data: {
          userId: senderAccount.userId,
          type: 'TRANSACTION',
          title: 'Transfer Initiated',
          message: `Your domestic transfer of ${amount} ${senderAccount.currency} to ${beneficiaryAccountName} is pending approval`,
          link: '/dashboard/transfer/history',
        },
      });

      // Create notification for admin
      // Find admin users (assuming role is ADMIN)
      const admins = await tx.user.findMany({
        where: { role: 'ADMIN' },
      });

      for (const admin of admins) {
        await tx.notification.create({
          data: {
            userId: admin.id,
            type: 'TRANSACTION',
            title: 'New Transfer Pending Approval',
            message: `${senderAccount.accountName} initiated a domestic transfer of ${amount} ${senderAccount.currency}`,
            link: '/admin/transfers/pending',
          },
        });
      }

      // Save beneficiary if requested
      if (saveBeneficiary) {
        // Check if beneficiary already exists
        const existingBeneficiary = await tx.beneficiary.findFirst({
          where: {
            userId: userId,
            accountNumber: beneficiaryAccountNumber,
            bankName: bankExists.name,
          },
        });

        if (!existingBeneficiary) {
          await tx.beneficiary.create({
            data: {
              userId: userId,
              accountName: beneficiaryAccountName,
              accountNumber: beneficiaryAccountNumber,
              bankName: bankExists.name,
              bankCode: bankExists.code,
            },
          });
        }
      }

      return {
        transaction,
        availableBalance: updatedSenderAccount.availableBalance,
      };
    });

    // Create activity log
    try {
      await createActivityLog(
        userId,
        'TRANSACTION',
        `Initiated domestic transfer of ${amount} ${senderAccount.currency} to ${beneficiaryAccountName}`,
        request,
        {
          transactionType: 'DOMESTIC_TRANSFER',
          amount,
          reference,
          status: 'PENDING',
          beneficiaryBank: bankExists.name,
        }
      );
    } catch (logError) {
      console.error('Error creating activity log:', logError);
    }

    return NextResponse.json({
      message: 'Transfer initiated successfully and pending approval',
      reference,
      amount,
      fee,
      total: totalAmount,
      beneficiary: {
        name: beneficiaryAccountName,
        account: beneficiaryAccountNumber,
        bank: bankExists.name,
      },
      status: 'PENDING',
      availableBalance: result.availableBalance,
    });
  } catch (error) {
    console.error('Error processing domestic transfer:', error);
    return NextResponse.json(
      { error: 'Failed to process transfer' },
      { status: 500 }
    );
  }
}

// Get list of banks from database
export async function GET() {
  try {
    const banks = await prisma.bank.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ banks });
  } catch (error) {
    console.error('Error fetching banks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch banks' },
      { status: 500 }
    );
  }
}
