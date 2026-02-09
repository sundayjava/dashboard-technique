import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch all user holdings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('adminId');
    const tokenId = searchParams.get('tokenId');
    const status = searchParams.get('status');

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }

    // Verify admin
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const whereClause: any = {};
    if (tokenId) whereClause.tokenId = tokenId;
    if (status) whereClause.status = status;

    const holdings = await prisma.userHolding.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            accounts: {
              select: {
                currency: true,
              },
              take: 1,
            },
          },
        },
        token: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate total statistics
    const stats = {
      totalHoldings: holdings.length,
      activeHoldings: holdings.filter(h => h.status === 'ACTIVE').length,
      totalValue: holdings
        .filter(h => h.status === 'ACTIVE')
        .reduce((sum, h) => sum + h.currentValue, 0),
      totalInterest: holdings
        .filter(h => h.status === 'ACTIVE')
        .reduce((sum, h) => sum + h.interestEarned, 0),
    };

    return NextResponse.json({ holdings, stats });
  } catch (error) {
    console.error('Error fetching user holdings:', error);
    return NextResponse.json({ error: 'Failed to fetch holdings' }, { status: 500 });
  }
}

// PATCH - Update user holding (admin)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminId, holdingId, status, interestEarned } = body;

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }

    // Verify admin
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!holdingId) {
      return NextResponse.json({ error: 'Holding ID is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (interestEarned !== undefined) updateData.interestEarned = parseFloat(interestEarned);

    const holding = await prisma.userHolding.update({
      where: { id: holdingId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        token: true,
      },
    });

    return NextResponse.json({ message: 'Holding updated successfully', holding });
  } catch (error) {
    console.error('Error updating user holding:', error);
    return NextResponse.json({ error: 'Failed to update holding' }, { status: 500 });
  }
}

// PUT - Full update of user holding (admin)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminId, holdingId, depositedAmount, tokenAmount, currentValue, interestEarned, status } = body;

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }

    // Verify admin
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!holdingId) {
      return NextResponse.json({ error: 'Holding ID is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (depositedAmount !== undefined) updateData.depositedAmount = parseFloat(depositedAmount);
    if (tokenAmount !== undefined) updateData.tokenAmount = parseFloat(tokenAmount);
    if (currentValue !== undefined) updateData.currentValue = parseFloat(currentValue);
    if (interestEarned !== undefined) updateData.interestEarned = parseFloat(interestEarned);
    if (status !== undefined) updateData.status = status;

    const holding = await prisma.userHolding.update({
      where: { id: holdingId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        token: true,
      },
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: holding.userId,
        title: 'Holding Updated',
        message: `Your ${holding.token.name} holding has been updated by an administrator.`,
        type: 'SYSTEM',
      },
    });

    return NextResponse.json({ message: 'Holding updated successfully', holding });
  } catch (error) {
    console.error('Error updating user holding:', error);
    return NextResponse.json({ error: 'Failed to update holding' }, { status: 500 });
  }
}

// DELETE - Delete user holding (admin)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('adminId');
    const holdingId = searchParams.get('holdingId');

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }

    // Verify admin
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!holdingId) {
      return NextResponse.json({ error: 'Holding ID is required' }, { status: 400 });
    }

    // Get holding details before deletion
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

    // If active, refund to user's account
    if (holding.status === 'ACTIVE' || holding.status === 'PENDING') {
      const userAccount = await prisma.account.findFirst({
        where: { userId: holding.userId },
      });

      if (userAccount) {
        // For ACTIVE holdings, refund current value + interest
        // For PENDING holdings, refund deposited amount only
        const refundAmount = holding.status === 'ACTIVE' 
          ? holding.currentValue + holding.interestEarned 
          : holding.depositedAmount;
        
        const updatedAccount = await prisma.account.update({
          where: { id: userAccount.id },
          data: {
            balance: {
              increment: refundAmount,
            },
          },
        });

        // Create transaction record
        const reference = `HLD-REF-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        await prisma.transaction.create({
          data: {
            userId: holding.userId,
            accountId: userAccount.id,
            transactionType: 'REFUND',
            amount: refundAmount,
            balanceAfter: updatedAccount.balance,
            currency: userAccount.currency,
            status: 'COMPLETED',
            description: `Holding refund: ${holding.tokenAmount.toFixed(8)} ${holding.token.symbol}${holding.status === 'ACTIVE' ? ' + interest' : ''}`,
            reference,
          },
        });
      }
    }

    await prisma.userHolding.delete({
      where: { id: holdingId },
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: holding.userId,
        title: 'Holding Deleted',
        message: `Your ${holding.tokenAmount.toFixed(8)} ${holding.token.symbol} holding has been deleted by an administrator.${holding.status === 'ACTIVE' || holding.status === 'PENDING' ? ' The amount has been refunded to your account.' : ''}`,
        type: 'SYSTEM',
      },
    });

    return NextResponse.json({ message: 'Holding deleted successfully' });
  } catch (error) {
    console.error('Error deleting user holding:', error);
    return NextResponse.json({ error: 'Failed to delete holding' }, { status: 500 });
  }
}
