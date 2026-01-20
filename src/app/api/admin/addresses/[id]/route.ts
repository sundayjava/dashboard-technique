import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Get single address
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const address = await prisma.depositAddress.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            userAssignments: true,
          },
        },
      },
    });

    if (!address) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(address);
  } catch (error: any) {
    console.error('Error fetching address:', error);
    return NextResponse.json(
      { error: 'Failed to fetch address' },
      { status: 500 }
    );
  }
}

// Update address
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      tokenName,
      address,
      network,
      bankName,
      accountNumber,
      accountName,
      swiftCode,
      routingNumber,
      country,
    } = body;

    // Get existing address to check type
    const existingAddress = await prisma.depositAddress.findUnique({
      where: { id },
    });

    if (!existingAddress) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      );
    }

    // Build update data based on type
    const updateData: any = {};

    if (existingAddress.type === 'CRYPTO') {
      if (tokenName !== undefined) updateData.tokenName = tokenName;
      if (address !== undefined) updateData.address = address;
      if (network !== undefined) updateData.network = network;
    } else if (existingAddress.type === 'BANK') {
      if (bankName !== undefined) updateData.bankName = bankName;
      if (accountNumber !== undefined) updateData.accountNumber = accountNumber;
      if (accountName !== undefined) updateData.accountName = accountName;
      if (swiftCode !== undefined) updateData.swiftCode = swiftCode;
      if (routingNumber !== undefined) updateData.routingNumber = routingNumber;
      if (country !== undefined) updateData.country = country;
    }

    const updatedAddress = await prisma.depositAddress.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedAddress);
  } catch (error: any) {
    console.error('Error updating address:', error);
    return NextResponse.json(
      { error: 'Failed to update address' },
      { status: 500 }
    );
  }
}

// Delete address
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if address exists
    const address = await prisma.depositAddress.findUnique({
      where: { id },
    });

    if (!address) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      );
    }

    // Delete the address (this will cascade delete user assignments)
    await prisma.depositAddress.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Address deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting address:', error);
    return NextResponse.json(
      { error: 'Failed to delete address' },
      { status: 500 }
    );
  }
}
