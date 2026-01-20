import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Get all addresses
export async function GET(request: NextRequest) {
  try {
    const addresses = await prisma.depositAddress.findMany({
      include: {
        _count: {
          select: {
            userAssignments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(addresses);
  } catch (error: any) {
    console.error('Error fetching addresses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch addresses' },
      { status: 500 }
    );
  }
}

// Create new address
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type,
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

    // Validate required fields based on type
    if (type === 'CRYPTO') {
      if (!tokenName || !address || !network) {
        return NextResponse.json(
          { error: 'Token name, address, and network are required for crypto addresses' },
          { status: 400 }
        );
      }
    } else if (type === 'BANK') {
      if (!bankName || !accountNumber || !accountName || !country) {
        return NextResponse.json(
          { error: 'Bank name, account number, account name, and country are required for bank addresses' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid address type. Must be CRYPTO or BANK' },
        { status: 400 }
      );
    }

    const newAddress = await prisma.depositAddress.create({
      data: {
        type,
        tokenName: type === 'CRYPTO' ? tokenName : null,
        address: type === 'CRYPTO' ? address : null,
        network: type === 'CRYPTO' ? network : null,
        bankName: type === 'BANK' ? bankName : null,
        accountNumber: type === 'BANK' ? accountNumber : null,
        accountName: type === 'BANK' ? accountName : null,
        swiftCode: type === 'BANK' ? swiftCode : null,
        routingNumber: type === 'BANK' ? routingNumber : null,
        country: type === 'BANK' ? country : null,
      },
    });

    return NextResponse.json(newAddress, { status: 201 });
  } catch (error: any) {
    console.error('Error creating address:', error);
    return NextResponse.json(
      { error: 'Failed to create address' },
      { status: 500 }
    );
  }
}
