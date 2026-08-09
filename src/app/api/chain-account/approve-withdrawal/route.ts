import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Load withdrawal approval details by one-time token (no login required)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const approval = await prisma.chainAccountApproval.findUnique({
      where: { approvalToken: token },
      include: {
        member: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
        chainAccount: {
          select: { accountName: true, accountNumber: true },
        },
      },
    });

    if (!approval || approval.actionType !== 'WITHDRAWAL') {
      return NextResponse.json({ error: 'Invalid or expired approval link' }, { status: 404 });
    }

    const withdrawal = await prisma.chainAccountWithdrawal.findUnique({
      where: { id: approval.actionId },
      include: {
        initiator: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
    });

    if (!withdrawal) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });
    }

    const distributions = withdrawal.distribution as Array<{ memberId: string; amount: number }>;
    const memberShare = distributions.find(d => d.memberId === approval.memberId)?.amount || 0;

    return NextResponse.json({
      success: true,
      alreadyDecided: approval.decision !== null,
      decision: approval.decision,
      withdrawalStatus: withdrawal.status,
      accountName: approval.chainAccount.accountName,
      accountNumber: approval.chainAccount.accountNumber,
      initiatorName: withdrawal.initiator.user.name || withdrawal.initiator.user.email,
      recipientName: approval.member.user.name || approval.member.user.email,
      totalAmount: withdrawal.totalAmount,
      currency: withdrawal.currency,
      memberShare,
    });
  } catch (error: any) {
    console.error('Error fetching withdrawal approval:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Record a member's approve/reject decision via the emailed token
export async function POST(request: NextRequest) {
  try {
    const { token, decision } = await request.json();

    if (!token || !decision || !['APPROVED', 'REJECTED'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const approval = await prisma.chainAccountApproval.findUnique({
      where: { approvalToken: token },
      include: {
        member: { include: { user: { select: { name: true, email: true } } } },
      },
    });

    if (!approval || approval.actionType !== 'WITHDRAWAL') {
      return NextResponse.json({ error: 'Invalid or expired approval link' }, { status: 404 });
    }

    if (approval.decision) {
      return NextResponse.json({ error: 'You have already responded to this request' }, { status: 400 });
    }

    const withdrawal = await prisma.chainAccountWithdrawal.findUnique({
      where: { id: approval.actionId },
      include: {
        chainAccount: { include: { members: { include: { user: { select: { name: true, email: true } } } } } },
      },
    });

    if (!withdrawal || withdrawal.status !== 'PENDING_APPROVAL') {
      return NextResponse.json({ error: 'This withdrawal is no longer awaiting approval' }, { status: 400 });
    }

    await prisma.chainAccountApproval.update({
      where: { id: approval.id },
      data: {
        decision,
        status: 'DECIDED',
        decidedAt: new Date(),
        approvalTokenUsed: true,
      },
    });

    const approverName = approval.member.user.name || approval.member.user.email;
    const otherMembers = withdrawal.chainAccount.members.filter(m => m.id !== approval.memberId);

    if (decision === 'REJECTED') {
      await prisma.$transaction([
        prisma.chainAccountWithdrawal.update({
          where: { id: withdrawal.id },
          data: { status: 'REJECTED' },
        }),
        prisma.chainAccount.update({
          where: { id: withdrawal.chainAccountId },
          data: { balance: { increment: withdrawal.totalAmount } },
        }),
        ...otherMembers.map(m =>
          prisma.chainAccountNotification.create({
            data: {
              chainAccountId: withdrawal.chainAccountId,
              userId: m.userId,
              type: 'APPROVAL_REJECTED',
              title: 'Withdrawal Rejected',
              message: `${approverName} rejected the withdrawal of $${withdrawal.totalAmount.toLocaleString()}. The amount has been returned to the account balance.`,
              isRead: false,
            },
          })
        ),
      ]);

      return NextResponse.json({
        success: true,
        message: 'You rejected this withdrawal. It has been cancelled and the funds returned to the account.',
      });
    }

    // Decision was APPROVED - check whether every co-owner has now approved
    const allApprovals = await prisma.chainAccountApproval.findMany({
      where: { chainAccountId: withdrawal.chainAccountId, actionType: 'WITHDRAWAL', actionId: withdrawal.id },
    });

    const pending = allApprovals.filter(a => !a.decision).length;

    if (pending === 0) {
      // Everyone approved - move to admin review
      await prisma.chainAccountWithdrawal.update({
        where: { id: withdrawal.id },
        data: { status: 'APPROVED', allApproved: true },
      });

      await Promise.all(
        withdrawal.chainAccount.members.map(m =>
          prisma.chainAccountNotification.create({
            data: {
              chainAccountId: withdrawal.chainAccountId,
              userId: m.userId,
              type: 'APPROVAL_GRANTED',
              title: 'Withdrawal Fully Approved',
              message: `All members have approved the withdrawal of $${withdrawal.totalAmount.toLocaleString()}. It is now awaiting final admin approval.`,
              isRead: false,
            },
          })
        )
      );

      return NextResponse.json({
        success: true,
        message: 'Thank you. All members have now approved — this withdrawal is awaiting final admin approval.',
      });
    }

    // Still waiting on other members
    await Promise.all(
      otherMembers.map(m =>
        prisma.chainAccountNotification.create({
          data: {
            chainAccountId: withdrawal.chainAccountId,
            userId: m.userId,
            type: 'APPROVAL_GRANTED',
            title: 'Withdrawal Approval Update',
            message: `${approverName} approved the withdrawal of $${withdrawal.totalAmount.toLocaleString()}. Waiting on ${pending} more member(s).`,
            isRead: false,
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      message: `Thank you for approving. Waiting on ${pending} more member(s) before this can proceed.`,
    });
  } catch (error: any) {
    console.error('Error processing withdrawal approval:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
