import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Get all user address assignments
export async function GET(request: NextRequest) {
  try {
    const assignments = await prisma.userDepositAddress.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        address: {
          select: {
            id: true,
            type: true,
            tokenName: true,
            address: true,
            network: true,
            bankName: true,
            accountNumber: true,
            accountName: true,
            swiftCode: true,
            routingNumber: true,
            country: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(assignments);
  } catch (error: any) {
    console.error('Error fetching user addresses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user addresses' },
      { status: 500 }
    );
  }
}

// Assign address to user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, addressId } = body;

    if (!userId || !addressId) {
      return NextResponse.json(
        { error: 'User ID and Address ID are required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if address exists
    const address = await prisma.depositAddress.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      );
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.userDepositAddress.findUnique({
      where: {
        userId_addressId: {
          userId,
          addressId,
        },
      },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'This address is already assigned to this user' },
        { status: 400 }
      );
    }

    // Create assignment
    const assignment = await prisma.userDepositAddress.create({
      data: {
        userId,
        addressId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        address: true,
      },
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error: any) {
    console.error('Error assigning address:', error);
    return NextResponse.json(
      { error: 'Failed to assign address' },
      { status: 500 }
    );
  }
}
