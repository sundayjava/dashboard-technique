import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyChainAccountToken } from '@/lib/chain-account-session';
import { notifyAdminsOfUserActivity, sendChainInvestmentCloseRequestedEmail } from '@/lib/email';

// POST - Request to close an active Chain Account investment early (any member, admin approves)
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const session = verifyChainAccountToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const { chainAccountId, investmentId, reason } = await request.json();

    if (!chainAccountId || !investmentId) {
      return NextResponse.json({ error: 'Chain account ID and investment ID are required' }, { status: 400 });
    }

    if (session.chainAccountId !== chainAccountId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
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

    if (!chainAccount) {
      return NextResponse.json({ error: 'Chain Account not found' }, { status: 404 });
    }

    const member = chainAccount.members.find(m => m.userId === session.userId);
    if (!member) {
      return NextResponse.json({ error: 'You are not a member of this Chain Account' }, { status: 403 });
    }

    const investment = await prisma.chainAccountInvestment.findUnique({
      where: { id: investmentId },
      include: { plan: true },
    });

    if (!investment || investment.chainAccountId !== chainAccountId) {
      return NextResponse.json({ error: 'Investment not found' }, { status: 404 });
    }

    if (investment.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Only active investments can be closed early' }, { status: 400 });
    }

    const updated = await prisma.chainAccountInvestment.update({
      where: { id: investmentId },
      data: {
        status: 'CLOSE_REQUESTED',
        closeRequestedBy: member.id,
        closeRequestedAt: new Date(),
        closeRequestReason: reason || null,
      },
    });

    const requesterName = member.user.name || member.user.email;
    const otherMembers = chainAccount.members.filter(m => m.id !== member.id);

    for (const m of otherMembers) {
      await sendChainInvestmentCloseRequestedEmail({
        to: m.user.email,
        recipientName: m.user.name || m.user.email,
        requesterName,
        accountName: chainAccount.accountName,
        accountNumber: chainAccount.accountNumber,
        planName: investment.plan.planName,
        amount: investment.amount,
        currency: investment.currency,
        reference: investment.reference,
        reason: reason || undefined,
      }).catch(err => console.error('Failed to send close-requested email:', err));

      await prisma.chainAccountNotification.create({
        data: {
          chainAccountId,
          userId: m.userId,
          type: 'GENERAL',
          title: 'Investment Close Requested',
          message: `${requesterName} requested to close the ${investment.plan.planName} investment of ${investment.currency} ${investment.amount.toLocaleString()} early. Awaiting admin approval.`,
          isRead: false,
        },
      });
    }

    await notifyAdminsOfUserActivity(
      session.userId,
      requesterName,
      `a Chain Account Investment Close Request for ${investment.currency} ${investment.amount.toFixed(2)} in ${investment.plan.planName} on ${chainAccount.accountName}`
    ).catch(err => console.error('Failed to send admin notification email:', err));

    return NextResponse.json({
      success: true,
      message: 'Close request submitted and is awaiting admin approval',
      investment: updated,
    });
  } catch (error) {
    console.error('Error requesting investment close:', error);
    return NextResponse.json({ error: 'Failed to request investment close' }, { status: 500 });
  }
}
