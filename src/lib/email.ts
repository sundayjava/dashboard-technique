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
      from: `"${process.env.APP_NAME || 'Acredis Finance'}" <${process.env.EMAIL_SERVER_AUTH_USER}>`,
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
