import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyChainAccountToken } from '@/lib/chain-account-session';
import { requiresApproval as checkApprovalNeeded } from '@/lib/chain-account-utils';

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

    const { chainAccountId, investmentPlanId, amount, currency } = await request.json();

    // Validate input
    if (!chainAccountId || !investmentPlanId || !amount || !currency) {
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

    // Fetch Chain Account
    const chainAccount = await prisma.chainAccount.findUnique({
      where: { id: chainAccountId },
      include: {
        members: true,
      },
    });

    if (!chainAccount || chainAccount.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Chain Account not active' },
        { status: 400 }
      );
    }

    // Verify sufficient balance
    if (amount > chainAccount.balance) {
      return NextResponse.json(
        { error: 'Insufficient Chain Account balance' },
        { status: 400 }
      );
    }

    // Fetch investment plan
    const investmentPlan = await prisma.investmentPlan.findUnique({
      where: { id: investmentPlanId },
    });

    if (!investmentPlan || !investmentPlan.isActive || !investmentPlan.chainAccountsEnabled) {
      return NextResponse.json(
        { error: 'Investment plan not available for Chain Accounts' },
        { status: 400 }
      );
    }

    // Validate amount against plan limits
    if (amount < investmentPlan.minAmount) {
      return NextResponse.json(
        { error: `Minimum investment is $${investmentPlan.minAmount}` },
        { status: 400 }
      );
    }

    if (investmentPlan.maxAmount && amount > investmentPlan.maxAmount) {
      return NextResponse.json(
        { error: `Maximum investment is $${investmentPlan.maxAmount}` },
        { status: 400 }
      );
    }

    // Check if approval is required
    const needsApproval = await checkApprovalNeeded(
      chainAccountId,
      amount
    );

    // Generate investment reference
    const investmentReference = `INV-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    // Calculate maturity date (duration is in days)
    const startDate = new Date();
    const maturityDate = new Date(startDate);
    maturityDate.setDate(maturityDate.getDate() + investmentPlan.duration);

    // Calculate expected return
    const expectedReturn = amount * (investmentPlan.profitPercentage / 100);

    //Get the member ID for this user
    const member = await prisma.chainAccountMember.findFirst({
      where: {
        chainAccountId,
        userId: session.userId
      }
    });

    if (!member) {
      return NextResponse.json(
        { error: 'You are not a member of this Chain Account' },
        { status: 403 }
      );
    }

    // Create investment record
    const investment = await prisma.chainAccountInvestment.create({
      data: {
        chainAccountId,
        planId: investmentPlanId,
        initiatedBy: member.id, // Member ID
        reference: investmentReference,
        amount,
        currency,
        startDate,
        endDate: maturityDate,
        requiresApproval: needsApproval,
        status: needsApproval ? 'PENDING_APPROVAL' : 'ACTIVE',
      },
    });

    // If approval needed, create approval records
    if (needsApproval) {
      const otherMembers = chainAccount.members.filter(m => m.id !== member.id);
      
      for (const m of otherMembers) {
        await prisma.chainAccountApproval.create({
          data: {
            chainAccountId,
            memberId: m.id,
            actionType: 'INVESTMENT',
            actionId: investment.id,
          },
        });
      }

      // Notify other members
      for (const member of otherMembers) {
        await prisma.chainAccountNotification.create({
          data: {
            chainAccountId,
            userId: member.userId,
            type: 'APPROVAL_REQUEST',
            title: 'Investment Approval Required',
            message: `A new investment of $${amount.toLocaleString()} in ${investmentPlan.planName} requires your approval.`,
            isRead: false,
          },
        });
      }
    } else {
      // No approval needed - deduct from balance immediately
      await prisma.chainAccount.update({
        where: { id: chainAccountId },
        data: {
          balance: { decrement: amount },
        },
      });

      // Notify all members
      for (const member of chainAccount.members) {
        await prisma.chainAccountNotification.create({
          data: {
            chainAccountId,
            userId: member.userId,
            type: 'ACTION_COMPLETED',
            title: 'New Investment Created',
            message: `A new investment of $${amount.toLocaleString()} in ${investmentPlan.planName} has been created.`,
            isRead: false,
          },
        });
      }
    }

    // Create transaction record
    await prisma.chainAccountTransaction.create({
      data: {
        chainAccountId,
        transactionType: 'INVESTMENT',
        amount,
        currency,
        balanceBefore: chainAccount.balance,
        balanceAfter: needsApproval ? chainAccount.balance : chainAccount.balance - amount,
        description: `Investment in ${investmentPlan.planName} - ${investmentReference}`,
        relatedUserId: session.userId,
        relatedInvestmentId: investment.id,
        reference: investmentReference,
      },
    });

    return NextResponse.json({
      success: true,
      investment: {
        id: investment.id,
        investmentReference,
        amount,
        currency,
        planName: investmentPlan.planName,
        expectedReturn,
        status: investment.status,
        requiresApproval: needsApproval,
      },
    });

  } catch (error: any) {
    console.error('Investment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch investments
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
    console.log('Invest GET Request:');
    console.log('  Session chainAccountId:', session.chainAccountId);
    console.log('  Requested chainAccountId:', chainAccountId);
    console.log('  Match:', session.chainAccountId === chainAccountId);

    if (session.chainAccountId !== chainAccountId) {
      console.error('Access denied: chainAccountId mismatch in invest GET');
      return NextResponse.json(
        { error: 'Access denied', details: { session: session.chainAccountId, requested: chainAccountId } },
        { status: 403 }
      );
    }

    const investments = await prisma.chainAccountInvestment.findMany({
      where: { chainAccountId },
      include: {
        plan: {
          select: {
            planName: true,
            profitPercentage: true,
            duration: true,
          },
        },
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
      investments: investments.map(inv => ({
        id: inv.id,
        reference: inv.reference,
        amount: inv.amount,
        currency: inv.currency,
        expectedReturn: inv.amount * (inv.plan.profitPercentage / 100),
        status: inv.status,
        startDate: inv.startDate,
        endDate: inv.endDate,
        plan: inv.plan,
        initiatedBy: inv.initiator.user.name || inv.initiator.user.email,
        createdAt: inv.createdAt,
      })),
    });

  } catch (error: any) {
    console.error('Error fetching investments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
