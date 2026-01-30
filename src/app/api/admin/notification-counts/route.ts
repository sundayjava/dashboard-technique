import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get counts for various admin notifications
    const [
      newUsersCount,
      pendingHoldingsCount,
      unreadMessagesCount,
      pendingContactMessagesCount,
      pendingInvestmentDepositsCount,
      pendingLoansCount,
      pendingCardsCount
    ] = await Promise.all([
      // New users (registered in last 24 hours)
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),

      // Pending holdings
      prisma.userHolding.count({
        where: {
          status: 'PENDING'
        }
      }),

      // Unread messages (count messages where user is not the sender)
      prisma.message.count({
        where: {
          isRead: false
        }
      }),

      // Pending contact messages (support requests)
      prisma.contactMessage.count({
        where: {
          status: 'PENDING'
        }
      }).catch(() => 0),

      // Pending investment deposits (crypto deposits awaiting confirmation)
      prisma.investmentTransaction.count({
        where: {
          transactionType: 'DEPOSIT',
          status: 'PENDING'
        }
      }).catch(() => 0),

      // Pending loan applications
      prisma.loan.count({
        where: {
          status: 'PENDING'
        }
      }).catch(() => 0),

      // Pending card applications
      prisma.cardApplication.count({
        where: {
          status: 'PENDING'
        }
      }).catch(() => 0)
    ]);

    return NextResponse.json({
      success: true,
      counts: {
        newUsers: newUsersCount,
        pendingHoldings: pendingHoldingsCount,
        messages: unreadMessagesCount,
        support: pendingContactMessagesCount,
        investmentDeposits: pendingInvestmentDepositsCount,
        loans: pendingLoansCount,
        cards: pendingCardsCount,
        // Total finance items
        finance: pendingHoldingsCount + pendingInvestmentDepositsCount,
        // Total management items
        management: pendingLoansCount + pendingCardsCount
      }
    });
  } catch (error) {
    console.error('Error fetching notification counts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notification counts' },
      { status: 500 }
    );
  }
}
