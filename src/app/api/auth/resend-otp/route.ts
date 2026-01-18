import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: 'Email already verified' },
        { status: 400 }
      );
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user with new OTP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationOTP: otp,
        emailVerificationOTPExpiry: otpExpiry,
      },
    });

    // Send email
    try {
      await sendVerificationEmail(email, otp);
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      return NextResponse.json(
        { error: 'Failed to send email. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'New OTP sent successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Resend OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to resend OTP. Please try again.' },
      { status: 500 }
    );
  }
}

async function sendVerificationEmail(email: string, otp: string) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: parseInt(process.env.EMAIL_SERVER_PORT || '465'),
    secure: true,
    auth: {
      user: process.env.EMAIL_SERVER_AUTH_USER,
      pass: process.env.EMAIL_SERVER_AUTH_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_SERVER_AUTH_USER,
    to: email,
    subject: 'Verify Your Acredis Finance Account - New OTP Code',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: #c1ff72;
              color: #000000;
              padding: 30px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background-color: #f9fafb;
              padding: 40px 30px;
              border-radius: 0 0 8px 8px;
            }
            .otp-box {
              background-color: #c1ff72;
              border: 2px solid #97ff28;
              padding: 25px;
              text-align: center;
              margin: 25px 0;
              border-radius: 8px;
            }
            .otp-code {
              font-size: 42px;
              font-weight: bold;
              color: #000000;
              letter-spacing: 8px;
              font-family: 'Courier New', monospace;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              color: #6b7280;
              font-size: 14px;
            }
            .warning {
              background-color: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Email Verification</h1>
              <p style="margin: 0; font-size: 16px;">New OTP Code</p>
            </div>
            <div class="content">
              <h2 style="color: #000000;">Your New Verification Code</h2>
              <p>You requested a new One-Time Password (OTP). Please use the following code to verify your email address:</p>
              
              <div class="otp-box">
                <p style="margin: 0; color: #6b7280; font-size: 14px; margin-bottom: 10px;">Your Verification Code</p>
                <div class="otp-code">${otp}</div>
                <p style="margin: 15px 0 0 0; color: #6b7280; font-size: 13px;">Valid for 10 minutes</p>
              </div>

              <div class="warning">
                <strong>Security Notice:</strong>
                <p style="margin: 5px 0 0 0;">Never share this code with anyone. Acredis Finance will never ask for your OTP via phone or email.</p>
              </div>

              <p style="margin-top: 25px;">If you didn't request this code, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Acredis Finance. All rights reserved.</p>
              <p style="font-size: 12px; margin-top: 10px;">This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  });
}
