import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

// Generate unique reference
function generateReference(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `WD-${timestamp}-${random}`.toUpperCase();
}

// POST - Create withdrawal request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      amount,
      currency,
      method,
      beneficiaryName,
      beneficiaryEmail,
      beneficiaryPhone,
      bankName,
      bankAddress,
      accountNumber,
      swiftCode,
      iban,
      routingNumber,
      sortCode,
      beneficiaryAddress,
      city,
      state,
      zipCode,
      countryCode,
      cryptoToken,
      cryptoNetwork,
      cryptoAddress,
      description
    } = body;

    const withdrawalMethod: 'BANK' | 'CRYPTO' = method === 'CRYPTO' ? 'CRYPTO' : 'BANK';

    if (!userId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (withdrawalMethod === 'BANK') {
      // Validate required fields
      if (!beneficiaryName || !bankName || !accountNumber || !swiftCode) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }

      if (!beneficiaryAddress || !city || !zipCode || !countryCode) {
        return NextResponse.json(
          { error: 'Beneficiary address is incomplete' },
          { status: 400 }
        );
      }
    } else {
      if (!cryptoToken || !cryptoNetwork || !cryptoAddress) {
        return NextResponse.json(
          { error: 'Missing required crypto wallet details' },
          { status: 400 }
        );
      }
    }

    // Get user and account
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { accounts: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const account = user.accounts[0];
    if (!account) {
      return NextResponse.json(
        { error: 'No account found' },
        { status: 404 }
      );
    }

    // Check balance
    const withdrawalAmount = parseFloat(amount);
    if (account.balance < withdrawalAmount) {
      return NextResponse.json(
        { error: 'Insufficient balance' },
        { status: 400 }
      );
    }

    // Calculate fee (you can adjust this logic)
    const fee = withdrawalAmount * 0.01; // 1% fee
    const totalAmount = withdrawalAmount + fee;

    if (account.balance < totalAmount) {
      return NextResponse.json(
        { error: 'Insufficient balance to cover withdrawal and fees' },
        { status: 400 }
      );
    }

    // Generate unique reference
    const reference = generateReference();

    // Create withdrawal request
    const withdrawal = await prisma.withdrawal.create({
      data: {
        userId,
        accountId: account.id,
        amount: withdrawalAmount,
        currency: currency || account.currency,
        method: withdrawalMethod,
        ...(withdrawalMethod === 'BANK'
          ? {
              beneficiaryName,
              beneficiaryEmail,
              beneficiaryPhone,
              bankName,
              bankAddress,
              accountNumber,
              swiftCode,
              iban,
              routingNumber,
              sortCode,
              beneficiaryAddress,
              city,
              state,
              zipCode,
              countryCode,
            }
          : {
              cryptoToken,
              cryptoNetwork,
              cryptoAddress,
            }),
        description,
        fee,
        totalAmount,
        reference,
        status: 'PENDING'
      }
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId,
        title: 'Withdrawal Request Submitted',
        message: `Your withdrawal request of ${currency || account.currency} ${withdrawalAmount.toFixed(2)} has been submitted and is pending approval.`,
        type: 'TRANSACTION',
        isRead: false
      }
    });

    // Get admin users
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' }
    });

    // Send email to admins
    for (const admin of admins) {
      try {
        await sendEmail({
          to: admin.email,
          subject: 'New Withdrawal Request',
          html: `
            <h2>New Withdrawal Request</h2>
            <p>A new withdrawal request has been submitted:</p>
            <ul>
              <li><strong>User:</strong> ${user.name || user.email}</li>
              <li><strong>Method:</strong> ${withdrawalMethod === 'CRYPTO' ? 'Crypto' : 'Bank Transfer'}</li>
              <li><strong>Amount:</strong> ${currency || account.currency} ${withdrawalAmount.toFixed(2)}</li>
              <li><strong>Fee:</strong> ${currency || account.currency} ${fee.toFixed(2)}</li>
              <li><strong>Total:</strong> ${currency || account.currency} ${totalAmount.toFixed(2)}</li>
              ${withdrawalMethod === 'CRYPTO' ? `
              <li><strong>Token:</strong> ${cryptoToken}</li>
              <li><strong>Network:</strong> ${cryptoNetwork}</li>
              <li><strong>Address:</strong> ${cryptoAddress}</li>
              ` : `
              <li><strong>Beneficiary:</strong> ${beneficiaryName}</li>
              <li><strong>Bank:</strong> ${bankName}</li>
              <li><strong>Account:</strong> ${accountNumber}</li>
              <li><strong>SWIFT:</strong> ${swiftCode}</li>
              `}
              <li><strong>Reference:</strong> ${reference}</li>
            </ul>
            <p>Please review and process this request in the admin panel.</p>
          `
        });

        // Create notification for admin
        await prisma.notification.create({
          data: {
            userId: admin.id,
            title: 'New Withdrawal Request',
            message: `${user.name || user.email} has requested a withdrawal of ${currency || account.currency} ${withdrawalAmount.toFixed(2)}`,
            type: 'SYSTEM',
            isRead: false
          }
        });
      } catch (emailError) {
        console.error('Error sending admin notification:', emailError);
      }
    }

    // Send confirmation email to user
    try {
      await sendEmail({
        to: user.email,
        subject: 'Withdrawal Request Received',
        html: `
          <h2>Withdrawal Request Received</h2>
          <p>Dear ${user.name || 'Customer'},</p>
          <p>We have received your withdrawal request with the following details:</p>
          <ul>
            <li><strong>Amount:</strong> ${currency || account.currency} ${withdrawalAmount.toFixed(2)}</li>
            <li><strong>Fee:</strong> ${currency || account.currency} ${fee.toFixed(2)}</li>
            <li><strong>Total:</strong> ${currency || account.currency} ${totalAmount.toFixed(2)}</li>
            ${withdrawalMethod === 'CRYPTO' ? `
            <li><strong>Token:</strong> ${cryptoToken}</li>
            <li><strong>Network:</strong> ${cryptoNetwork}</li>
            <li><strong>Address:</strong> ${cryptoAddress}</li>
            ` : `
            <li><strong>Beneficiary:</strong> ${beneficiaryName}</li>
            <li><strong>Bank:</strong> ${bankName}</li>
            `}
            <li><strong>Reference:</strong> ${reference}</li>
          </ul>
          <p>Your request is currently pending approval. We will notify you once it has been processed.</p>
          <p>Processing time is typically 1-3 business days.</p>
          <p>Thank you for banking with us!</p>
        `
      });
    } catch (emailError) {
      console.error('Error sending user confirmation:', emailError);
    }

    return NextResponse.json({
      success: true,
      withdrawal,
      message: 'Withdrawal request submitted successfully'
    });

  } catch (error) {
    console.error('Error creating withdrawal request:', error);
    return NextResponse.json(
      { error: 'Failed to create withdrawal request' },
      { status: 500 }
    );
  }
}

// GET - Get withdrawal requests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    const withdrawals = await prisma.withdrawal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      withdrawals
    });

  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch withdrawals' },
      { status: 500 }
    );
  }
}
