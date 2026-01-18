import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT - Update user bank account
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { accountName, accountNumber, bankBranch, instructions, isActive } = body;

    const updatedData: any = {};
    if (accountName !== undefined) updatedData.accountName = accountName;
    if (accountNumber !== undefined) updatedData.accountNumber = accountNumber;
    if (bankBranch !== undefined) updatedData.bankBranch = bankBranch;
    if (instructions !== undefined) updatedData.instructions = instructions;
    if (isActive !== undefined) updatedData.isActive = isActive;

    const bankAccount = await prisma.userBankAccount.update({
      where: { id },
      data: updatedData,
      include: {
        bank: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return NextResponse.json({
      bankAccount,
      message: 'Bank account updated successfully',
    });
  } catch (error) {
    console.error('Error updating user bank account:', error);
    return NextResponse.json(
      { error: 'Failed to update bank account' },
      { status: 500 }
    );
  }
}

// DELETE - Remove user bank account
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.userBankAccount.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Bank account removed successfully',
    });
  } catch (error) {
    console.error('Error deleting user bank account:', error);
    return NextResponse.json(
      { error: 'Failed to remove bank account' },
      { status: 500 }
    );
  }
}
