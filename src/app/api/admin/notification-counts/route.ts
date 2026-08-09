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
      pendingSupportRequestsCount,
      pendingInvestmentDepositsCount,
      pendingLoansCount,
      pendingCardsCount,
      pendingWithdrawalsCount,
      pendingTransactionsCount,
      pendingChainRemovalCount,
      pendingChainModificationCount,
      pendingChainClosureCount
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

      // Pending support requests
      prisma.supportRequest.count({
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
      }).catch(() => 0),

      // Pending withdrawals
      prisma.withdrawal.count({
        where: {
          status: 'PENDING'
        }
      }).catch(() => 0),

      // Pending transactions
      prisma.transaction.count({
        where: {
          status: 'PENDING'
        }
      }).catch(() => 0),

      // Chain Account member removal requests awaiting admin sign-off
      prisma.chainAccountRemovalRequest.count({
        where: {
          status: 'PENDING_ADMIN'
        }
      }).catch(() => 0),

      // Chain Account modification requests awaiting admin sign-off
      prisma.chainAccountModificationRequest.count({
        where: {
          status: 'PENDING_ADMIN'
        }
      }).catch(() => 0),

      // Chain Account closure requests awaiting admin sign-off
      prisma.chainAccountClosureRequest.count({
        where: {
          status: 'PENDING_ADMIN'
        }
      }).catch(() => 0)
    ]);

    return NextResponse.json({
      success: true,
      counts: {
        newUsers: newUsersCount,
        pendingHoldings: pendingHoldingsCount,
        pendingWithdrawals: pendingWithdrawalsCount,
        pendingTransactions: pendingTransactionsCount,
        messages: unreadMessagesCount,
        support: pendingContactMessagesCount + pendingSupportRequestsCount,
        investmentDeposits: pendingInvestmentDepositsCount,
        loans: pendingLoansCount,
        cards: pendingCardsCount,
        // Total finance items (withdrawals + holdings + investment deposits + general transactions)
        finance: pendingWithdrawalsCount + pendingHoldingsCount + pendingInvestmentDepositsCount + pendingTransactionsCount,
        // Total management items (loans + cards)
        management: pendingLoansCount + pendingCardsCount,
        // Chain Account requests awaiting final admin approval
        chainAccountRequests: pendingChainRemovalCount + pendingChainModificationCount + pendingChainClosureCount
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
