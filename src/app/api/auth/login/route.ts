import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import { createSessionToken } from '@/lib/session';

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
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        emailVerified: true,
        authorizationCode: true,
        accountType: true,
        currency: true,
        isPlusUser: true,
        accountDisabled: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if account is disabled
    if (user.accountDisabled) {
      return NextResponse.json(
        { error: 'Your account has been disabled. Please contact support.' },
        { status: 403 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if email is verified
    if (!user.emailVerified) {
      // Generate OTP for email verification
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Update user with OTP
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationOTP: otp,
          emailVerificationOTPExpiry: otpExpiry,
        },
      });

      // TODO: Send OTP email here
      // await sendOTPEmail(user.email, otp);

      return NextResponse.json(
        { 
          error: 'Email not verified',
          requiresVerification: true,
          email: user.email,
          message: 'Please verify your email. We have sent a verification code to your email.' 
        },
        { status: 403 }
      );
    }

    // Check if user has an account, if not create one (for legacy users)
    const existingAccount = await prisma.account.findFirst({
      where: { userId: user.id },
    });

    if (!existingAccount) {
      try {
        const accountNumber = await generateAccountNumber();
        await prisma.account.create({
          data: {
            userId: user.id,
            accountNumber: accountNumber,
            accountName: user.name || user.email.split('@')[0],
            accountType: user.accountType || 'PERSONAL',
            currency: user.currency || 'USD',
            balance: 0,
            availableBalance: 0,
            status: 'ACTIVE',
          },
        });
      } catch (error) {
        console.error('Error creating account for legacy user:', error);
        // Don't fail login if account creation fails
      }
    }

    // Return user data (excluding password) with session token
    const { password: _, ...userWithoutPassword } = user;
    
    // Create session token
    const token = createSessionToken(user.id, user.email, user.role);

    return NextResponse.json(
      {
        message: 'Login successful',
        user: userWithoutPassword,
        token,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}
