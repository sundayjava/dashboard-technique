import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Create new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      password,
      phoneNumber,
      countryCode,
      currency,
      accountType,
      canTransfer,
      isVerified,
      requireOTPForInternational,
    } = body;

    // Validation
    if (!name || !email || !password || !phoneNumber || !countryCode || !currency) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Generate authorization code
    const authCode = `AC${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    
    // Generate transaction PIN (default: 1234, user should change it)
    const defaultPin = '1234';
    const hashedPin = await bcrypt.hash(defaultPin, 10);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Ensure direct transfer and OTP transfer are mutually exclusive
    let finalCanTransfer = canTransfer;
    let finalRequireOTP = requireOTPForInternational;

    if (canTransfer && requireOTPForInternational) {
      // If both are true, prioritize direct transfer and disable OTP
      finalRequireOTP = false;
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        phoneNumber,
        countryCode,
        currency,
        accountType: accountType || 'PERSONAL',
        authorizationCode: authCode,
        transactionPin: hashedPin,
        canTransfer: finalCanTransfer ?? true,
        isVerified: isVerified ?? false,
        requireOTPForInternational: finalRequireOTP ?? false,
        accountDisabled: false,
        role: 'USER',
      },
    });

    // Create default account for the user
    await prisma.account.create({
      data: {
        userId: user.id,
        accountNumber: `${Math.random().toString().slice(2, 12)}`, // 10-digit account number
        accountName: name,
        accountType: accountType || 'PERSONAL',
        currency: currency,
        balance: 0,
        status: 'ACTIVE',
      },
    });

    // Send welcome notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'SYSTEM',
        title: 'Welcome to Acredis Finance',
        message: `Your account has been created. Your authorization code is ${authCode}. Default transaction PIN is ${defaultPin}. Please change it after your first login.`,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        authorizationCode: user.authorizationCode,
      },
      message: 'User created successfully',
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create user' },
      { status: 500 }
    );
  }
}
