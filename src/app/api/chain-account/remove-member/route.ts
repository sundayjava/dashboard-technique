import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('X-Chain-Access-Token');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { chainAccountId, targetMemberId, reason } = await request.json();

    if (!chainAccountId || !targetMemberId || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get the session member (initiator)
    const sessionData = await prisma.chainAccountMember.findFirst({
      where: {
        chainAccountId,
        accessTokenHash: { not: null }
      },
      include: {
        chainAccount: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });

    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 401 }
      );
    }

    // Get target member details
    const targetMember = await prisma.chainAccountMember.findUnique({
      where: { id: targetMemberId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });

    if (!targetMember) {
      return NextResponse.json(
        { error: 'Target member not found' },
        { status: 404 }
      );
    }

    // Cannot remove yourself
    if (sessionData.id === targetMemberId) {
      return NextResponse.json(
        { error: 'You cannot remove yourself from the account' },
        { status: 400 }
      );
    }

    // Generate reference
    const reference = `REM-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create removal request
    const removalRequest = await prisma.chainAccountRemovalRequest.create({
      data: {
        chainAccountId,
        initiatedBy: sessionData.id,
        targetMemberId,
        reason,
        reference,
        status: 'PENDING_TARGET_APPROVAL',
      }
    });

    // Send email to target member
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const approvalLink = `${baseUrl}/chain-account/approve-removal?ref=${reference}`;

    await sendRemovalRequestEmail({
      to: targetMember.user.email,
      name: targetMember.user.name || 'User',
      accountName: sessionData.chainAccount.accountName,
      initiatorName: sessionData.user.name || 'A member',
      reason,
      approvalLink,
    });

    // Create notification for target
    await prisma.chainAccountNotification.create({
      data: {
        chainAccountId,
        userId: targetMember.userId,
        type: 'REMOVAL_REQUEST',
        title: 'Removal Request',
        message: `You have been requested to be removed from ${sessionData.chainAccount.accountName}. Please check your email to approve or reject.`,
        isRead: false,
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Removal request sent. Waiting for target member approval.',
      reference,
    });

  } catch (error: any) {
    console.error('Error creating removal request:', error);
    return NextResponse.json(
      { error: 'Failed to create removal request' },
      { status: 500 }
    );
  }
}

async function sendRemovalRequestEmail(params: {
  to: string;
  name: string;
  accountName: string;
  initiatorName: string;
  reason: string;
  approvalLink: string;
}) {
  const { to, name, accountName, initiatorName, reason, approvalLink } = params;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Chain Account Removal Request</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Acredis Finance</h1>
        <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0;">Chain Account Removal Request</p>
      </div>

      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <h2 style="color: #333; margin-top: 0;">Action Required: Approve Your Removal</h2>

        <p>Dear ${name},</p>

        <p>${initiatorName} has requested to remove you from the Chain Account <strong>"${accountName}"</strong>.</p>

        <div style="background: #fef3c7; padding: 20px; border-left: 4px solid #f59e0b; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #92400e;">Reason for Removal</h3>
          <p style="margin: 0; color: #78350f;">${reason}</p>
        </div>

        <p><strong>Important:</strong> This removal requires your approval. If you approve, you will no longer have access to this Chain Account.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${approvalLink}" style="background: #f59e0b; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Review Removal Request
          </a>
        </div>

        <p style="color: #666; font-size: 14px;">
          Or copy and paste this link into your browser:<br>
          <a href="${approvalLink}" style="color: #f59e0b; word-break: break-all;">${approvalLink}</a>
        </p>

        <div style="background: #fee2e2; padding: 15px; border-left: 4px solid #dc2626; margin: 20px 0;">
          <p style="margin: 0; color: #991b1b;">
            <strong>Note:</strong> If you do not approve this removal, the request will be cancelled.
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
    subject: `Chain Account Removal Request - ${accountName}`,
    html,
  });
}
