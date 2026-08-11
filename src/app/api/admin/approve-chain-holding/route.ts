import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendChainHoldingDecisionEmail } from '@/lib/email';

// POST - Approve or reject a Chain Account holding request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminId, holdingId, action, adminNotes, depositedAmount, tokenAmount, currentValue, interestEarned } = body;

    if (!adminId || !holdingId || !action) {
      return NextResponse.json(
        { error: 'Admin ID, holding ID, and action are required' },
        { status: 400 }
      );
    }

    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const holding = await prisma.chainAccountHolding.findUnique({
      where: { id: holdingId },
      include: {
        token: true,
        chainAccount: true,
        initiator: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!holding) {
      return NextResponse.json({ error: 'Holding not found' }, { status: 404 });
    }

    if (holding.status !== 'PENDING') {
      return NextResponse.json({ error: 'Holding is not pending' }, { status: 400 });
    }

    const initiatorEmail = holding.initiator.user.email;
    const initiatorName = holding.initiator.user.name || initiatorEmail;

    if (action === 'APPROVE') {
      // Recalculate tokenAmount based on CURRENT token price at approval time
      const currentTokenAmount = holding.currentValue > 0 && holding.token.currentPrice > 0
        ? holding.currentValue / holding.token.currentPrice
        : holding.tokenAmount;

      const updatedHolding = await prisma.chainAccountHolding.update({
        where: { id: holdingId },
        data: {
          status: 'ACTIVE',
          depositedAmount: depositedAmount !== undefined ? parseFloat(depositedAmount) : holding.depositedAmount,
          tokenAmount: tokenAmount !== undefined ? parseFloat(tokenAmount) : currentTokenAmount,
          currentValue: currentValue !== undefined ? parseFloat(currentValue) : holding.currentValue,
          interestEarned: interestEarned !== undefined ? parseFloat(interestEarned) : holding.interestEarned,
          processedBy: adminId,
          processedAt: new Date(),
          adminNotes: adminNotes || null,
        },
        include: { token: true },
      });

      await prisma.chainAccountNotification.create({
        data: {
          chainAccountId: holding.chainAccountId,
          userId: holding.userId,
          type: 'ACTION_COMPLETED',
          title: 'Holding Approved',
          message: `Your ${holding.token.name} holding of ${holding.chainAccount.currency} ${holding.depositedAmount.toFixed(2)} has been approved and is now active.`,
          isRead: false,
        },
      });

      await sendChainHoldingDecisionEmail({
        to: initiatorEmail,
        recipientName: initiatorName,
        accountName: holding.chainAccount.accountName,
        tokenName: holding.token.name,
        tokenSymbol: holding.token.symbol,
        amount: holding.depositedAmount,
        currency: holding.chainAccount.currency,
        reference: holding.reference,
        decision: 'APPROVED',
        adminNotes: adminNotes || undefined,
      }).catch(err => console.error('Failed to send holding decision email:', err));

      return NextResponse.json({
        message: 'Holding approved successfully',
        holding: updatedHolding,
      });
    } else if (action === 'REJECT') {
      await prisma.$transaction(async (tx) => {
        const updatedChainAccount = await tx.chainAccount.update({
          where: { id: holding.chainAccountId },
          data: { balance: { increment: holding.depositedAmount } },
        });

        const reference = `CHLD-REJ-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        await tx.chainAccountTransaction.create({
          data: {
            chainAccountId: holding.chainAccountId,
            transactionType: 'HOLDING',
            amount: holding.depositedAmount,
            currency: holding.chainAccount.currency,
            balanceBefore: holding.chainAccount.balance,
            balanceAfter: updatedChainAccount.balance,
            description: `Holding request rejected (refund): ${holding.tokenAmount.toFixed(8)} ${holding.token.symbol} - ${reference}`,
            relatedUserId: holding.userId,
            reference,
          },
        });

        await tx.chainAccountHolding.update({
          where: { id: holdingId },
          data: {
            status: 'REJECTED',
            processedBy: adminId,
            processedAt: new Date(),
            adminNotes: adminNotes || null,
          },
        });

        await tx.chainAccountNotification.create({
          data: {
            chainAccountId: holding.chainAccountId,
            userId: holding.userId,
            type: 'ACTION_COMPLETED',
            title: 'Holding Rejected',
            message: `Your ${holding.token.name} holding request has been rejected. The amount has been refunded to the Chain Account balance.`,
            isRead: false,
          },
        });
      });

      await sendChainHoldingDecisionEmail({
        to: initiatorEmail,
        recipientName: initiatorName,
        accountName: holding.chainAccount.accountName,
        tokenName: holding.token.name,
        tokenSymbol: holding.token.symbol,
        amount: holding.depositedAmount,
        currency: holding.chainAccount.currency,
        reference: holding.reference,
        decision: 'REJECTED',
        adminNotes: adminNotes || undefined,
      }).catch(err => console.error('Failed to send holding decision email:', err));

      return NextResponse.json({
        message: 'Holding rejected and amount refunded to Chain Account balance',
      });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing chain account holding:', error);
    return NextResponse.json({ error: 'Failed to process holding' }, { status: 500 });
  }
}
