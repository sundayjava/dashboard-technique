import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyChainAccountToken } from '@/lib/chain-account-session';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const chainAccountId = searchParams.get('chainAccountId');

    if (!chainAccountId) {
      return NextResponse.json(
        { error: 'Chain Account ID is required' },
        { status: 400 }
      );
    }

    // Debug logging
    console.log('Chain Account Dashboard Request:');
    console.log('  Session:', JSON.stringify(session, null, 2));
    console.log('  Session chainAccountId:', session.chainAccountId, '(type:', typeof session.chainAccountId, ')');
    console.log('  Requested chainAccountId:', chainAccountId, '(type:', typeof chainAccountId, ')');
    console.log('  Strict equality match:', session.chainAccountId === chainAccountId);
    console.log('  Loose equality match:', session.chainAccountId == chainAccountId);

    // Verify user has access to this Chain Account
    if (session.chainAccountId !== chainAccountId) {
      console.error('Access denied: chainAccountId mismatch');
      console.error('  Session value:', session.chainAccountId);
      console.error('  Requested value:', chainAccountId);
      console.error('  Full session object:', session);
      return NextResponse.json(
        {
          error: 'Access denied - Chain Account ID mismatch',
          details: {
            sessionChainAccountId: session.chainAccountId,
            requestedChainAccountId: chainAccountId,
            sessionType: typeof session.chainAccountId,
            requestedType: typeof chainAccountId
          }
        },
        { status: 403 }
      );
    }

    // Fetch Chain Account data
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
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!chainAccount) {
      return NextResponse.json(
        { error: 'Chain Account not found' },
        { status: 404 }
      );
    }

    // Get current member
    const currentMember = chainAccount.members.find(m => m.id === session.memberId);

    if (!currentMember) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Fetch deposits
    const deposits = await prisma.chainAccountDeposit.findMany({
      where: { chainAccountId },
      orderBy: { createdAt: 'desc' },
    });

    const totalDeposits = deposits
      .filter(d => d.status === 'CONFIRMED')
      .reduce((sum, d) => sum + d.amount, 0);

    // Fetch investments
    const investments = await prisma.chainAccountInvestment.findMany({
      where: { chainAccountId },
      orderBy: { createdAt: 'desc' },
    });

    const totalInvestments = investments
      .filter(i => i.status === 'ACTIVE')
      .reduce((sum, i) => sum + i.amount, 0);

    const activeInvestments = investments.filter(i => i.status === 'ACTIVE').length;

    // Fetch withdrawals
    const withdrawals = await prisma.chainAccountWithdrawal.findMany({
      where: { chainAccountId },
      orderBy: { createdAt: 'desc' },
    });

    const totalWithdrawals = withdrawals
      .filter(w => w.status === 'COMPLETED')
      .reduce((sum, w) => sum + w.totalAmount, 0);

    // Fetch pending approvals (for this member)
    const pendingApprovals = await prisma.chainAccountApproval.findMany({
      where: {
        memberId: currentMember.id,
        status: 'PENDING',
      },
    });

    // Fetch recent transactions
    const transactions = await prisma.chainAccountTransaction.findMany({
      where: { chainAccountId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Fetch notifications for the current user only (to avoid duplicates)
    const notifications = await prisma.chainAccountNotification.findMany({
      where: {
        chainAccountId,
        userId: session.userId, // Only fetch notifications for this specific user
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      data: {
        chainAccount: {
          id: chainAccount.id,
          accountName: chainAccount.accountName,
          accountNumber: chainAccount.accountNumber,
          balance: chainAccount.balance,
          currency: chainAccount.currency,
          investmentBalance: totalInvestments, // Calculate from active investments
          status: chainAccount.status,
          authorizationModel: chainAccount.authorizationModel,
          thresholdAmount: chainAccount.thresholdAmount,
          thresholdCurrency: chainAccount.thresholdCurrency,
          primaryPurpose: chainAccount.primaryPurpose,
          purposeDescription: chainAccount.purposeDescription,
          cryptoDepositAddress: chainAccount.cryptoDepositAddress,
          cryptoNetwork: chainAccount.cryptoNetwork,
          cryptoToken: chainAccount.cryptoToken,
        },
        member: {
          id: currentMember.id,
          role: currentMember.role,
          hasConfirmed: currentMember.hasConfirmed,
        },
        members: chainAccount.members.map(m => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          hasConfirmed: m.hasConfirmed,
          user: {
            name: m.user.name,
            email: m.user.email,
          },
        })),
        stats: {
          totalDeposits,
          totalInvestments,
          totalWithdrawals,
          activeInvestments,
          pendingApprovals: pendingApprovals.length,
        },
        recentTransactions: transactions.map(tx => ({
          id: tx.id,
          type: tx.transactionType,
          amount: tx.amount,
          currency: tx.currency,
          description: tx.description,
          createdAt: tx.createdAt.toISOString(),
        })),
        notifications: notifications.map(n => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          isRead: n.isRead,
          createdAt: n.createdAt.toISOString(),
        })),
      },
    });

  } catch (error: any) {
    console.error('Error fetching Chain Account dashboard:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
