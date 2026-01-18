import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const ADMIN_EMAIL = 'admin@acredisfinance.com';
const ADMIN_PASSWORD = 'Admin@Acredis2026';
const ADMIN_PIN = '0000';

export async function GET(request: NextRequest) {
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (existingAdmin) {
      return NextResponse.json(
        { message: 'Admin user already exists' },
        { status: 200 }
      );
    }

    // Hash password and PIN
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const hashedPin = await bcrypt.hash(ADMIN_PIN, 12);

    // Generate unique authorization code
    const authCode = `AC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        password: hashedPassword,
        transactionPin: hashedPin,
        phoneNumber: '0000000000',
        countryCode: '+1',
        accountType: 'PERSONAL',
        currency: 'USD',
        authorizationCode: authCode,
        role: 'ADMIN',
        emailVerified: true, // Admin is pre-verified
        name: 'System Administrator',
      },
    });

    return NextResponse.json(
      {
        message: 'Admin user created successfully',
        credentials: {
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          authorizationCode: authCode,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Admin seed error:', error);
    return NextResponse.json(
      { error: 'Failed to create admin user' },
      { status: 500 }
    );
  }
}
