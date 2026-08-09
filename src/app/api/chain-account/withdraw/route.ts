import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyChainAccountToken } from '@/lib/chain-account-session';
import { requiresApproval as checkApprovalNeeded, generateSigningToken } from '@/lib/chain-account-utils';
import { sendEmail } from '@/lib/email';

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

    // Check if approval is required
    const needsApproval = await checkApprovalNeeded(
      chainAccountId,
      totalAmount
    );

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

    // Every withdrawal reserves the funds up front and always ends with an
    // admin approval step before wallets are credited. Co-owner approval
    // (email vote) only gates the move into that admin queue.
    const withdrawal = await prisma.$transaction(async (tx) => {
      const created = await tx.chainAccountWithdrawal.create({
        data: {
          chainAccountId,
          initiatedBy: member.id,
          reference: withdrawalReference,
          totalAmount,
          currency,
          distribution: distributions,
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
              approvalToken: generateSigningToken(),
            },
          });
        }
      }

      return created;
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (needsApproval) {
      // Notify + email every other member for their approval, showing their share (equity) of the withdrawal
      const approvals = await prisma.chainAccountApproval.findMany({
        where: { chainAccountId, actionType: 'WITHDRAWAL', actionId: withdrawal.id },
      });

      for (const m of otherMembers) {
        const approval = approvals.find(a => a.memberId === m.id);
        const memberDistribution = distributions.find((d: any) => d.memberId === m.id);

        await prisma.chainAccountNotification.create({
          data: {
            chainAccountId,
            userId: m.userId,
            type: 'APPROVAL_REQUEST',
            title: 'Withdrawal Approval Required',
            message: `${initiatorName} initiated a withdrawal of $${totalAmount.toLocaleString()}. Please check your email to approve or reject.`,
            isRead: false,
            actionType: 'WITHDRAWAL',
            actionId: withdrawal.id,
          },
        });

        if (approval) {
          await sendWithdrawalApprovalEmail({
            to: m.user.email,
            recipientName: m.user.name || m.user.email,
            initiatorName,
            accountName: chainAccount.accountName,
            accountNumber: chainAccount.accountNumber,
            totalAmount,
            currency,
            memberAmount: memberDistribution?.amount || 0,
            approvalToken: approval.approvalToken!,
            baseUrl,
          });
        }
      }
    } else {
      // Below threshold - no approval needed, but every co-owner still gets
      // full visibility that money is moving before admin reviews it.
      for (const m of otherMembers) {
        const memberDistribution = distributions.find((d: any) => d.memberId === m.id);

        await prisma.chainAccountNotification.create({
          data: {
            chainAccountId,
            userId: m.userId,
            type: 'GENERAL',
            title: 'Withdrawal Initiated',
            message: `${initiatorName} initiated a withdrawal of $${totalAmount.toLocaleString()} (your share: $${(memberDistribution?.amount || 0).toLocaleString()}). This is below the approval threshold and is awaiting admin review.`,
            isRead: false,
            actionType: 'WITHDRAWAL',
            actionId: withdrawal.id,
          },
        });

        await sendWithdrawalInitiatedEmail({
          to: m.user.email,
          recipientName: m.user.name || m.user.email,
          initiatorName,
          accountName: chainAccount.accountName,
          accountNumber: chainAccount.accountNumber,
          totalAmount,
          currency,
          memberAmount: memberDistribution?.amount || 0,
          baseUrl,
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

// Email notification helper - sent to each co-owner whose approval is needed
async function sendWithdrawalApprovalEmail(params: {
  to: string;
  recipientName: string;
  initiatorName: string;
  accountName: string;
  accountNumber: string;
  totalAmount: number;
  currency: string;
  memberAmount: number;
  approvalToken: string;
  baseUrl: string;
}) {
  const {
    to,
    recipientName,
    initiatorName,
    accountName,
    accountNumber,
    totalAmount,
    currency,
    memberAmount,
    approvalToken,
    baseUrl,
  } = params;

  const reviewLink = `${baseUrl}/chain-account/approve-withdrawal?token=${approvalToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Withdrawal Approval Required</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Acredis Finance</h1>
        <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0;">Chain Account Withdrawal Approval</p>
      </div>

      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <h2 style="color: #333; margin-top: 0;">Action Required: Approve Withdrawal</h2>

        <p>Dear ${recipientName},</p>

        <p><strong>${initiatorName}</strong> has initiated a withdrawal from your Chain Account <strong>${accountName}</strong>. Your approval is required before it can proceed.</p>

        <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #ea580c; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #ea580c;">Withdrawal Details</h3>
          <p style="margin: 5px 0;"><strong>Account:</strong> ${accountName} (${accountNumber})</p>
          <p style="margin: 5px 0;"><strong>Total Withdrawal Amount:</strong> ${currency} ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p style="margin: 5px 0;"><strong>Your Share:</strong> ${currency} ${memberAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>

        <p>This withdrawal will only move forward once <strong>all</strong> account members approve. It then goes to Acredis for final admin approval before funds are credited to each member's personal wallet.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${reviewLink}" style="background: #ea580c; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Review Withdrawal Request
          </a>
        </div>

        <p style="color: #666; font-size: 14px;">
          Or copy and paste this link into your browser:<br>
          <a href="${reviewLink}" style="color: #ea580c; word-break: break-all;">${reviewLink}</a>
        </p>

        <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
          <p style="margin: 0; color: #856404;">
            <strong>Note:</strong> If you did not expect this request or do not recognize this activity, reject it and contact support immediately.
          </p>
        </div>
      </div>

      <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="color: #666; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} Acredis Finance. All rights reserved.<br>
          United Arab Emirates
        </p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to,
    subject: `Action Required — Approve Withdrawal on ${accountName}`,
    html,
  });
}

// Email notification helper - sent to co-owners for below-threshold withdrawals
// that don't require their approval, so they still have full visibility.
async function sendWithdrawalInitiatedEmail(params: {
  to: string;
  recipientName: string;
  initiatorName: string;
  accountName: string;
  accountNumber: string;
  totalAmount: number;
  currency: string;
  memberAmount: number;
  baseUrl: string;
}) {
  const {
    to,
    recipientName,
    initiatorName,
    accountName,
    accountNumber,
    totalAmount,
    currency,
    memberAmount,
    baseUrl,
  } = params;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Withdrawal Initiated</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Acredis Finance</h1>
        <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0;">Chain Account Withdrawal Notice</p>
      </div>

      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <h2 style="color: #333; margin-top: 0;">A Withdrawal Was Initiated on Your Account</h2>

        <p>Dear ${recipientName},</p>

        <p><strong>${initiatorName}</strong> has initiated a withdrawal from your Chain Account <strong>${accountName}</strong>. This amount is below the account's approval threshold, so it does not require your approval — it will proceed once Acredis completes its final admin review.</p>

        <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #1e40af; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e40af;">Withdrawal Details</h3>
          <p style="margin: 5px 0;"><strong>Account:</strong> ${accountName} (${accountNumber})</p>
          <p style="margin: 5px 0;"><strong>Total Withdrawal Amount:</strong> ${currency} ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p style="margin: 5px 0;"><strong>Your Share:</strong> ${currency} ${memberAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>

        <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
          <p style="margin: 0; color: #856404;">
            <strong>Note:</strong> If you did not expect this or do not recognize this activity, contact support immediately.
          </p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${baseUrl}/chain-account/dashboard" style="background: #1e40af; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            View Chain Account
          </a>
        </div>
      </div>

      <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="color: #666; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} Acredis Finance. All rights reserved.<br>
          United Arab Emirates
        </p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to,
    subject: `Withdrawal Initiated on ${accountName}`,
    html,
  });
}
