import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch all investments with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (userId) {
      where.userId = userId;
    }

    const investments = await prisma.investment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        plan: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ investments });
  } catch (error) {
    console.error('Error fetching investments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch investments' },
      { status: 500 }
    );
  }
}

// PUT - Update investment status
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, adminNote } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: 'Investment ID and status are required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'FAILED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Get investment with plan details
    const investment = await prisma.investment.findUnique({
      where: { id },
      include: {
        plan: true,
        user: true
      }
    });

    if (!investment) {
      return NextResponse.json(
        { error: 'Investment not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {
      status
    };

    let notificationMessage = '';
    let shouldCreditAccount = false;
    let shouldCreditInvestmentBalance = false;
    let amountToCredit = 0;
    let investmentBalanceAmount = 0;

    // Handle status-specific logic
    if (status === 'ACTIVE' && investment.status === 'PENDING') {
      // Activating investment - set start and end dates
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + (investment.plan.duration * 24 * 60 * 60 * 1000));
      updateData.startDate = startDate;
      updateData.endDate = endDate;
      notificationMessage = `Your investment of $${investment.amount} in ${investment.plan.planName} has been approved and is now active!`;
    } else if (status === 'COMPLETED') {
      // Completing investment - calculate profit and credit ONLY investmentBalance
      const profitEarned = investment.amount * (investment.plan.profitPercentage / 100);
      updateData.profitEarned = profitEarned;
      updateData.completedAt = new Date();
      shouldCreditInvestmentBalance = true;
      investmentBalanceAmount = investment.amount + profitEarned;
      notificationMessage = `Your investment of $${investment.amount} in ${investment.plan.planName} has been completed. Total return: $${investmentBalanceAmount.toFixed(2)} (Profit: $${profitEarned.toFixed(2)}) has been added to your investment balance.`;
    } else if (status === 'CANCELLED' || status === 'FAILED') {
      // Refund the investment amount to main account
      shouldCreditAccount = true;
      amountToCredit = investment.amount;
      notificationMessage = `Your investment of $${investment.amount} in ${investment.plan.planName} has been ${status.toLowerCase()}. Amount refunded to your account.`;
    } else {
      notificationMessage = `Your investment status has been updated to ${status}.`;
    }

    // Perform transaction
    await prisma.$transaction(async (tx) => {
      // Update investment
      await tx.investment.update({
        where: { id },
        data: updateData
      });

      // Credit main account if needed (for refunds only)
      if (shouldCreditAccount) {
        const account = await tx.account.findFirst({
          where: {
            userId: investment.userId,
            status: 'ACTIVE'
          }
        });

        if (account) {
          await tx.account.update({
            where: { id: account.id },
            data: {
              balance: {
                increment: amountToCredit
              }
            }
          });

          // Create transaction record
          const newBalance = account.balance + amountToCredit;
          await tx.transaction.create({
            data: {
              userId: investment.userId,
              accountId: account.id,
              transactionType: 'REFUND',
              amount: amountToCredit,
              balanceAfter: newBalance,
              currency: account.currency,
              status: 'COMPLETED',
              description: `Refund for ${status.toLowerCase()} investment in ${investment.plan.planName}`,
              reference: `INV-${status}-${Date.now()}`
            }
          });
        }
      }

      // Update user's investmentBalance when investment is completed (NOT main account)
      if (shouldCreditInvestmentBalance) {
        await tx.user.update({
          where: { id: investment.userId },
          data: {
            investmentBalance: {
              increment: investmentBalanceAmount
            }
          }
        });
      }

      // Create notification
      await tx.notification.create({
        data: {
          userId: investment.userId,
          type: 'INVESTMENT',
          title: `Investment ${status}`,
          message: adminNote ? `${notificationMessage}\n\nAdmin Note: ${adminNote}` : notificationMessage,
          link: '/investment/my-investments'
        }
      });

      // Create activity log
      await tx.activityLog.create({
        data: {
          userId: investment.userId,
          action: `Investment ${status}`,
          description: `Investment in ${investment.plan.planName} - Amount: $${investment.amount} - Status changed to ${status}`,
          ipAddress: '0.0.0.0'
        }
      });
    });

    // Fetch updated investment
    const updatedInvestment = await prisma.investment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        plan: true
      }
    });

    return NextResponse.json({
      message: 'Investment status updated successfully',
      investment: updatedInvestment
    });

  } catch (error) {
    console.error('Error updating investment:', error);
    return NextResponse.json(
      { error: 'Failed to update investment status' },
      { status: 500 }
    );
  }
}

// DELETE - Delete an investment
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Investment ID is required' },
        { status: 400 }
      );
    }

    // Get investment to verify it exists and is completed
    const investment = await prisma.investment.findUnique({
      where: { id },
      include: { plan: true, user: true }
    });

    if (!investment) {
      return NextResponse.json(
        { error: 'Investment not found' },
        { status: 404 }
      );
    }

    // Only allow deletion of completed investments
    if (investment.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Only completed investments can be deleted' },
        { status: 400 }
      );
    }

    // Delete the investment
    await prisma.investment.delete({
      where: { id }
    });

    return NextResponse.json({
      message: 'Investment deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting investment:', error);
    return NextResponse.json(
      { error: 'Failed to delete investment' },
      { status: 500 }
    );
  }
}
