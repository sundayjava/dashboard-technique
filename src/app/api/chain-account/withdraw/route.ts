import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyChainAccountToken } from '@/lib/chain-account-session';
import { approvalRequirementFor } from '@/lib/chain-account-authorization';

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

    const { chainAccountId, distributions, currency } = await request.json();

    // Validate input
    if (!chainAccountId || !distributions || !Array.isArray(distributions) || distributions.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid distributions' },
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

    // Calculate total amount
    const totalAmount = distributions.reduce((sum, d) => sum + d.amount, 0);

    if (totalAmount <= 0) {
      return NextResponse.json(
        { error: 'Total withdrawal amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Fetch Chain Account
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
              },
            },
          },
        },
      },
    });

    if (!chainAccount || chainAccount.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Chain Account not active' },
        { status: 400 }
      );
    }

    // Verify sufficient balance
    if (totalAmount > chainAccount.balance) {
      return NextResponse.json(
        { error: 'Insufficient Chain Account balance' },
        { status: 400 }
      );
    }

    // Verify all members exist
    const memberIds = distributions.map(d => d.memberId);
    const validMembers = chainAccount.members.filter(m => memberIds.includes(m.id));
    
    if (validMembers.length !== memberIds.length) {
      return NextResponse.json(
        { error: 'Invalid member IDs in distributions' },
        { status: 400 }
      );
    }

    // Generate withdrawal reference
    const withdrawalReference = `WTH-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    // Get the member for this user (already loaded with user info above)
    const member = chainAccount.members.find(m => m.userId === session.userId);

    if (!member) {
      return NextResponse.json(
        { error: 'You are not a member of this Chain Account' },
        { status: 403 }
      );
    }

    const otherMembers = chainAccount.members.filter(m => m.id !== member.id);
    const initiatorName = member.user.name || member.user.email;

    // Whether the other parties have to approve is set by the account's own
    // authorization model and threshold — INDEPENDENT lets a member act alone,
    // THRESHOLD catches amounts at or above its limit, MAJORITY needs more than
    // half the parties. The single rule shared with the decision side lives in
    // chain-account-authorization.
    //
    // Either way the funds are reserved now and an admin gives final sign-off
    // before any wallet is credited; co-owner approval only gates the move into
    // that admin queue, and it is given in the dashboard's Approvals panel.
    const requirement = approvalRequirementFor({
      authorizationModel: chainAccount.authorizationModel,
      thresholdAmount: chainAccount.thresholdAmount,
      amount: totalAmount,
      memberCount: chainAccount.members.length,
    });
    const needsApproval = requirement.required;

    const withdrawal = await prisma.$transaction(async (tx) => {
      const created = await tx.chainAccountWithdrawal.create({
        data: {
          chainAccountId,
          initiatedBy: member.id,
          reference: withdrawalReference,
          totalAmount,
          currency,
          distribution: distributions,
          requiresApproval: needsApproval,
          status: needsApproval ? 'PENDING_APPROVAL' : 'APPROVED',
        },
      });

      await tx.chainAccount.update({
        where: { id: chainAccountId },
        data: { balance: { decrement: totalAmount } },
      });

      await tx.chainAccountTransaction.create({
        data: {
          chainAccountId,
          transactionType: 'WITHDRAWAL',
          amount: totalAmount,
          currency,
          balanceBefore: chainAccount.balance,
          balanceAfter: chainAccount.balance - totalAmount,
          description: `Withdrawal to ${distributions.length} member(s) - ${withdrawalReference}`,
          relatedUserId: session.userId,
          relatedWithdrawalId: created.id,
          reference: withdrawalReference,
        },
      });

      if (needsApproval) {
        for (const m of otherMembers) {
          await tx.chainAccountApproval.create({
            data: {
              chainAccountId,
              memberId: m.id,
              actionType: 'WITHDRAWAL',
              actionId: created.id,
            },
          });
        }
      }

      return created;
    });

    if (needsApproval) {
      // Each co-owner gets an in-app approval request showing their share
      // (equity) of the withdrawal. The request sits in their Approvals panel
      // until they decide it — no email, no expiring link.
      for (const m of otherMembers) {
        const memberDistribution = distributions.find((d: any) => d.memberId === m.id);

        await prisma.chainAccountNotification.create({
          data: {
            chainAccountId,
            userId: m.userId,
            type: 'APPROVAL_REQUEST',
            title: 'Withdrawal Approval Required',
            message: `${initiatorName} initiated a withdrawal of $${totalAmount.toLocaleString()} (your share: $${(memberDistribution?.amount || 0).toLocaleString()}). ${requirement.reason}. Open the Approvals panel in your Chain Account dashboard to approve or reject it.`,
            isRead: false,
            actionType: 'WITHDRAWAL',
            actionId: withdrawal.id,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      withdrawal: {
        id: withdrawal.id,
        withdrawalReference,
        totalAmount,
        currency,
        status: withdrawal.status,
        requiresApproval: needsApproval,
        approvalRule: requirement.mode,
        approvalsNeeded: requirement.approvalsNeeded,
        distributions,
      },
    });

  } catch (error: any) {
    console.error('Withdrawal error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch withdrawals
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

    // Debug logging
    console.log('Withdraw GET Request:');
    console.log('  Session chainAccountId:', session.chainAccountId);
    console.log('  Requested chainAccountId:', chainAccountId);
    console.log('  Match:', session.chainAccountId === chainAccountId);

    if (session.chainAccountId !== chainAccountId) {
      console.error('Access denied: chainAccountId mismatch in withdraw GET');
      return NextResponse.json(
        { error: 'Access denied', details: { session: session.chainAccountId, requested: chainAccountId } },
        { status: 403 }
      );
    }

    const withdrawals = await prisma.chainAccountWithdrawal.findMany({
      where: { chainAccountId },
      include: {
        initiator: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      withdrawals: withdrawals.map(w => ({
        id: w.id,
        withdrawalReference: w.reference,
        totalAmount: w.totalAmount,
        currency: w.currency,
        status: w.status,
        memberDistributions: w.distribution,
        initiatedBy: w.initiator.user.name || w.initiator.user.email,
        createdAt: w.createdAt,
      })),
    });

  } catch (error: any) {
    console.error('Error fetching withdrawals:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
