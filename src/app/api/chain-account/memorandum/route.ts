import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Signing token is required' },
        { status: 400 }
      );
    }

    // Find the member with this signing token
    const member = await prisma.chainAccountMember.findUnique({
      where: { signingToken: token },
      include: {
        chainAccount: {
          include: {
            memorandum: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Invalid or expired signing token' },
        { status: 404 }
      );
    }

    if (member.signingTokenUsed) {
      return NextResponse.json(
        { error: 'This signing link has already been used' },
        { status: 400 }
      );
    }

    // Get all members to show confirmation status
    const allMembers = await prisma.chainAccountMember.findMany({
      where: { chainAccountId: member.chainAccountId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        role: 'asc', // PRIMARY_HOLDER first
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        chainAccount: {
          id: member.chainAccount.id,
          accountNumber: member.chainAccount.accountNumber,
          accountName: member.chainAccount.accountName,
          status: member.chainAccount.status,
        },
        member: {
          id: member.id,
          role: member.role,
          hasConfirmed: member.hasConfirmed,
          confirmedAt: member.confirmedAt,
        },
        memorandum: {
          documentReference: member.chainAccount.memorandum?.documentReference,
          dateIssued: member.chainAccount.memorandum?.createdAt,
          content: member.chainAccount.memorandum?.content,
        },
        allMembers: allMembers.map(m => ({
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
          hasConfirmed: m.hasConfirmed,
          confirmedAt: m.confirmedAt,
        })),
      },
    });

  } catch (error) {
    console.error('Error fetching memorandum:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
