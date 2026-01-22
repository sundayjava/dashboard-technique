import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get user by ID
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        avatar: true,
        role: true,
        accountType: true,
        currency: true,
        address: true,
        dateOfBirth: true,
        countryCode: true,
        profileCompleted: true,
        isVerified: true,
        isPlusUser: true,
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
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// PATCH - Update user
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const { name, email, phoneNumber, avatar, address, dateOfBirth } = body;

    // Only update fields that are provided and not null/undefined/empty
    const updateData: any = {};

    if (name !== undefined && name !== null && name.trim() !== '') {
      updateData.name = name.trim();
    }
    if (email !== undefined && email !== null && email.trim() !== '') {
      updateData.email = email.trim();
    }
    if (phoneNumber !== undefined && phoneNumber !== null && phoneNumber.trim() !== '') {
      updateData.phoneNumber = phoneNumber.trim();
    }
    if (avatar !== undefined && avatar !== null) {
      updateData.avatar = avatar;
    }
    if (address !== undefined && address !== null && address.trim() !== '') {
      updateData.address = address.trim();
    }
    if (dateOfBirth !== undefined && dateOfBirth !== null) {
      updateData.dateOfBirth = dateOfBirth;
    }

    // If no fields to update, return error
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        avatar: true,
        role: true,
        accountType: true,
        currency: true,
        address: true,
        dateOfBirth: true,
        countryCode: true,
        profileCompleted: true,
        isVerified: true,
        isPlusUser: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      message: 'User updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
