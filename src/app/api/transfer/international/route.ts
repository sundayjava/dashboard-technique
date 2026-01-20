import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getSettingValue } from '@/app/api/settings/route';
import { createActivityLog } from '@/app/api/activity-log/route';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      accountId,
      amount,
      currency,
      pin,
      otp,
      // Beneficiary details
      beneficiaryName,
      beneficiaryEmail,
      beneficiaryPhone,
      beneficiaryAddress,
      beneficiaryCity,
      beneficiaryState,
      beneficiaryCountry,
      beneficiaryPostalCode,
      // Bank details
      bankName,
      bankAddress,
      bankCity,
      bankCountry,
      accountNumber,
      iban,
      swiftCode,
      routingNumber,
      sortCode,
      // Transfer details
      purpose,
      narration,
    } = body;

    // Validation
    if (!userId || !accountId || !amount || !currency || !pin || !otp) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!beneficiaryName || !beneficiaryAddress || !beneficiaryCountry) {
      return NextResponse.json(
        { error: 'Beneficiary details are incomplete' },
        { status: 400 }
      );
    }

    if (!bankName || !bankAddress || !bankCountry || !accountNumber || !swiftCode) {
      return NextResponse.json(
        { error: 'Bank details are incomplete. SWIFT code is required for international transfers.' },
        { status: 400 }
      );
    }

    if (!purpose) {
      return NextResponse.json(
        { error: 'Transfer purpose is required' },
        { status: 400 }
      );
    }

    // Get user with admin control checks
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        transactionPin: true,
        canTransfer: true,
        transferDisabled: true,
        accountDisabled: true,
        isVerified: true,
        requireOTPForInternational: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Admin control checks
    if (user.accountDisabled) {
      return NextResponse.json(
        { error: 'Your account has been disabled. Please contact support.' },
        { status: 403 }
      );
    }

    if (user.transferDisabled) {
      return NextResponse.json(
        { error: 'Transfers have been disabled for your account. Please contact support.' },
        { status: 403 }
      );
    }

    if (!user.canTransfer) {
      return NextResponse.json(
        { error: 'Transfer privileges have been disabled for your account. Please contact support.' },
        { status: 403 }
      );
    }

    if (!user.isVerified) {
      return NextResponse.json(
        { error: 'Your account must be verified before you can make international transfers. Please contact support.' },
        { status: 403 }
      );
    }

    // Verify PIN
    const isPinValid = await bcrypt.compare(pin, user.transactionPin);
    if (!isPinValid) {
      // Log failed PIN attempt
      await createActivityLog(userId, 'FAILED_PIN', 'International transfer failed - incorrect PIN');
      return NextResponse.json(
        { error: 'Incorrect transaction PIN' },
        { status: 401 }
      );
    }

    // Verify OTP only if required by admin
    if (user.requireOTPForInternational) {
      if (!otp) {
        return NextResponse.json(
          { error: 'OTP is required for your account. Please generate and enter OTP.' },
          { status: 400 }
        );
      }

      const otpRecord = await prisma.transferOTP.findFirst({
        where: {
          userId,
          otp,
          type: 'international_transfer',
          verified: true,
          expiresAt: {
            gte: new Date(),
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!otpRecord) {
        return NextResponse.json(
          { error: 'Invalid or expired OTP. Please generate a new one.' },
          { status: 400 }
        );
      }

      // Invalidate the OTP by updating verified timestamp
      await prisma.transferOTP.update({
        where: { id: otpRecord.id },
        data: { updatedAt: new Date() },
      });
    }

    // Check if OTP was used recently (within last 30 seconds to prevent double submission)
    const recentOtpUse = await prisma.internationalTransfer.findFirst({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 1000),
        },
      },
    });

    if (recentOtpUse) {
      return NextResponse.json(
        { error: 'Please wait before submitting another transfer' },
        { status: 429 }
      );
    }

    // Get account
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        userId: userId,
        status: 'ACTIVE',
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found or inactive' },
        { status: 404 }
      );
    }

    // Get transfer fee from settings
    const feeFromSettings = await getSettingValue('international_transfer_fee');
    const fee = typeof feeFromSettings === 'number' ? feeFromSettings : 25;

    const totalAmount = amount + fee;

    // Check balance
    if (account.availableBalance < totalAmount) {
      return NextResponse.json(
        { error: `Insufficient balance. You need $${totalAmount.toFixed(2)} (including $${fee.toFixed(2)} fee)` },
        { status: 400 }
      );
    }

    // Generate reference
    const reference = `INT${Date.now()}${Math.floor(Math.random() * 10000)}`;

    // Create transaction and international transfer in a transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          accountId: account.id,
          transactionType: 'TRANSFER_OUT',
          amount: -amount,
          fee,
          currency,
          status: 'PENDING',
          reference,
          description: `International transfer to ${beneficiaryName} - ${bankName}, ${bankCountry}`,
          balanceAfter: account.balance, // Balance unchanged until approved
        },
      });

      // Create international transfer record
      const internationalTransfer = await tx.internationalTransfer.create({
        data: {
          userId: user.id,
          transactionId: transaction.id,
          senderAccountId: account.id,
          amount,
          currency,
          fee,
          // Beneficiary details
          beneficiaryName,
          beneficiaryEmail,
          beneficiaryPhone,
          beneficiaryAddress,
          beneficiaryCity,
          beneficiaryState,
          beneficiaryCountry,
          beneficiaryPostalCode,
          // Bank details
          bankName,
          bankAddress,
          bankCity,
          bankCountry,
          accountNumber,
          iban,
          swiftCode,
          routingNumber,
          sortCode,
          // Transfer details
          purpose,
          narration,
          status: 'PENDING',
        },
      });

      // Lock funds by reducing available balance
      await tx.account.update({
        where: { id: account.id },
        data: {
          availableBalance: account.availableBalance - totalAmount,
        },
      });

      return { transaction, internationalTransfer };
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'TRANSACTION',
        title: 'International Transfer Pending',
        message: `Your international transfer of ${currency} ${amount.toFixed(2)} to ${beneficiaryName} is pending admin approval.`,
        link: '/dashboard/transactions',
      },
    });

    // Notify all admins
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, name: true },
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: 'TRANSACTION',
          title: 'New International Transfer Pending',
          message: `${user.name || user.email} initiated an international transfer of ${currency} ${amount.toFixed(2)} to ${beneficiaryCountry}. Reference: ${reference}`,
          link: '/admin/transfers/international/pending',
        },
      });
    }

    // Log activity
    await createActivityLog(
      userId,
      'INTERNATIONAL_TRANSFER_INITIATED',
      `Initiated international transfer of ${currency} ${amount.toFixed(2)} to ${beneficiaryName} in ${beneficiaryCountry}`
    );

    return NextResponse.json({
      success: true,
      message: 'International transfer initiated successfully. Awaiting admin approval.',
      reference,
      transaction: result.transaction,
      transfer: result.internationalTransfer,
    });
  } catch (error: any) {
    console.error('Error processing international transfer:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process transfer. Please try again.' },
      { status: 500 }
    );
  }
}
