import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { notifyAdminsOfUserActivity } from '@/lib/email';

// Generate unique 10-digit account number
async function generateAccountNumber(): Promise<string> {
  let accountNumber: string;
  let isUnique = false;

  while (!isUnique) {
    // Generate 10-digit number starting with 10 (Acredis prefix)
    accountNumber = '10' + Math.floor(10000000 + Math.random() * 90000000).toString();
    
    // Check if this account number already exists
    const existing = await prisma.account.findUnique({
      where: { accountNumber },
    });
    
    if (!existing) {
      isUnique = true;
      return accountNumber;
    }
  }
  
  throw new Error('Failed to generate unique account number');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      authorizationCode,
      email,
      phoneNumber,
      countryCode,
      accountType,
      currency,
      password,
      transactionPin,
    } = body;

    // Validate required fields
    if (
      !authorizationCode ||
      !email ||
      !phoneNumber ||
      !countryCode ||
      !accountType ||
      !currency ||
      !password ||
      !transactionPin
    ) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Check if authorization code is already used
    const existingAuthCode = await prisma.user.findUnique({
      where: { authorizationCode },
    });

    if (existingAuthCode) {
      return NextResponse.json(
        { error: 'Authorization code already in use. Please refresh and try again.' },
        { status: 409 }
      );
    }

    // Hash password and transaction PIN
    const hashedPassword = await bcrypt.hash(password, 12);
    const hashedTransactionPin = await bcrypt.hash(transactionPin, 12);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // OTP expires in 10 minutes
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Generate account number
    const accountNumber = await generateAccountNumber();

    // Create user and account in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          transactionPin: hashedTransactionPin,
          phoneNumber,
          countryCode,
          accountType,
          currency,
          authorizationCode,
          emailVerificationOTP: otp,
          emailVerificationOTPExpiry: otpExpiry,
          emailVerified: false,
        },
      });

      // Create default account
      const account = await tx.account.create({
        data: {
          userId: user.id,
          accountNumber: accountNumber,
          accountName: email.split('@')[0], // Use email prefix as initial account name
          accountType: accountType,
          currency: currency,
          balance: 0,
          availableBalance: 0,
          status: 'ACTIVE',
        },
      });

      // Create welcome notification
      await tx.notification.create({
        data: {
          userId: user.id,
          type: 'SYSTEM',
          title: 'Welcome to Acredis Finance!',
          message: `Your account ${accountNumber} has been created successfully. Please verify your email to get started.`,
          link: '/dashboard',
        },
      });

      return { user, account };
    });

    // Send verification email
    try {
      await sendVerificationEmail(email, otp);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail the registration if email fails
    }

    // Notify admins of new signup
    try {
      await notifyAdminsOfUserActivity(
        result.user.id,
        email,
        `a New Account Registration (Account: ${accountNumber})`
      );
    } catch (emailError) {
      console.error('Failed to send admin notification:', emailError);
      // Don't fail the registration if admin notification fails
    }

    return NextResponse.json(
      {
        message: 'Account created successfully. Please check your email to verify your account.',
        userId: result.user.id,
        accountNumber: accountNumber,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}

async function sendVerificationEmail(email: string, otp: string) {
  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: parseInt(process.env.EMAIL_SERVER_PORT || '465'),
    secure: process.env.EMAIL_SERVER_PORT === '465',
    auth: {
      user: process.env.EMAIL_SERVER_AUTH_USER,
      pass: process.env.EMAIL_SERVER_AUTH_PASSWORD,
    },
  });

  // Send email
  await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME || 'Acredis Finance'}" <${process.env.EMAIL_FROM || process.env.EMAIL_SERVER_AUTH_USER}>`,
    to: email,
    subject: 'Verify Your Acredis Finance Account - OTP Code',
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
              <p style="margin: 0; font-size: 16px;">Welcome to Acredis Finance!</p>
            </div>
            <div class="content">
              <h2 style="color: #000000;">Verify Your Email Address</h2>
              <p>Thank you for creating an account with Acredis Finance. Please use the following One-Time Password (OTP) to verify your email address:</p>
              
              <div class="otp-box">
                <p style="margin: 0; color: #6b7280; font-size: 14px; margin-bottom: 10px;">Your Verification Code</p>
                <div class="otp-code">${otp}</div>
                <p style="margin: 15px 0 0 0; color: #6b7280; font-size: 13px;">Valid for 10 minutes</p>
              </div>

              <div class="warning">
                <strong>Security Notice:</strong>
                <p style="margin: 5px 0 0 0;">Never share this code with anyone. Acredis Finance will never ask for your OTP via phone or email.</p>
              </div>

              <p style="margin-top: 25px;">If you didn't create an account with Acredis Finance, please ignore this email.</p>
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
