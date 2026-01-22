import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { convertCryptoToFiat } from '@/lib/crypto-converter';
import { notifyAdminsOfUserActivity } from '@/lib/email';

// GET - List crypto deposits
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');

    const where: any = {
      transactionType: 'DEPOSIT',
      channel: 'CRYPTO',
    };
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const deposits = await prisma.transaction.findMany({
      where,
      include: {
        account: {
          select: {
            id: true,
            accountNumber: true,
            currency: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ deposits });
  } catch (error) {
    console.error('Error fetching crypto deposits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch crypto deposits' },
      { status: 500 }
    );
  }
}

// POST - Create new crypto deposit
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, accountId, tokenName, tokenSymbol, network, amount, transactionHash, walletAddress } = body;

    if (!userId || !accountId || !amount || !transactionHash) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Verify account belongs to user
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        userId,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Invalid account' },
        { status: 400 }
      );
    }

    // Convert crypto amount to account's fiat currency
    let fiatAmount: number;
    let cryptoPrice: number;
    let exchangeRate: number;

    try {
      const conversion = await convertCryptoToFiat(
        parseFloat(amount),
        tokenSymbol || tokenName || 'BTC',
        account.currency
      );
      fiatAmount = conversion.fiatAmount;
      cryptoPrice = conversion.cryptoPrice;
      exchangeRate = conversion.exchangeRate;
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Failed to convert crypto to fiat. Please try again.' },
        { status: 400 }
      );
    }

    // Generate unique reference
    const txReference = `CRYPTO-DEP-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Create crypto deposit transaction
    const deposit = await prisma.transaction.create({
      data: {
        userId,
        accountId,
        transactionType: 'DEPOSIT',
        channel: 'CRYPTO',
        paymentMethod: 'CRYPTO',
        amount: fiatAmount, // Store converted fiat amount
        balanceAfter: account.balance, // Will be updated when verified
        currency: account.currency,
        description: `Crypto deposit - ${parseFloat(amount).toFixed(8)} ${tokenSymbol || tokenName || 'Cryptocurrency'}`,
        reference: txReference,
        status: 'PENDING',
        tokenName: tokenName || null,
        tokenSymbol: tokenSymbol || null,
        network: network || null,
        transactionHash: transactionHash,
        walletAddress: walletAddress || null,
        metadata: {
          cryptoAmount: parseFloat(amount),
          cryptoSymbol: tokenSymbol || tokenName || 'BTC',
          cryptoPriceUSD: cryptoPrice,
          fiatAmount: fiatAmount,
          fiatCurrency: account.currency,
          exchangeRate: exchangeRate,
          conversionTimestamp: new Date().toISOString(),
        },
      },
    });

    // Create notification for admins
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          title: 'New Crypto Deposit',
          message: `A new ${tokenName || tokenSymbol || 'cryptocurrency'} deposit of ${amount} has been submitted for verification.`,
          type: 'SYSTEM',
          link: `/admin/crypto-deposits`,
        },
      });
    }

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId,
        title: 'Crypto Deposit Submitted',
        message: `Your ${tokenName || tokenSymbol || 'cryptocurrency'} deposit of ${amount} has been submitted for verification.`,
        type: 'TRANSACTION',
      },
    });

    // Get user details for admin email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Notify admins via email
    notifyAdminsOfUserActivity(
      userId,
      user?.name || 'Unknown User',
      `a Crypto Deposit of ${amount} ${tokenName || tokenSymbol || 'cryptocurrency'}`
    );

    return NextResponse.json({ deposit }, { status: 201 });
  } catch (error) {
    console.error('Error creating crypto deposit:', error);
    return NextResponse.json(
      { error: 'Failed to create crypto deposit' },
      { status: 500 }
    );
  }
}
