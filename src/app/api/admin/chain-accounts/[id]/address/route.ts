import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SessionManager } from '@/lib/session';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check admin authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // In production, verify admin JWT token
    // For now, we'll get the session from header

    const { id } = await params;
    const { cryptoDepositAddress, cryptoNetwork, cryptoToken } = await request.json();

    if (!cryptoDepositAddress || !cryptoNetwork || !cryptoToken) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate address format (basic validation)
    if (cryptoDepositAddress.length < 10) {
      return NextResponse.json(
        { error: 'Invalid deposit address format' },
        { status: 400 }
      );
    }

    // Check if Chain Account exists
    const chainAccount = await prisma.chainAccount.findUnique({
      where: { id },
    });

    if (!chainAccount) {
      return NextResponse.json(
        { error: 'Chain Account not found' },
        { status: 404 }
      );
    }

    // Check if address is already used by another Chain Account
    const existingAddress = await prisma.chainAccount.findFirst({
      where: {
        cryptoDepositAddress,
        id: { not: id },
      },
    });

    if (existingAddress) {
      return NextResponse.json(
        { error: 'This address is already assigned to another Chain Account' },
        { status: 400 }
      );
    }

    // Update Chain Account with crypto deposit address
    const updatedAccount = await prisma.chainAccount.update({
      where: { id },
      data: {
        cryptoDepositAddress,
        cryptoNetwork,
        cryptoToken,
        depositAddressAssignedAt: new Date(),
        // depositAddressAssignedBy: adminId, // TODO: Add admin ID from session
      },
    });

    // Create notifications for all members
    const members = await prisma.chainAccountMember.findMany({
      where: { chainAccountId: id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    for (const member of members) {
      await prisma.chainAccountNotification.create({
        data: {
          chainAccountId: id,
          userId: member.userId,
          type: 'GENERAL',
          title: 'Crypto Deposit Address Assigned',
          message: `A crypto deposit address has been assigned to your Chain Account. You can now deposit ${cryptoToken} via ${cryptoNetwork}.`,
          isRead: false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Crypto deposit address assigned successfully',
      address: {
        cryptoDepositAddress: updatedAccount.cryptoDepositAddress,
        cryptoNetwork: updatedAccount.cryptoNetwork,
        cryptoToken: updatedAccount.cryptoToken,
      },
    });

  } catch (error: any) {
    console.error('Error assigning crypto address:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
