import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Approve or reject holding
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

    // Verify admin
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get holding
    const holding = await prisma.userHolding.findUnique({
      where: { id: holdingId },
      include: {
        user: true,
        token: true,
      },
    });

    if (!holding) {
      return NextResponse.json({ error: 'Holding not found' }, { status: 404 });
    }

    if (holding.status !== 'PENDING') {
      return NextResponse.json({ error: 'Holding is not pending' }, { status: 400 });
    }

    if (action === 'APPROVE') {
      // Recalculate tokenAmount based on CURRENT token price at approval time
      // This prevents price risk during pending period
      const currentTokenAmount = holding.currentValue > 0 && holding.token.currentPrice > 0
        ? holding.currentValue / holding.token.currentPrice
        : holding.tokenAmount;

      console.log(`[Approve Holding] Original token amount: ${holding.tokenAmount} ${holding.token.symbol}`);
      console.log(`[Approve Holding] Current token price: ${holding.token.currentPrice} USD`);
      console.log(`[Approve Holding] Recalculated token amount: ${currentTokenAmount} ${holding.token.symbol}`);
      console.log(`[Approve Holding] USD value: ${holding.currentValue} USD`);

      // Approve holding with optional admin edits
      const updatedHolding = await prisma.userHolding.update({
        where: { id: holdingId },
        data: {
          status: 'ACTIVE',
          depositedAmount: depositedAmount !== undefined ? parseFloat(depositedAmount) : holding.depositedAmount,
          tokenAmount: tokenAmount !== undefined ? parseFloat(tokenAmount) : currentTokenAmount, // Use recalculated amount
          currentValue: currentValue !== undefined ? parseFloat(currentValue) : holding.currentValue,
          interestEarned: interestEarned !== undefined ? parseFloat(interestEarned) : holding.interestEarned,
          processedBy: adminId,
          processedAt: new Date(),
          adminNotes: adminNotes || null,
        },
        include: {
          token: true,
        },
      });

      // Create notification for user
      await prisma.notification.create({
        data: {
          userId: holding.userId,
          type: 'TRANSACTION',
          title: 'Holding Approved',
          message: `Your ${holding.token.name} holding of ${holding.depositedAmount.toFixed(2)} has been approved and is now active.`,
          link: '/dashboard',
        },
      });

      return NextResponse.json({
        message: 'Holding approved successfully',
        holding: updatedHolding,
      });
    } else if (action === 'REJECT') {
      // Reject holding and refund amount
      const account = await prisma.account.findFirst({
        where: { userId: holding.userId },
      });

      if (!account) {
        return NextResponse.json({ error: 'User account not found' }, { status: 404 });
      }

      await prisma.$transaction(async (tx) => {
        // Refund to account
        const updatedAccount = await tx.account.update({
          where: { id: account.id },
          data: {
            balance: {
              increment: holding.depositedAmount,
            },
          },
        });

        // Create refund transaction
        const reference = `HLD-REJ-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        await tx.transaction.create({
          data: {
            userId: holding.userId,
            accountId: account.id,
            transactionType: 'REFUND',
            amount: holding.depositedAmount,
            balanceAfter: updatedAccount.balance,
            currency: account.currency,
            status: 'COMPLETED',
            description: `Holding request rejected: ${holding.tokenAmount.toFixed(8)} ${holding.token.symbol}`,
            reference,
            adminNotes: adminNotes || 'Holding request rejected',
          },
        });

        // Update holding status
        await tx.userHolding.update({
          where: { id: holdingId },
          data: {
            status: 'REJECTED',
            processedBy: adminId,
            processedAt: new Date(),
            adminNotes: adminNotes || null,
          },
        });

        // Create notification for user
        await tx.notification.create({
          data: {
            userId: holding.userId,
            type: 'TRANSACTION',
            title: 'Holding Rejected',
            message: `Your ${holding.token.name} holding request has been rejected. Amount refunded to your account.`,
            link: '/dashboard',
          },
        });
      });

      return NextResponse.json({
        message: 'Holding rejected and amount refunded',
      });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing holding:', error);
    return NextResponse.json({ error: 'Failed to process holding' }, { status: 500 });
  }
}
