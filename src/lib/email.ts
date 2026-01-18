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
    // If no SMTP configuration, log to console in development
    if (!process.env.EMAIL_SERVER_AUTH_USER || !process.env.EMAIL_SERVER_AUTH_PASSWORD) {
      console.log('📧 Email would be sent (SMTP not configured):');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('HTML:', html);
      return { success: true, info: 'Email logged (SMTP not configured)' };
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
