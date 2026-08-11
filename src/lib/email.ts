import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_SERVER_PORT || '587'),
  secure: process.env.EMAIL_SERVER_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_SERVER_AUTH_USER,
    pass: process.env.EMAIL_SERVER_AUTH_PASSWORD,
  },
});

export async function sendEmail({ to, subject, html, text }: EmailOptions) {
  try {
    // If no SMTP configuration, throw error instead of just logging
    if (!process.env.EMAIL_SERVER_AUTH_USER || !process.env.EMAIL_SERVER_AUTH_PASSWORD) {
      console.error('❌ SMTP Configuration Missing:');
      console.error('EMAIL_SERVER_AUTH_USER:', process.env.EMAIL_SERVER_AUTH_USER ? 'SET' : 'NOT SET');
      console.error('EMAIL_SERVER_AUTH_PASSWORD:', process.env.EMAIL_SERVER_AUTH_PASSWORD ? 'SET' : 'NOT SET');
      console.error('EMAIL_SERVER_HOST:', process.env.EMAIL_SERVER_HOST || 'NOT SET');
      console.error('EMAIL_SERVER_PORT:', process.env.EMAIL_SERVER_PORT || 'NOT SET');
      throw new Error('Email server configuration is missing. Please configure EMAIL_SERVER_AUTH_USER and EMAIL_SERVER_AUTH_PASSWORD in your .env file.');
    }

    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || process.env.APP_NAME || 'Acredis Finance'}" <${process.env.EMAIL_FROM || process.env.EMAIL_SERVER_AUTH_USER}>`,
      to,
      subject,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if no text provided
      html,
    });

    console.log('📧 Email sent successfully:', info.messageId);
    return { success: true, info };
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    throw error;
  }
}

export async function sendOTPEmail(email: string, otp: string, name: string, type: string) {
  const transferTypeName = type === 'international_transfer' 
    ? 'International Transfer' 
    : 'Domestic Transfer';

  return sendEmail({
    to: email,
    subject: `Transfer Verification OTP - ${transferTypeName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e3a8a;">Transfer Verification</h2>
        <p>Hello ${name},</p>
        <p>You have requested to initiate a <strong>${transferTypeName}</strong>.</p>
        <p>Please use the following One-Time Password (OTP) to verify and complete your transfer:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <h1 style="color: #1e3a8a; font-size: 32px; letter-spacing: 8px; margin: 0;">${otp}</h1>
        </div>
        <p><strong>This OTP is valid for 10 minutes.</strong></p>
        <p>If you did not request this transfer, please ignore this email or contact our support team immediately.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 12px;">
          This is an automated message, please do not reply to this email.
        </p>
      </div>
    `,
  });
}

/**
 * Send a generic notification email to all admins about user activity
 * @param userId - The ID of the user who performed the action
 * @param userName - The name of the user
 * @param actionType - Brief description of what action is being processed
 */
export async function notifyAdminsOfUserActivity(userId: string, userName: string, actionType: string) {
  try {
    // Import prisma here to avoid circular dependencies
    const { prisma } = await import('./prisma');
    
    // Get all admin users
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true, name: true },
    });

    if (admins.length === 0) {
      console.log('⚠️ No admins found to notify');
      return;
    }

    // Send email to each admin
    const emailPromises = admins.map((admin) => 
      sendEmail({
        to: admin.email,
        subject: `User Activity Alert - ${actionType}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🔔 User Activity Alert</h1>
            </div>
            
            <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
                Hello ${admin.name || 'Admin'},
              </p>
              
              <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                <p style="margin: 0; color: #1f2937; font-size: 18px; font-weight: bold;">
                  ${userName} (ID: ${userId}) is processing ${actionType}
                </p>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin: 20px 0;">
                A user has initiated a new activity on your platform. Please review and take appropriate action if required.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://acredisfinance.com'}/admin/dashboard" 
                   style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
                  View Admin Dashboard
                </a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              
              <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                This is an automated notification from ${process.env.APP_NAME || 'Acredis Finance'}<br>
                Please do not reply to this email.
              </p>
            </div>
          </div>
        `,
      })
    );

    await Promise.allSettled(emailPromises);
    console.log(`✅ Admin notification emails sent for: ${actionType}`);
  } catch (error) {
    console.error('❌ Failed to send admin notification emails:', error);
    // Don't throw - we don't want to fail the main operation if email fails
  }
}

/**
 * Send transaction approval notification email to user
 * @param userEmail - User's email address
 * @param userName - User's name
 * @param transactionType - Type of transaction
 * @param amount - Transaction amount
 * @param currency - Transaction currency
 * @param reference - Transaction reference number
 */
export async function sendTransactionApprovalEmail(
  userEmail: string, 
  userName: string, 
  transactionType: string,
  amount: number,
  currency: string,
  reference: string
) {
  const typeLabels: Record<string, string> = {
    CRYPTO_DEPOSIT: 'Crypto Deposit',
    BANK_DEPOSIT: 'Bank Deposit',
    CHEQUE_DEPOSIT: 'Cheque Deposit',
    TRANSFER_OUT: 'Transfer Out',
    TRANSFER_IN: 'Transfer In',
    WITHDRAWAL: 'Withdrawal',
    DEPOSIT: 'Deposit',
  };

  const transactionLabel = typeLabels[transactionType] || transactionType;

  return sendEmail({
    to: userEmail,
    subject: `Transaction Approved - ${transactionLabel}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <div style="background-color: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 30px;">✓</span>
          </div>
          <h1 style="color: white; margin: 0; font-size: 24px;">Transaction Approved</h1>
        </div>
        
        <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
            Hello ${userName},
          </p>
          
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 25px;">
            Great news! Your transaction has been approved and processed successfully.
          </p>
          
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Transaction Type:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: bold; text-align: right;">${transactionLabel}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: bold; text-align: right;">${currency} ${Math.abs(amount).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Reference:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: bold; text-align: right;">${reference}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Status:</td>
                <td style="padding: 8px 0; text-align: right;">
                  <span style="background-color: #10b981; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold;">APPROVED</span>
                </td>
              </tr>
            </table>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin: 20px 0;">
            The funds have been credited to your account and are now available for use.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://acredisfinance.com'}/dashboard" 
               style="display: inline-block; background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
              View Dashboard
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            This is an automated notification from ${process.env.APP_NAME || 'Acredis Finance'}<br>
            If you have any questions, please contact our support team.<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });
}

/**
 * Send new post notification to all users
 * @param postTitle - The title of the new post
 * @param postContent - The content of the new post (will be truncated for email)
 * @param postId - The ID of the post
 */
export async function sendNewPostNotification(postTitle: string, postContent: string, postId: string) {
  try {
    // Import prisma here to avoid circular dependencies
    const { prisma } = await import('./prisma');
    
    // Get all users with valid email addresses
    const users = await prisma.user.findMany({
      select: { 
        email: true, 
        name: true 
      }
    });

    // Filter out users without email addresses
    const usersWithEmail = users.filter(user => user.email && user.email.trim() !== '');

    if (usersWithEmail.length === 0) {
      console.log('⚠️ No users found to notify about new post');
      return;
    }

    // Truncate content for email preview (first 200 characters)
    const contentPreview = postContent.length > 200 
      ? postContent.substring(0, 200) + '...' 
      : postContent;

    // Send email to each user
    const emailPromises = usersWithEmail.map((user) => 
      sendEmail({
        to: user.email,
        subject: `New Post: ${postTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <div style="background-color: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 30px;">📰</span>
              </div>
              <h1 style="color: white; margin: 0; font-size: 24px;">New Post Published</h1>
            </div>
            
            <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
                Hello ${user.name || 'Valued User'},
              </p>
              
              <p style="color: #6b7280; font-size: 14px; margin-bottom: 25px;">
                We have just published a new post that might interest you!
              </p>
              
              <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                <h2 style="margin: 0 0 15px 0; color: #1e40af; font-size: 20px;">${postTitle}</h2>
                <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0;">
                  ${contentPreview}
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://acredisfinance.com'}/investment-strategy" 
                   style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
                  Read Full Post
                </a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              
              <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                This is an automated notification from ${process.env.APP_NAME || 'Acredis Finance'}<br>
                You received this email because you are a registered user.<br>
                Please do not reply to this email.
              </p>
            </div>
          </div>
        `,
      })
    );

    // Send all emails in parallel and wait for all to complete (or fail)
    const results = await Promise.allSettled(emailPromises);
    
    // Count successes and failures
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`✅ New post notification emails sent: ${successful} successful, ${failed} failed out of ${usersWithEmail.length} users`);
  } catch (error) {
    console.error('❌ Failed to send new post notification emails:', error);
    // Don't throw - we don't want to fail the post creation if email fails
  }
}

export async function sendInvestmentMaturityNotification({
  adminEmail,
  adminName,
  investment,
}: {
  adminEmail: string;
  adminName: string;
  investment: {
    id: string;
    investorName: string;
    investorEmail: string;
    planName: string;
    amount: number;
    expectedProfit: number;
    totalReturn: number;
    startDate: Date;
    endDate: Date;
    currentCycle: number;
    totalCycles: number;
    isCompounding: boolean;
    hasMoreCycles: boolean;
  };
}) {
  const formattedAmount = investment.amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
  const formattedProfit = investment.expectedProfit.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
  const formattedReturn = investment.totalReturn.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
  
  const startDateStr = new Date(investment.startDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const endDateStr = new Date(investment.endDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const compoundingInfo = investment.isCompounding
    ? `
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b;">
        <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 600;">
          🔄 Compounding Investment
        </p>
        <p style="color: #78350f; font-size: 13px; margin: 5px 0 0 0;">
          Current Cycle: ${investment.currentCycle} of ${investment.totalCycles}
          ${investment.hasMoreCycles 
            ? '<br><strong>Action Required:</strong> Start next cycle or complete investment' 
            : '<br><strong>Final Cycle:</strong> Complete investment'}
        </p>
      </div>
    `
    : '';

  return await sendEmail({
    to: adminEmail,
    subject: `🔔 Investment Maturity Alert - ${investment.investorName} - ${investment.planName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Investment Maturity Alert</h1>
          <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 14px;">Manual Action Required</p>
        </div>
        
        <div style="padding: 30px;">
          <p style="color: #1f2937; font-size: 16px; margin: 0 0 10px 0;">
            Hello <strong>${adminName}</strong>,
          </p>
          
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 25px;">
            An investment has reached its maturity date and requires your attention to complete the transaction.
          </p>
          
          ${compoundingInfo}
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin: 0 0 15px 0; color: #111827; font-size: 18px; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
              Investment Details
            </h2>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 40%;">Investment ID:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${investment.id}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Investor Name:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${investment.investorName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Investor Email:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px;">${investment.investorEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Investment Plan:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${investment.planName}</td>
              </tr>
              <tr style="background-color: #e5e7eb;">
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Principal Amount:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${formattedAmount}</td>
              </tr>
              <tr style="background-color: #d1fae5;">
                <td style="padding: 8px 0; color: #065f46; font-size: 14px;">Expected Profit:</td>
                <td style="padding: 8px 0; color: #047857; font-size: 14px; font-weight: 700;">${formattedProfit}</td>
              </tr>
              <tr style="background-color: #dbeafe;">
                <td style="padding: 8px 0; color: #1e40af; font-size: 14px;">Total Return:</td>
                <td style="padding: 8px 0; color: #1e40af; font-size: 16px; font-weight: 700;">${formattedReturn}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Start Date:</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px;">${startDateStr}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Maturity Date:</td>
                <td style="padding: 8px 0; color: #dc2626; font-size: 14px; font-weight: 600;">${endDateStr}</td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <p style="color: #991b1b; font-size: 14px; margin: 0; font-weight: 600;">
              ⚠️ Action Required
            </p>
            <p style="color: #7f1d1d; font-size: 13px; margin: 5px 0 0 0;">
              Please log in to the admin dashboard to review and complete this investment manually. 
              ${investment.hasMoreCycles 
                ? 'You can choose to start the next compounding cycle or complete the investment.' 
                : 'Credit the profit to the investor\'s investment balance and mark the investment as COMPLETED.'}
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://acredisfinance.com'}/admin/investments"
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
              Go to Admin Dashboard
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            This is an automated notification from ${process.env.APP_NAME || 'Acredis Finance'} Admin System<br>
            Generated at: ${new Date().toLocaleString('en-US')}<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });
}

const MODIFICATION_TYPE_LABELS: Record<string, string> = {
  AUTHORIZATION_MODEL: 'Authorization Model & Threshold',
  THRESHOLD_AMOUNT: 'Transaction Threshold Amount',
  ACCOUNT_PURPOSE: 'Account Purpose & Description',
  MEMBER_REMOVAL: 'Member Removal',
  CLOSURE: 'Account Closure',
};

/**
 * Notify a Chain Account member that a modification request needs their approval
 */
export async function sendModificationRequestEmail({
  to,
  memberName,
  accountName,
  initiatorName,
  modificationType,
  reason,
}: {
  to: string;
  memberName: string;
  accountName: string;
  initiatorName: string;
  modificationType: string;
  reason: string;
}) {
  const typeLabel = MODIFICATION_TYPE_LABELS[modificationType] || modificationType;
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://acredisfinance.com'}/chain-account/dashboard`;

  return sendEmail({
    to,
    subject: `Action Required — Approve Modification Request for ${accountName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Chain Account Modification Request</h1>
        </div>

        <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
            Hello ${memberName},
          </p>

          <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
            ${initiatorName} has requested a modification to the Chain Account <strong>${accountName}</strong>.
            Your approval is required before this change can be applied.
          </p>

          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Requested Change:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: bold; text-align: right;">${typeLabel}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; vertical-align: top;">Reason:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; text-align: right;">${reason}</td>
              </tr>
            </table>
          </div>

          <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>Note:</strong> This change will only take effect once ALL members approve and the admin gives final sign-off.
              If any member rejects it, the request is cancelled.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Review & Vote
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            This is an automated notification from ${process.env.APP_NAME || 'Acredis Finance'}<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });
}

/**
 * Notify the initiator of a modification request about its final outcome
 */
export async function sendModificationDecisionEmail({
  to,
  memberName,
  accountName,
  modificationType,
  decision,
  reasonNote,
}: {
  to: string;
  memberName: string;
  accountName: string;
  modificationType: string;
  decision: 'APPROVED' | 'REJECTED';
  reasonNote?: string;
}) {
  const typeLabel = MODIFICATION_TYPE_LABELS[modificationType] || modificationType;
  const isApproved = decision === 'APPROVED';
  const color = isApproved ? '#10b981' : '#dc2626';
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://acredisfinance.com'}/chain-account/dashboard`;

  return sendEmail({
    to,
    subject: `Modification Request ${isApproved ? 'Approved' : 'Rejected'} — ${accountName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${color}; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Modification ${isApproved ? 'Approved' : 'Rejected'}</h1>
        </div>

        <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
            Hello ${memberName},
          </p>

          <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
            Your modification request for <strong>${accountName}</strong> regarding
            <strong>${typeLabel}</strong> has been ${isApproved ? 'approved and applied' : 'rejected'}.
          </p>

          ${reasonNote ? `
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${color};">
            <p style="margin: 0; color: #374151; font-size: 14px;"><strong>Note:</strong> ${reasonNote}</p>
          </div>
          ` : ''}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="background: ${color}; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              View Account
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            This is an automated notification from ${process.env.APP_NAME || 'Acredis Finance'}<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });
}

/**
 * Notify a Chain Account member that a closure request needs their approval,
 * with a direct link to confirm or reject the deletion
 */
export async function sendClosureVoteRequestEmail({
  to,
  memberName,
  accountName,
  accountNumber,
  initiatorName,
  reason,
  approvalLink,
}: {
  to: string;
  memberName: string;
  accountName: string;
  accountNumber: string;
  initiatorName: string;
  reason: string;
  approvalLink: string;
}) {
  return sendEmail({
    to,
    subject: `Action Required — Confirm Closure of Chain Account ${accountName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Chain Account Closure Request</h1>
        </div>

        <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
            Hello ${memberName},
          </p>

          <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
            ${initiatorName} has requested to permanently close the Chain Account <strong>${accountName}</strong> (${accountNumber}).
            Your confirmation is required before this account can be deleted.
          </p>

          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <p style="margin: 0; color: #374151; font-size: 14px;"><strong>Reason:</strong> ${reason}</p>
          </div>

          <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>Note:</strong> The account will only be deleted once ALL members confirm and the admin gives final sign-off.
              If any member rejects it, the request is cancelled.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${approvalLink}" style="background: #dc2626; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Review Closure Request
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            Or copy and paste this link into your browser:<br>
            <a href="${approvalLink}" style="color: #dc2626; word-break: break-all;">${approvalLink}</a>
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            This is an automated notification from ${process.env.APP_NAME || 'Acredis Finance'}<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });
}

/**
 * Notify all admins that a Chain Account closure request has full member approval
 * and needs final admin sign-off
 */
export async function sendClosureAdminReviewEmail({
  accountName,
  accountNumber,
  initiatorName,
  reason,
}: {
  accountName: string;
  accountNumber: string;
  initiatorName: string;
  reason: string;
}) {
  try {
    const { prisma } = await import('./prisma');

    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true, name: true },
    });

    if (admins.length === 0) {
      console.log('⚠️ No admins found to notify of closure request');
      return;
    }

    const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://acredisfinance.com'}/admin/chain-account-requests`;

    const emailPromises = admins.map((admin) =>
      sendEmail({
        to: admin.email,
        subject: `Action Required — Chain Account Closure Approved by All Members: ${accountName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 22px;">Chain Account Closure — Final Approval Needed</h1>
            </div>

            <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
                Hello ${admin.name || 'Admin'},
              </p>

              <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
                All members of <strong>${accountName}</strong> (${accountNumber}) have approved a request to close the account,
                initiated by ${initiatorName}. Your final approval is required to complete the closure.
              </p>

              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                <p style="margin: 0; color: #374151; font-size: 14px;"><strong>Reason:</strong> ${reason}</p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${reviewUrl}" style="display: inline-block; background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
                  Review Closure Request
                </a>
              </div>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

              <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                This is an automated notification from ${process.env.APP_NAME || 'Acredis Finance'}<br>
                Please do not reply to this email.
              </p>
            </div>
          </div>
        `,
      })
    );

    await Promise.allSettled(emailPromises);
    console.log(`✅ Admin closure review emails sent for: ${accountName}`);
  } catch (error) {
    console.error('❌ Failed to send admin closure review emails:', error);
  }
}

/**
 * Notify a Chain Account member that a co-signer requested to close an active investment early.
 * Informational only — the member does not need to act, only the admin approves.
 */
export async function sendChainInvestmentCloseRequestedEmail({
  to,
  recipientName,
  requesterName,
  accountName,
  accountNumber,
  planName,
  amount,
  currency,
  reference,
  reason,
}: {
  to: string;
  recipientName: string;
  requesterName: string;
  accountName: string;
  accountNumber: string;
  planName: string;
  amount: number;
  currency: string;
  reference: string;
  reason?: string;
}) {
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://acredisfinance.com'}/chain-account/dashboard`;

  return sendEmail({
    to,
    subject: `Investment Close Requested — ${accountName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Investment Close Requested</h1>
        </div>

        <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
            Hello ${recipientName},
          </p>

          <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
            <strong>${requesterName}</strong> has requested to close an active investment early for
            <strong>${accountName}</strong> (${accountNumber}). This request is awaiting admin approval —
            no action is required from you, this is for your records.
          </p>

          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f97316;">
            <table style="width: 100%; font-size: 14px; line-height: 2;">
              <tr>
                <td style="color: #6b7280;">Plan:</td>
                <td style="text-align: right; font-weight: bold;">${planName}</td>
              </tr>
              <tr>
                <td style="color: #6b7280;">Amount:</td>
                <td style="text-align: right; font-weight: bold;">${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style="color: #6b7280;">Reference:</td>
                <td style="text-align: right; font-family: monospace; font-size: 12px;">${reference}</td>
              </tr>
            </table>
            ${reason ? `<p style="margin: 10px 0 0 0; color: #374151; font-size: 13px;"><strong>Reason:</strong> ${reason}</p>` : ''}
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="background: #f97316; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              View Chain Account
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            This is an automated notification from ${process.env.APP_NAME || 'Acredis Finance'}<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });
}

/**
 * Notify all Chain Account members of the admin's decision on an early close request.
 */
export async function sendChainInvestmentCloseDecisionEmail({
  to,
  recipientName,
  accountName,
  planName,
  amount,
  currency,
  reference,
  decision,
  refundAmount,
  adminNotes,
}: {
  to: string;
  recipientName: string;
  accountName: string;
  planName: string;
  amount: number;
  currency: string;
  reference: string;
  decision: 'APPROVED' | 'REJECTED';
  refundAmount?: number;
  adminNotes?: string;
}) {
  const isApproved = decision === 'APPROVED';
  const color = isApproved ? '#10b981' : '#dc2626';
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://acredisfinance.com'}/chain-account/dashboard`;

  return sendEmail({
    to,
    subject: `Investment Close ${isApproved ? 'Approved' : 'Rejected'} — ${accountName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${color}; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Close Request ${isApproved ? 'Approved' : 'Rejected'}</h1>
        </div>

        <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
            Hello ${recipientName},
          </p>

          <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
            The request to close the <strong>${planName}</strong> investment of
            <strong>${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
            for <strong>${accountName}</strong> has been ${isApproved
              ? `approved. $${(refundAmount ?? amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} (principal + prorated profit) has been credited back to the Chain Account balance.`
              : 'rejected. The investment remains active.'}
          </p>

          ${adminNotes ? `
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${color};">
            <p style="margin: 0; color: #374151; font-size: 14px;"><strong>Note:</strong> ${adminNotes}</p>
          </div>
          ` : ''}

          <p style="color: #9ca3af; font-size: 12px; margin: 20px 0;">Reference: ${reference}</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="background: ${color}; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              View Chain Account
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            This is an automated notification from ${process.env.APP_NAME || 'Acredis Finance'}<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });
}

/**
 * Notify a Chain Account member that a co-signer initiated a crypto holding request.
 * Informational only — the member does not need to act, only the admin approves.
 */
export async function sendChainHoldingInitiatedEmail({
  to,
  recipientName,
  initiatorName,
  accountName,
  accountNumber,
  tokenName,
  tokenSymbol,
  amount,
  currency,
  reference,
}: {
  to: string;
  recipientName: string;
  initiatorName: string;
  accountName: string;
  accountNumber: string;
  tokenName: string;
  tokenSymbol: string;
  amount: number;
  currency: string;
  reference: string;
}) {
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://acredisfinance.com'}/chain-account/dashboard`;

  return sendEmail({
    to,
    subject: `Crypto Holding Requested — ${accountName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #4338ca 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Crypto Holding Requested</h1>
        </div>

        <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
            Hello ${recipientName},
          </p>

          <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
            <strong>${initiatorName}</strong> has requested to move funds from <strong>${accountName}</strong>
            (${accountNumber}) into a crypto holding. This request is awaiting admin approval — no action is
            required from you, this is for your records.
          </p>

          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <table style="width: 100%; font-size: 14px; line-height: 2;">
              <tr>
                <td style="color: #6b7280;">Asset:</td>
                <td style="text-align: right; font-weight: bold;">${tokenName} (${tokenSymbol})</td>
              </tr>
              <tr>
                <td style="color: #6b7280;">Amount:</td>
                <td style="text-align: right; font-weight: bold;">${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style="color: #6b7280;">Reference:</td>
                <td style="text-align: right; font-family: monospace; font-size: 12px;">${reference}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="background: #3b82f6; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              View Chain Account
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            This is an automated notification from ${process.env.APP_NAME || 'Acredis Finance'}<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });
}

/**
 * Notify the Chain Account member who requested a crypto holding of the admin's decision.
 */
export async function sendChainHoldingDecisionEmail({
  to,
  recipientName,
  accountName,
  tokenName,
  tokenSymbol,
  amount,
  currency,
  reference,
  decision,
  adminNotes,
}: {
  to: string;
  recipientName: string;
  accountName: string;
  tokenName: string;
  tokenSymbol: string;
  amount: number;
  currency: string;
  reference: string;
  decision: 'APPROVED' | 'REJECTED';
  adminNotes?: string;
}) {
  const isApproved = decision === 'APPROVED';
  const color = isApproved ? '#10b981' : '#dc2626';
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://acredisfinance.com'}/chain-account/dashboard`;

  return sendEmail({
    to,
    subject: `Crypto Holding ${isApproved ? 'Approved' : 'Rejected'} — ${accountName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${color}; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Holding ${isApproved ? 'Approved' : 'Rejected'}</h1>
        </div>

        <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
            Hello ${recipientName},
          </p>

          <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
            Your request to hold <strong>${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
            in <strong>${tokenName} (${tokenSymbol})</strong> for <strong>${accountName}</strong> has been
            ${isApproved ? 'approved and is now active' : 'rejected and the amount has been refunded to the Chain Account balance'}.
          </p>

          ${adminNotes ? `
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${color};">
            <p style="margin: 0; color: #374151; font-size: 14px;"><strong>Note:</strong> ${adminNotes}</p>
          </div>
          ` : ''}

          <p style="color: #9ca3af; font-size: 12px; margin: 20px 0;">Reference: ${reference}</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="background: ${color}; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              View Chain Account
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            This is an automated notification from ${process.env.APP_NAME || 'Acredis Finance'}<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
  });
}
