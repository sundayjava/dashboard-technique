import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendChainInvestmentCloseDecisionEmail } from '@/lib/email';

// POST - Approve an early close request for a Chain Account investment (Admin only)
export async function POST(request: NextRequest) {
  try {
    const { investmentId, adminNotes } = await request.json();

    if (!investmentId) {
      return NextResponse.json({ error: 'Investment ID is required' }, { status: 400 });
    }

    const investment = await prisma.chainAccountInvestment.findUnique({
      where: { id: investmentId },
      include: {
        plan: true,
        chainAccount: {
          include: {
            members: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        },
      },
    });

    if (!investment) {
      return NextResponse.json({ error: 'Investment not found' }, { status: 404 });
    }

    if (investment.status !== 'CLOSE_REQUESTED') {
      return NextResponse.json({ error: 'Investment does not have a pending close request' }, { status: 400 });
    }

    // Prorate profit based on days held vs. total plan duration
    const startDate = investment.startDate || investment.createdAt;
    const daysHeld = Math.max(0, Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const cappedDays = Math.min(daysHeld, investment.plan.duration);
    const fullProfit = investment.amount * (investment.plan.profitPercentage / 100);
    const proratedProfit = investment.plan.duration > 0 ? fullProfit * (cappedDays / investment.plan.duration) : 0;
    const refundAmount = investment.amount + proratedProfit;

    const reference = `INV-CLS-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    await prisma.$transaction(async (tx) => {
      const updatedChainAccount = await tx.chainAccount.update({
        where: { id: investment.chainAccountId },
        data: {
          balance: { increment: refundAmount },
          lastActivityAt: new Date(),
        },
      });

      await tx.chainAccountTransaction.create({
        data: {
          chainAccountId: investment.chainAccountId,
          transactionType: 'INVESTMENT_RETURN',
          amount: refundAmount,
          currency: investment.currency,
          relatedUserId: investment.chainAccount.members.find(m => m.id === investment.closeRequestedBy)?.userId,
          balanceBefore: investment.chainAccount.balance,
          balanceAfter: updatedChainAccount.balance,
          description: `Early close of ${investment.plan.planName} investment: principal $${investment.amount.toFixed(2)} + prorated profit $${proratedProfit.toFixed(2)} - ${reference}`,
          relatedInvestmentId: investment.id,
          reference,
        },
      });

      await tx.chainAccountInvestment.update({
        where: { id: investmentId },
        data: {
          status: 'CLOSED_EARLY',
          profitEarned: proratedProfit,
          completedAt: new Date(),
          processedBy: null,
          processedAt: new Date(),
          adminNotes: adminNotes || null,
        },
      });

      for (const m of investment.chainAccount.members) {
        await tx.chainAccountNotification.create({
          data: {
            chainAccountId: investment.chainAccountId,
            userId: m.userId,
            type: 'ACTION_COMPLETED',
            title: 'Investment Closed Early',
            message: `The ${investment.plan.planName} investment was closed early. $${refundAmount.toFixed(2)} (principal + prorated profit) has been credited to the Chain Account balance.`,
            isRead: false,
          },
        });
      }
    });

    for (const m of investment.chainAccount.members) {
      await sendChainInvestmentCloseDecisionEmail({
        to: m.user.email,
        recipientName: m.user.name || m.user.email,
        accountName: investment.chainAccount.accountName,
        planName: investment.plan.planName,
        amount: investment.amount,
        currency: investment.currency,
        reference: investment.reference,
        decision: 'APPROVED',
        refundAmount,
        adminNotes: adminNotes || undefined,
      }).catch(err => console.error('Failed to send close decision email:', err));
    }

    return NextResponse.json({
      message: 'Investment close approved and funds refunded to Chain Account balance',
      refundAmount,
    });
  } catch (error) {
    console.error('Error approving investment close:', error);
    return NextResponse.json({ error: 'Failed to approve investment close' }, { status: 500 });
  }
}
