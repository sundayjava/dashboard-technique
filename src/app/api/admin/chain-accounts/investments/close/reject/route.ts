import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendChainInvestmentCloseDecisionEmail } from '@/lib/email';

// POST - Reject an early close request for a Chain Account investment (Admin only)
export async function POST(request: NextRequest) {
  try {
    const { investmentId, reason } = await request.json();

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

    await prisma.$transaction(async (tx) => {
      await tx.chainAccountInvestment.update({
        where: { id: investmentId },
        data: {
          status: 'ACTIVE',
          closeRequestedBy: null,
          closeRequestedAt: null,
          closeRequestReason: null,
          processedBy: null,
          processedAt: new Date(),
          adminNotes: reason || null,
        },
      });

      for (const m of investment.chainAccount.members) {
        await tx.chainAccountNotification.create({
          data: {
            chainAccountId: investment.chainAccountId,
            userId: m.userId,
            type: 'ACTION_COMPLETED',
            title: 'Investment Close Request Rejected',
            message: `The request to close the ${investment.plan.planName} investment early was rejected. The investment remains active.`,
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
        decision: 'REJECTED',
        adminNotes: reason || undefined,
      }).catch(err => console.error('Failed to send close decision email:', err));
    }

    return NextResponse.json({ message: 'Investment close request rejected' });
  } catch (error) {
    console.error('Error rejecting investment close:', error);
    return NextResponse.json({ error: 'Failed to reject investment close' }, { status: 500 });
  }
}
