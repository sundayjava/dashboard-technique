import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get user profile
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        countryCode: true,
        avatar: true,
        dateOfBirth: true,
        address: true,
        currency: true,
        accountType: true,
        profileCompleted: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

// PUT - Update user profile
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { userId, name, phoneNumber, countryCode, dateOfBirth, address } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    if (name) updateData.name = name;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (countryCode) updateData.countryCode = countryCode;
    if (address) updateData.address = address;
    if (dateOfBirth) updateData.dateOfBirth = new Date(dateOfBirth);

    // Check if profile is now complete
    const isProfileComplete = !!(
      (name || existingUser.name) &&
      (phoneNumber || existingUser.phoneNumber) &&
      (address || updateData.address || existingUser.address) &&
      (dateOfBirth || existingUser.dateOfBirth) &&
      existingUser.avatar
    );

    if (isProfileComplete) {
      updateData.profileCompleted = true;
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        countryCode: true,
        avatar: true,
        dateOfBirth: true,
        address: true,
        currency: true,
        accountType: true,
        profileCompleted: true,
        role: true,
        authorizationCode: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
