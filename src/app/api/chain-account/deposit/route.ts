import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyChainAccountToken } from '@/lib/chain-account-session';
import { convertCurrency } from '@/lib/currency-converter';
import { sendEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    // Verify Chain Account session token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const session = verifyChainAccountToken(token);

    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    const { chainAccountId, amount, depositMethod, currency, transactionHash } = await request.json();

    // Validate input
    if (!chainAccountId || !amount || !depositMethod) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Verify user has access to this Chain Account
    if (session.chainAccountId !== chainAccountId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Verify Chain Account is active
    const chainAccount = await prisma.chainAccount.findUnique({
      where: { id: chainAccountId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              }
            }
          }
        }
      }
    });

    if (!chainAccount || chainAccount.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Chain Account not active' },
        { status: 400 }
      );
    }

    // Get the member ID for this user
    const member = chainAccount.members.find(m => m.userId === session.userId);
    if (!member) {
      return NextResponse.json(
        { error: 'You are not a member of this Chain Account' },
        { status: 403 }
      );
    }

    // Handle WALLET deposit (instant, no approval needed)
    if (depositMethod === 'WALLET') {
      return await handleWalletDeposit({
        session,
        chainAccount,
        member,
        amount,
        currency: currency || 'USD',
      });
    }

    // Handle CRYPTO deposit (requires admin approval)
    if (depositMethod === 'CRYPTO') {
      return await handleCryptoDeposit({
        session,
        chainAccount,
        member,
        amount,
        transactionHash,
      });
    }

    return NextResponse.json(
      { error: 'Invalid deposit method' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('Deposit error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle Wallet Deposit (Instant)
async function handleWalletDeposit(params: any) {
  const { session, chainAccount, member, amount, currency } = params;

  try {
    // 1. Get user's account
    const userAccount = await prisma.account.findFirst({
      where: { userId: session.userId },
    });

    if (!userAccount) {
      return NextResponse.json(
        { error: 'User account not found' },
        { status: 404 }
      );
    }

    // 2. Check if user has sufficient balance
    if (userAccount.balance < amount) {
      return NextResponse.json(
        { error: 'Insufficient wallet balance' },
        { status: 400 }
      );
    }

    // 3. Convert currency to USDT (Chain Accounts operate in USDT)
    const amountInUSDT = await convertCurrency(amount, currency, 'USDT');

    // Generate deposit reference
    const depositReference = `DEP-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    // 4. Use transaction to ensure atomic operation
    const result = await prisma.$transaction(async (tx) => {
      // Deduct from user's wallet
      await tx.account.update({
        where: { id: userAccount.id },
        data: { balance: { decrement: amount } },
      });

      // Add to Chain Account balance
      const updatedChainAccount = await tx.chainAccount.update({
        where: { id: chainAccount.id },
        data: {
          balance: { increment: amountInUSDT },
          lastActivityAt: new Date(),
        },
      });

      // Create deposit record
      const deposit = await tx.chainAccountDeposit.create({
        data: {
          chainAccountId: chainAccount.id,
          initiatedBy: member.id,
          userId: session.userId,
          amount: amountInUSDT,
          currency: 'USDT',
          method: 'WALLET',
          reference: depositReference,
          status: 'CONFIRMED', // Wallet deposits are instant
          deductedFromWallet: true,
          processedAt: new Date(),
        },
      });

      // Create transaction record
      await tx.chainAccountTransaction.create({
        data: {
          chainAccountId: chainAccount.id,
          transactionType: 'DEPOSIT',
          amount: amountInUSDT,
          currency: 'USDT',
          balanceBefore: chainAccount.balance,
          balanceAfter: updatedChainAccount.balance,
          description: `Wallet deposit - ${depositReference}${currency !== 'USDT' ? ` (${currency} ${amount} converted to USDT ${amountInUSDT.toFixed(2)})` : ''}`,
          relatedUserId: session.userId,
          relatedDepositId: deposit.id,
          reference: depositReference,
        },
      });

      // Record in admin transactions table
      await tx.transaction.create({
        data: {
          userId: session.userId,
          transactionType: 'DEPOSIT',
          amount: amount,
          currency: currency,
          status: 'COMPLETED',
          reference: depositReference,
          description: `Chain Account deposit to ${chainAccount.accountName} (${chainAccount.accountNumber})`,
          balanceAfter: userAccount.balance - amount,
        },
      });

      return deposit;
    });

    // 5. Send email notifications to all members
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const depositorName = member.user.name || member.user.email;

    for (const m of chainAccount.members) {
      await sendDepositNotificationEmail({
        to: m.user.email,
        recipientName: m.user.name || m.user.email,
        depositorName,
        accountName: chainAccount.accountName,
        accountNumber: chainAccount.accountNumber,
        amount: amountInUSDT,
        originalAmount: amount,
        originalCurrency: currency,
        reference: depositReference,
        newBalance: chainAccount.balance + amountInUSDT,
        baseUrl,
      });

      // Create in-app notification
      await prisma.chainAccountNotification.create({
        data: {
          chainAccountId: chainAccount.id,
          userId: m.userId,
          type: 'GENERAL',
          title: 'Deposit Confirmed',
          message: `${depositorName} deposited ${currency} ${amount.toLocaleString()} (USDT ${amountInUSDT.toFixed(2)}) to ${chainAccount.accountName}. New balance: USDT ${(chainAccount.balance + amountInUSDT).toFixed(2)}`,
          isRead: false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      deposit: {
        id: result.id,
        reference: depositReference,
        amount: amountInUSDT,
        originalAmount: amount,
        originalCurrency: currency,
        currency: 'USDT',
        method: 'WALLET',
        status: 'CONFIRMED',
        newBalance: chainAccount.balance + amountInUSDT,
      },
    });

  } catch (error: any) {
    console.error('Wallet deposit error:', error);
    throw error;
  }
}

// Handle Crypto Deposit (Requires Admin Approval)
async function handleCryptoDeposit(params: any) {
  const { session, chainAccount, member, amount, transactionHash } = params;

  try {
    // 1. Check if Chain Account has assigned deposit address
    if (!chainAccount.cryptoDepositAddress) {
      return NextResponse.json(
        { error: 'No crypto deposit address assigned to this Chain Account. Please contact support.' },
        { status: 400 }
      );
    }

    // 2. Validate transaction hash is provided
    if (!transactionHash || transactionHash.trim().length === 0) {
      return NextResponse.json(
        { error: 'Transaction hash is required for crypto deposits' },
        { status: 400 }
      );
    }

    // 3. Check if transaction hash already exists
    const existingDeposit = await prisma.chainAccountDeposit.findFirst({
      where: { transactionHash },
    });

    if (existingDeposit) {
      return NextResponse.json(
        { error: 'This transaction hash has already been submitted' },
        { status: 400 }
      );
    }

    // Generate deposit reference
    const depositReference = `DEP-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    // 4. Create deposit record (PENDING admin approval)
    const deposit = await prisma.chainAccountDeposit.create({
      data: {
        chainAccountId: chainAccount.id,
        initiatedBy: member.id,
        userId: session.userId,
        amount,
        currency: 'USDT',
        method: 'CRYPTO',
        reference: depositReference,
        status: 'PENDING',
        transactionHash,
        cryptoNetwork: chainAccount.cryptoNetwork || 'TRC20',
        cryptoToken: chainAccount.cryptoToken || 'USDT',
      },
    });

    // 5. Create transaction record (pending)
    await prisma.chainAccountTransaction.create({
      data: {
        chainAccountId: chainAccount.id,
        transactionType: 'DEPOSIT',
        amount,
        currency: 'USDT',
        balanceBefore: chainAccount.balance,
        balanceAfter: chainAccount.balance, // Will be updated on approval
        description: `Crypto deposit (PENDING) - ${depositReference}`,
        relatedUserId: session.userId,
        relatedDepositId: deposit.id,
        reference: depositReference,
      },
    });

    // 6. Notify all members
    const depositorName = member.user.name || member.user.email;
    for (const m of chainAccount.members) {
      await prisma.chainAccountNotification.create({
        data: {
          chainAccountId: chainAccount.id,
          userId: m.userId,
          type: 'GENERAL',
          title: 'Crypto Deposit Submitted',
          message: `${depositorName} submitted a crypto deposit of USDT ${amount.toLocaleString()} (TxHash: ${transactionHash.substring(0, 10)}...). Awaiting admin verification.`,
          isRead: false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      deposit: {
        id: deposit.id,
        reference: depositReference,
        amount,
        currency: 'USDT',
        method: 'CRYPTO',
        status: 'PENDING',
        transactionHash,
        depositAddress: chainAccount.cryptoDepositAddress,
        network: chainAccount.cryptoNetwork,
        message: 'Your crypto deposit has been submitted and is awaiting admin verification',
      },
    });

  } catch (error: any) {
    console.error('Crypto deposit error:', error);
    throw error;
  }
}

// Email notification helper
async function sendDepositNotificationEmail(params: {
  to: string;
  recipientName: string;
  depositorName: string;
  accountName: string;
  accountNumber: string;
  amount: number;
  originalAmount: number;
  originalCurrency: string;
  reference: string;
  newBalance: number;
  baseUrl: string;
}) {
  const {
    to,
    recipientName,
    depositorName,
    accountName,
    accountNumber,
    amount,
    originalAmount,
    originalCurrency,
    reference,
    newBalance,
    baseUrl
  } = params;

  const conversionNote = originalCurrency !== 'USDT'
    ? `<p style="font-size: 12px; color: #6b7280; margin-top: 10px;">Original deposit: ${originalCurrency} ${originalAmount.toLocaleString()} (converted to USDT ${amount.toFixed(2)})</p>`
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Chain Account Deposit</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">💰 Deposit Confirmed</h1>
        <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0;">Chain Account Deposit Notification</p>
      </div>

      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <h2 style="color: #333; margin-top: 0;">Hi ${recipientName},</h2>

        <p><strong>${depositorName}</strong> has deposited funds into your Chain Account.</p>

        <div style="background: #f0fdf4; padding: 20px; border-left: 4px solid #10b981; margin: 20px 0; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #059669;">Deposit Details</h3>
          <table style="width: 100%; font-size: 14px; line-height: 2;">
            <tr>
              <td style="color: #6b7280;">Chain Account:</td>
              <td style="text-align: right; font-weight: bold;">${accountName}</td>
            </tr>
            <tr>
              <td style="color: #6b7280;">Account Number:</td>
              <td style="text-align: right; font-weight: bold;">${accountNumber}</td>
            </tr>
            <tr>
              <td style="color: #6b7280;">Amount Deposited:</td>
              <td style="text-align: right; font-weight: bold; color: #10b981; font-size: 18px;">USDT ${amount.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="color: #6b7280;">Reference:</td>
              <td style="text-align: right; font-family: monospace; font-size: 12px;">${reference}</td>
            </tr>
            <tr>
              <td style="color: #6b7280;">New Balance:</td>
              <td style="text-align: right; font-weight: bold;">USDT ${newBalance.toFixed(2)}</td>
            </tr>
          </table>
          ${conversionNote}
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${baseUrl}/chain-account/login" style="background: #10b981; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            View Chain Account
          </a>
        </div>
      </div>

      <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="color: #666; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} Acredis Finance. All rights reserved.<br>
          United Arab Emirates
        </p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to,
    subject: `💰 Deposit Confirmed - ${accountName}`,
    html,
  });
}

// GET endpoint to fetch deposits
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const session = verifyChainAccountToken(token);

    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const chainAccountId = searchParams.get('chainAccountId');

    if (!chainAccountId) {
      return NextResponse.json(
        { error: 'Chain Account ID is required' },
        { status: 400 }
      );
    }

    if (session.chainAccountId !== chainAccountId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const deposits = await prisma.chainAccountDeposit.findMany({
      where: { chainAccountId },
      include: {
        initiator: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              }
            }
          }
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to match frontend expectations
    const transformedDeposits = deposits.map(d => ({
      ...d,
      depositedBy: d.initiator.user,
      depositReference: d.reference,
      depositMethod: d.method,
      initiator: undefined
    }));

    return NextResponse.json({
      success: true,
      deposits: transformedDeposits,
    });
  } catch (error: any) {
    console.error('Get deposits error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
