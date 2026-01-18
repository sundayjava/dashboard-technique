import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import axios from 'axios';

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
    const { email, password, recaptchaToken } = body;

    // Validate input
    if (!email || !password || !recaptchaToken) {
      return NextResponse.json(
        { error: 'Email, password, and reCAPTCHA verification are required' },
        { status: 400 }
      );
    }

    // Verify reCAPTCHA
    try {
      const recaptchaResponse = await axios.post(
        `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
      );

      if (!recaptchaResponse.data.success) {
        return NextResponse.json(
          { error: 'reCAPTCHA verification failed. Please try again.' },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('reCAPTCHA verification error:', error);
      return NextResponse.json(
        { error: 'Failed to verify reCAPTCHA. Please try again.' },
        { status: 500 }
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
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: 'Please verify your email before logging in' },
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

    // Return user data (excluding password)
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json(
      {
        message: 'Login successful',
        user: userWithoutPassword,
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
