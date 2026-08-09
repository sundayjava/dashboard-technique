import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  allMembersConfirmed, 
  generateUniqueAccessToken, 
  hashAccessToken 
} from '@/lib/chain-account-utils';
import { sendEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { signingToken } = await request.json();

    if (!signingToken) {
      return NextResponse.json(
        { error: 'Signing token is required' },
        { status: 400 }
      );
    }

    // Find the member with this signing token
    const member = await prisma.chainAccountMember.findUnique({
      where: { signingToken },
      include: {
        chainAccount: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Invalid signing token' },
        { status: 404 }
      );
    }

    if (member.hasConfirmed) {
      return NextResponse.json(
        { error: 'You have already signed this memorandum' },
        { status: 400 }
      );
    }

    // Update member to confirmed
    await prisma.chainAccountMember.update({
      where: { id: member.id },
      data: {
        hasConfirmed: true,
        confirmedAt: new Date(),
        signingTokenUsed: true,
      },
    });

    // Get primary holder to notify
    const primaryHolder = await prisma.chainAccountMember.findFirst({
      where: {
        chainAccountId: member.chainAccountId,
        role: 'PRIMARY_HOLDER',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (primaryHolder) {
      // Notify primary holder
      await prisma.notification.create({
        data: {
          userId: primaryHolder.userId,
          type: 'SYSTEM',
          title: 'Chain Account Member Signed',
          message: `${member.user.name || member.user.email} has signed the Chain Account memorandum.`,
          isRead: false,
        },
      });
    }

    // Check if all members have now confirmed
    const allConfirmed = await allMembersConfirmed(member.chainAccountId);

    if (allConfirmed) {
      // ACTIVATION FLOW
      await activateChainAccount(member.chainAccountId);

      return NextResponse.json({
        success: true,
        message: 'Memorandum signed successfully. Chain Account activated!',
        allConfirmed: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Memorandum signed successfully',
      allConfirmed: false,
    });

  } catch (error) {
    console.error('Error signing memorandum:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function activateChainAccount(chainAccountId: string) {
  try {
    // 1. Update Chain Account status to ACTIVE
    await prisma.chainAccount.update({
      where: { id: chainAccountId },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
      },
    });

    // 2. Update Memorandum status to ACTIVE
    await prisma.chainAccountMemorandum.update({
      where: { chainAccountId },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
      },
    });

    // 3. Get all members
    const members = await prisma.chainAccountMember.findMany({
      where: { chainAccountId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        chainAccount: {
          select: {
            accountName: true,
            accountNumber: true,
          },
        },
      },
    });

    // Get Chain Account details for email
    const chainAccount = await prisma.chainAccount.findUnique({
      where: { id: chainAccountId },
      select: {
        accountName: true,
        accountNumber: true,
        authorizationModel: true,
        activatedAt: true,
      },
    });

    // 4. Generate and assign access tokens for each member
    for (const member of members) {
      const accessToken = await generateUniqueAccessToken();
      const hashedToken = await hashAccessToken(accessToken);

      await prisma.chainAccountMember.update({
        where: { id: member.id },
        data: {
          accessTokenHash: hashedToken,
          tokenGeneratedAt: new Date(),
        },
      });

      // 5. Send access token email to each member
      await sendAccessTokenEmail({
        to: member.user.email,
        name: member.user.name || 'User',
        accountName: member.chainAccount.accountName,
        accountNumber: member.chainAccount.accountNumber,
        accessToken,
        role: member.role,
        authorizationModel: chainAccount?.authorizationModel || 'INDEPENDENT',
        activatedAt: chainAccount?.activatedAt || new Date(),
        allMembers: members.map(m => ({
          name: m.user.name || m.user.email,
          role: m.role,
        })),
      });

      // 6. Create in-app notification with token
      await prisma.notification.create({
        data: {
          userId: member.userId,
          type: 'SYSTEM',
          title: 'Chain Account Access Token',
          message: `Your Chain Account "${member.chainAccount.accountName}" is now active. Your access token is: ${accessToken}. Keep this safe and do not share it with anyone.`,
          isRead: false,
        },
      });

      // 7. Create Chain Account notification
      await prisma.chainAccountNotification.create({
        data: {
          chainAccountId,
          userId: member.userId,
          type: 'ACCOUNT_ACTIVATED',
          title: 'Chain Account Activated',
          message: `Your Chain Account has been activated. You can now log in using your access token.`,
          isRead: false,
        },
      });
    }

    console.log(`✅ Chain Account ${chainAccountId} activated with ${members.length} members`);

  } catch (error) {
    console.error('Error activating Chain Account:', error);
    throw error;
  }
}

async function sendAccessTokenEmail(params: {
  to: string;
  name: string;
  accountName: string;
  accountNumber: string;
  accessToken: string;
  role: string;
  authorizationModel: string;
  activatedAt: Date;
  allMembers: Array<{ name: string; role: string }>;
}) {
  const { to, name, accountName, accountNumber, accessToken, role, authorizationModel, activatedAt, allMembers } = params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const authModelDisplay =
    authorizationModel === 'INDEPENDENT' ? 'Independent Authorization' :
    authorizationModel === 'THRESHOLD' ? 'Threshold Authorization' :
    authorizationModel === 'MAJORITY' ? 'Majority Authorization' :
    'Independent Authorization';

  const roleDisplay = role === 'PRIMARY_HOLDER' ? 'Primary Holder' : 'Co-Signatory';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Chain Account Active</title>
    </head>
    <body style="font-family: 'Courier New', monospace; line-height: 1.6; color: #1f2937; max-width: 700px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">

      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px; font-family: Arial, sans-serif;">🔐 ACREDIS FINANCE</h1>
        <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 14px; font-family: Arial, sans-serif;">Chain Account Activation Notice</p>
      </div>

      <!-- Main Content -->
      <div style="background: #ffffff; padding: 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">

        <p style="margin: 0 0 20px 0; font-size: 14px;">Dear <strong>${name}</strong>,</p>

        <p style="margin: 0 0 20px 0; font-size: 14px;">
          Great news — all parties have completed signing the Chain Account Memorandum of Agreement.
          Your Acredis Chain Account is now <strong>fully active</strong>.
        </p>

        <p style="margin: 0 0 25px 0; font-size: 14px;">
          Your personal access credentials are below. Please read through carefully before proceeding to your dashboard.
        </p>

        <!-- Chain Account Details Section -->
        <div style="background: #f3f4f6; border: 2px solid #d1d5db; padding: 20px; margin: 25px 0; border-radius: 4px;">
          <p style="margin: 0 0 15px 0; font-weight: bold; font-size: 12px; color: #374151; letter-spacing: 1px; text-align: center;">
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━<br>
            CHAIN ACCOUNT DETAILS<br>
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          </p>

          <table style="width: 100%; font-size: 13px; line-height: 1.8;">
            <tr>
              <td style="padding: 5px 0; color: #6b7280;"><strong>Account Name:</strong></td>
              <td style="padding: 5px 0; text-align: right; color: #111827;">${accountName}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #6b7280;"><strong>Chain Account ID:</strong></td>
              <td style="padding: 5px 0; text-align: right; color: #111827; font-weight: bold;">${accountNumber}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #6b7280;"><strong>Account Status:</strong></td>
              <td style="padding: 5px 0; text-align: right; color: #059669; font-weight: bold;">✅ ACTIVE</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #6b7280;"><strong>Activation Date:</strong></td>
              <td style="padding: 5px 0; text-align: right; color: #111827;">${activatedAt.toLocaleDateString()}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #6b7280;"><strong>Authorization Mode:</strong></td>
              <td style="padding: 5px 0; text-align: right; color: #111827;">${authModelDisplay}</td>
            </tr>
          </table>
        </div>

        <!-- Personal Signature Key Section -->
        <div style="background: #fef3c7; border: 3px solid #f59e0b; padding: 25px; margin: 25px 0; border-radius: 4px;">
          <p style="margin: 0 0 15px 0; font-weight: bold; font-size: 12px; color: #92400e; letter-spacing: 1px; text-align: center;">
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━<br>
            YOUR PERSONAL SIGNATURE KEY<br>
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          </p>

          <table style="width: 100%; font-size: 13px; line-height: 1.8; margin-bottom: 15px;">
            <tr>
              <td style="padding: 5px 0; color: #78350f;"><strong>Key Holder:</strong></td>
              <td style="padding: 5px 0; text-align: right; color: #78350f;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #78350f;"><strong>Role:</strong></td>
              <td style="padding: 5px 0; text-align: right; color: #78350f; font-weight: bold;">${roleDisplay}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 15px 0 5px 0; color: #78350f;"><strong>Signature Key:</strong></td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 0;">
                <div style="background: #fffbeb; border: 2px dashed #f59e0b; padding: 15px; text-align: center; border-radius: 4px;">
                  <p style="font-size: 20px; font-weight: bold; color: #78350f; margin: 0; letter-spacing: 2px; word-break: break-all;">
                    ${accessToken}
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #78350f;"><strong>Key Status:</strong></td>
              <td style="padding: 5px 0; text-align: right; color: #059669; font-weight: bold;">✅ ACTIVE</td>
            </tr>
          </table>

          <p style="margin: 15px 0 0 0; font-size: 12px; color: #92400e; line-height: 1.6;">
            This key is <strong>yours alone</strong>. It authorizes your activity on the Chain Account including deposits,
            withdrawals within your permitted threshold, investment plan enrollment, and account access.
            <strong>Keep it private at all times.</strong>
          </p>
        </div>

        <!-- Signatories Section -->
        <div style="background: #eff6ff; border: 2px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 4px;">
          <p style="margin: 0 0 15px 0; font-weight: bold; font-size: 12px; color: #1e40af; letter-spacing: 1px; text-align: center;">
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━<br>
            SIGNATORIES ON THIS ACCOUNT<br>
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          </p>

          <p style="margin: 0 0 10px 0; font-size: 12px; color: #1e40af;">
            The following parties are active on this Chain Account. Each has received their own separate signature key.
          </p>

          <ul style="list-style: none; padding: 0; margin: 10px 0 0 0; font-size: 13px; color: #1e3a8a;">
            ${allMembers.map(m => `
              <li style="padding: 5px 0;">
                <strong>${m.name}</strong> — ${m.role === 'PRIMARY_HOLDER' ? 'Primary Holder' : 'Co-Signatory'}
              </li>
            `).join('')}
          </ul>
        </div>

        <!-- Security Notice -->
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 25px 0;">
          <p style="margin: 0 0 15px 0; font-weight: bold; font-size: 12px; color: #991b1b; letter-spacing: 1px;">
            ⚠️ IMPORTANT SECURITY NOTICE<br>
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          </p>

          <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #991b1b; line-height: 1.7;">
            <li>Your signature key is <strong>strictly personal</strong> — do not share it with anyone, including other account signatories</li>
            <li>Acredis will <strong>NEVER</strong> request your signature key via email, phone, or chat</li>
            <li>If you suspect your key has been compromised, contact us immediately at <strong>support@acredis.com</strong></li>
            <li>To replace a lost key, you will be required to complete identity re-verification</li>
          </ul>
        </div>

        <!-- Next Steps -->
        <div style="background: #f9fafb; border: 2px solid #d1d5db; padding: 20px; margin: 25px 0; border-radius: 4px;">
          <p style="margin: 0 0 15px 0; font-weight: bold; font-size: 12px; color: #374151; letter-spacing: 1px;">
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━<br>
            NEXT STEPS<br>
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          </p>

          <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #374151; line-height: 1.8;">
            <li>Log in to your Acredis account at <strong>www.acredisfinance.com</strong></li>
            <li>Navigate to <strong>"Chain Accounts"</strong> on your dashboard</li>
            <li>Use your <strong>Signature Key</strong> to authenticate and begin activity</li>
          </ol>

          <p style="margin: 15px 0 0 0; font-size: 12px; color: #6b7280;">
            Your account manager is available should you need any assistance getting started.
          </p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${baseUrl}/dashboard" style="background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 14px; font-family: Arial, sans-serif;">
            Access Your Dashboard
          </a>
        </div>

        <p style="margin: 30px 0 0 0; font-size: 13px; color: #374151;">
          Warm regards,<br>
          <strong>Acredis Finance</strong><br>
          Platform Operations Team<br>
          <a href="mailto:support@acredis.com" style="color: #1e40af; text-decoration: none;">support@acredis.com</a> |
          <a href="https://www.acredis.com" style="color: #1e40af; text-decoration: none;">www.acredis.com</a>
        </p>
      </div>

      <!-- Footer -->
      <div style="background: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #374151;">
        <p style="color: #9ca3af; font-size: 11px; margin: 0; line-height: 1.6;">
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━<br>
          This is a secure automated notification from <strong>Acredis Finance</strong>.<br>
          Your Signature Key is confidential and time-stamped to your account activation.<br>
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        </p>
        <p style="color: #6b7280; font-size: 10px; margin: 10px 0 0 0;">
          © ${new Date().getFullYear()} Acredis Finance. All rights reserved. | United Arab Emirates
        </p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to,
    subject: '🔐 Your Acredis Chain Account Is Now Active — Your Account ID & Signature Key',
    html,
  });
}
