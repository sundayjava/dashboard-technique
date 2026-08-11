import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get Chain Account Details (Admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const account = await prisma.chainAccount.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                authorizationCode: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        deposits: {
          include: {
            initiator: {
              include: {
                user: {
                  select: {
                    name: true,
                    email: true
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        investments: {
          include: {
            plan: {
              select: {
                planName: true,
                profitPercentage: true
              }
            },
            initiator: {
              include: {
                user: {
                  select: {
                    name: true,
                    email: true
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        withdrawals: {
          include: {
            initiator: {
              include: {
                user: {
                  select: {
                    name: true,
                    email: true
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        transactions: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        notifications: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 50
        }
      }
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Chain Account not found' },
        { status: 404 }
      );
    }

    const investmentBalance = account.investments
      .filter((investment: any) => investment.status === 'ACTIVE')
      .reduce((sum: number, investment: any) => sum + investment.amount, 0);

    // Transform the response to match frontend expectations
    const transformedAccount = {
      ...account,
      investmentBalance,
      deposits: account.deposits.map((deposit: any) => ({
        ...deposit,
        depositMethod: deposit.method,
        depositedBy: deposit.initiator.user,
        initiator: undefined,
        method: undefined
      })),
      investments: account.investments.map((investment: any) => {
        const expectedReturn = investment.amount * (investment.plan.profitPercentage / 100);
        const closeRequester = investment.closeRequestedBy
          ? account.members.find((m: any) => m.id === investment.closeRequestedBy)
          : null;
        return {
          ...investment,
          expectedReturn,
          maturityDate: investment.endDate,
          initiatedBy: investment.initiator.user,
          closeRequestedByUser: closeRequester?.user || null,
          initiator: undefined,
          endDate: undefined
        };
      }),
      withdrawals: account.withdrawals.map((withdrawal: any) => ({
        ...withdrawal,
        amount: withdrawal.totalAmount,
        memberDistributions: withdrawal.distribution,
        initiatedBy: withdrawal.initiator.user,
        initiator: undefined,
        totalAmount: undefined,
        distribution: undefined
      })),
      transactions: await Promise.all(account.transactions.map(async (txn: any) => {
        // Fetch user info if relatedUserId exists
        let initiatedBy = null;
        if (txn.relatedUserId) {
          const user = await prisma.user.findUnique({
            where: { id: txn.relatedUserId },
            select: { name: true, email: true }
          });
          initiatedBy = user;
        }
        return {
          ...txn,
          status: 'COMPLETED', // Transactions don't have status, default to COMPLETED
          initiatedBy
        };
      }))
    };

    return NextResponse.json({ account: transformedAccount });
  } catch (error) {
    console.error('Error fetching chain account details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chain account details' },
      { status: 500 }
    );
  }
}
