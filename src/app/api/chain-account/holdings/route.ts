import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyChainAccountToken } from '@/lib/chain-account-session';
import { convertCurrency } from '@/lib/currency-converter';
import { notifyAdminsOfUserActivity, sendChainHoldingInitiatedEmail } from '@/lib/email';

function getSession(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyChainAccountToken(authHeader.substring(7));
}

// GET - List holdings for a Chain Account
export async function GET(request: NextRequest) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const chainAccountId = searchParams.get('chainAccountId');

    if (!chainAccountId || session.chainAccountId !== chainAccountId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const holdings = await prisma.chainAccountHolding.findMany({
      where: { chainAccountId },
      include: {
        token: true,
        initiator: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalValue = holdings
      .filter(h => h.status === 'ACTIVE')
      .reduce((sum, h) => sum + h.currentValue + h.interestEarned, 0);

    return NextResponse.json({ success: true, holdings, totalValue });
  } catch (error) {
    console.error('Error fetching chain account holdings:', error);
    return NextResponse.json({ error: 'Failed to fetch holdings' }, { status: 500 });
  }
}

// POST - Create a new holding request (always requires admin approval)
export async function POST(request: NextRequest) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { chainAccountId, tokenId, amount } = await request.json();

    if (!chainAccountId || !tokenId || !amount) {
      return NextResponse.json({ error: 'Chain account ID, token ID, and amount are required' }, { status: 400 });
    }

    if (session.chainAccountId !== chainAccountId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const depositAmount = parseFloat(amount);
    if (depositAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    const chainAccount = await prisma.chainAccount.findUnique({
      where: { id: chainAccountId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!chainAccount || chainAccount.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Chain Account not active' }, { status: 400 });
    }

    if (chainAccount.balance < depositAmount) {
      return NextResponse.json({ error: 'Insufficient Chain Account balance' }, { status: 400 });
    }

    const member = chainAccount.members.find(m => m.userId === session.userId);
    if (!member) {
      return NextResponse.json({ error: 'You are not a member of this Chain Account' }, { status: 403 });
    }

    const token = await prisma.holdingToken.findUnique({ where: { id: tokenId } });
    if (!token || !token.isActive) {
      return NextResponse.json({ error: 'Token not found or inactive' }, { status: 404 });
    }

    // Chain Account balance is in USDT, pegged 1:1 to USD
    const depositAmountUSD = chainAccount.currency === 'USD'
      ? depositAmount
      : await convertCurrency(depositAmount, chainAccount.currency, 'USD');

    const tokenAmount = token.currentPrice > 0 ? depositAmountUSD / token.currentPrice : depositAmountUSD;
    const reference = `CHLD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const holding = await prisma.$transaction(async (tx) => {
      const updatedChainAccount = await tx.chainAccount.update({
        where: { id: chainAccountId },
        data: {
          balance: { decrement: depositAmount },
          lastActivityAt: new Date(),
        },
      });

      const created = await tx.chainAccountHolding.create({
        data: {
          chainAccountId,
          initiatedBy: member.id,
          userId: session.userId,
          tokenId,
          depositedAmount: depositAmount,
          tokenAmount,
          currentValue: depositAmountUSD,
          interestEarned: 0,
          status: 'PENDING',
          reference,
        },
        include: { token: true },
      });

      await tx.chainAccountTransaction.create({
        data: {
          chainAccountId,
          transactionType: 'HOLDING',
          amount: depositAmount,
          currency: chainAccount.currency,
          balanceBefore: chainAccount.balance,
          balanceAfter: updatedChainAccount.balance,
          description: `Holding request (PENDING) - ${tokenAmount.toFixed(8)} ${token.symbol} - ${reference}`,
          relatedUserId: session.userId,
          reference,
        },
      });

      return created;
    });

    const initiatorName = member.user.name || member.user.email;
    const otherMembers = chainAccount.members.filter(m => m.id !== member.id);

    // Notify other members (email + in-app, informational only)
    for (const m of otherMembers) {
      await sendChainHoldingInitiatedEmail({
        to: m.user.email,
        recipientName: m.user.name || m.user.email,
        initiatorName,
        accountName: chainAccount.accountName,
        accountNumber: chainAccount.accountNumber,
        tokenName: token.name,
        tokenSymbol: token.symbol,
        amount: depositAmount,
        currency: chainAccount.currency,
        reference,
      }).catch(err => console.error('Failed to send holding notification email:', err));

      await prisma.chainAccountNotification.create({
        data: {
          chainAccountId,
          userId: m.userId,
          type: 'GENERAL',
          title: 'Crypto Holding Requested',
          message: `${initiatorName} requested to hold ${chainAccount.currency} ${depositAmount.toLocaleString()} in ${token.name} (${token.symbol}). Awaiting admin approval.`,
          isRead: false,
        },
      });
    }

    // Notify admins
    await notifyAdminsOfUserActivity(
      session.userId,
      initiatorName,
      `a Chain Account Crypto Holding Request for ${chainAccount.currency} ${depositAmount.toFixed(2)} in ${token.name} (${token.symbol}) on ${chainAccount.accountName}`
    ).catch(err => console.error('Failed to send admin notification email:', err));

    return NextResponse.json({
      success: true,
      message: 'Holding request submitted and is awaiting admin approval',
      holding,
    });
  } catch (error) {
    console.error('Error creating chain account holding:', error);
    return NextResponse.json({ error: 'Failed to create holding' }, { status: 500 });
  }
}

// PATCH - Withdraw an active holding back to the Chain Account balance
export async function PATCH(request: NextRequest) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { chainAccountId, holdingId } = await request.json();

    if (!chainAccountId || !holdingId) {
      return NextResponse.json({ error: 'Chain account ID and holding ID are required' }, { status: 400 });
    }

    if (session.chainAccountId !== chainAccountId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const holding = await prisma.chainAccountHolding.findUnique({
      where: { id: holdingId },
      include: { token: true },
    });

    if (!holding || holding.chainAccountId !== chainAccountId) {
      return NextResponse.json({ error: 'Holding not found' }, { status: 404 });
    }

    if (holding.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Holding is not active' }, { status: 400 });
    }

    const chainAccount = await prisma.chainAccount.findUnique({ where: { id: chainAccountId } });
    if (!chainAccount) {
      return NextResponse.json({ error: 'Chain Account not found' }, { status: 404 });
    }

    const daysSinceCreation = Math.floor((Date.now() - holding.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const dailyRate = holding.token.interestRate / 365 / 100;
    const finalInterest = holding.currentValue * dailyRate * daysSinceCreation;
    const totalAmountUSD = holding.currentValue + finalInterest;

    const totalAmount = chainAccount.currency === 'USD'
      ? totalAmountUSD
      : await convertCurrency(totalAmountUSD, 'USD', chainAccount.currency);

    const reference = `CHLD-WD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    await prisma.$transaction(async (tx) => {
      const updatedChainAccount = await tx.chainAccount.update({
        where: { id: chainAccountId },
        data: {
          balance: { increment: totalAmount },
          lastActivityAt: new Date(),
        },
      });

      await tx.chainAccountTransaction.create({
        data: {
          chainAccountId,
          transactionType: 'HOLDING',
          amount: totalAmount,
          currency: chainAccount.currency,
          balanceBefore: chainAccount.balance,
          balanceAfter: updatedChainAccount.balance,
          description: `Holding withdrawal: ${holding.tokenAmount.toFixed(8)} ${holding.token.symbol} + interest - ${reference}`,
          relatedUserId: session.userId,
          reference,
        },
      });

      await tx.chainAccountHolding.update({
        where: { id: holdingId },
        data: { status: 'WITHDRAWN' },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Holding withdrawn successfully',
      amount: totalAmount,
    });
  } catch (error) {
    console.error('Error withdrawing chain account holding:', error);
    return NextResponse.json({ error: 'Failed to withdraw holding' }, { status: 500 });
  }
}
