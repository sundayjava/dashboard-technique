import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Get single user by ID (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;

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
        emailVerified: true,
        phoneNumber: true,
        countryCode: true,
        currency: true,
        accountType: true,
        role: true,
        canTransfer: true,
        transferDisabled: true,
        accountDisabled: true,
        isVerified: true,
        requireOTPForInternational: true,
        authorizationCode: true,
        address: true,
        isPlusUser: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// Update user by ID (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const body = await request.json();
    const { 
      name, 
      email, 
      phoneNumber, 
      countryCode, 
      currency, 
      accountType,
      canTransfer,
      transferDisabled,
      accountDisabled,
      isVerified,
      requireOTPForInternational,      authorizationCode,
      address,
      avatar,
      isPlusUser,
      role,
      password,
      transactionPin,    } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent modifying admin accounts
    if (user.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'Cannot modify admin accounts' },
        { status: 403 }
      );
    }

    // Check if email is being changed and if it's already taken
    if (email && email.toLowerCase() !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 400 }
        );
      }
    }

    // Ensure direct transfer and OTP transfer are mutually exclusive
    let finalCanTransfer = canTransfer;
    let finalRequireOTP = requireOTPForInternational;

    if (canTransfer !== undefined && requireOTPForInternational !== undefined) {
      if (canTransfer && requireOTPForInternational) {
        // If both are true, prioritize direct transfer and disable OTP
        finalRequireOTP = false;
      }
    }

    // Hash password if provided
    let hashedPassword = undefined;
    if (password && password.trim() !== '') {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Hash transaction PIN if provided
    let hashedTransactionPin = undefined;
    if (transactionPin && transactionPin.trim() !== '') {
      hashedTransactionPin = await bcrypt.hash(transactionPin, 10);
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email.toLowerCase();
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (countryCode !== undefined) updateData.countryCode = countryCode;
    if (currency !== undefined) updateData.currency = currency;
    if (accountType !== undefined) updateData.accountType = accountType;
    if (finalCanTransfer !== undefined) updateData.canTransfer = finalCanTransfer;
    if (transferDisabled !== undefined) updateData.transferDisabled = transferDisabled;
    if (accountDisabled !== undefined) updateData.accountDisabled = accountDisabled;
    if (isVerified !== undefined) updateData.isVerified = isVerified;
    if (finalRequireOTP !== undefined) updateData.requireOTPForInternational = finalRequireOTP;
    if (authorizationCode !== undefined) updateData.authorizationCode = authorizationCode;
    if (address !== undefined) updateData.address = address;
    if (isPlusUser !== undefined) updateData.isPlusUser = isPlusUser;
    if (role !== undefined) updateData.role = role;
    if (hashedPassword !== undefined) updateData.password = hashedPassword;
    if (hashedTransactionPin !== undefined) updateData.transactionPin = hashedTransactionPin;

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        countryCode: true,
        currency: true,
        accountType: true,
        canTransfer: true,
        transferDisabled: true,
        accountDisabled: true,
        isVerified: true,
        requireOTPForInternational: true,
        authorizationCode: true,
        address: true,
        isPlusUser: true,
        role: true,
      },
    });

    // Create activity log for permission changes
    const permissionChanges = [];
    if (canTransfer !== undefined) {
      permissionChanges.push(`Direct transfer ${canTransfer ? 'enabled' : 'disabled'}`);
    }
    if (transferDisabled !== undefined) {
      permissionChanges.push(`All transfers ${transferDisabled ? 'disabled' : 'enabled'}`);
    }
    if (requireOTPForInternational !== undefined) {
      permissionChanges.push(`Code transfer ${requireOTPForInternational ? 'enabled' : 'disabled'}`);
    }
    if (accountDisabled !== undefined) {
      permissionChanges.push(`Account ${accountDisabled ? 'disabled' : 'enabled'}`);
    }
    if (isVerified !== undefined) {
      permissionChanges.push(`Email verification ${isVerified ? 'verified' : 'unverified'}`);
    }
    if (isPlusUser !== undefined) {
      permissionChanges.push(`Acredis Plus ${isPlusUser ? 'activated' : 'deactivated'}`);
    }
    if (role !== undefined) {
      permissionChanges.push(`Role changed to ${role}`);
    }
    if (password !== undefined && password.trim() !== '') {
      permissionChanges.push('Password updated');
    }
    if (transactionPin !== undefined && transactionPin.trim() !== '') {
      permissionChanges.push('Transaction PIN updated');
    }

    if (permissionChanges.length > 0) {
      await prisma.activityLog.create({
        data: {
          userId: userId,
          action: 'ADMIN_UPDATE',
          description: `Admin updated user: ${permissionChanges.join(', ')}`,
        },
      });

      // Send notification for critical changes
      if (accountDisabled) {
        await prisma.notification.create({
          data: {
            userId: userId,
            type: 'SYSTEM',
            title: 'Account Status Changed',
            message: 'Your account has been disabled by an administrator. Please contact support.',
          },
        });
      }

      if (isVerified) {
        await prisma.notification.create({
          data: {
            userId: userId,
            type: 'SYSTEM',
            title: 'Account Verified',
            message: 'Your account has been verified. You now have full access to all features.',
          },
        });
      }

      if (isPlusUser !== undefined) {
        await prisma.notification.create({
          data: {
            userId: userId,
            type: 'SYSTEM',
            title: isPlusUser ? 'Acredis Plus Activated' : 'Acredis Plus Deactivated',
            message: isPlusUser 
              ? 'Congratulations! Your account has been upgraded to Acredis Plus with premium features.'
              : 'Your Acredis Plus subscription has been deactivated.',
          },
        });
      }

      if (password !== undefined && password.trim() !== '') {
        await prisma.notification.create({
          data: {
            userId: userId,
            type: 'SECURITY',
            title: 'Password Updated',
            message: 'Your password has been updated by an administrator. Please use your new password to login.',
          },
        });
      }

      if (transactionPin !== undefined && transactionPin.trim() !== '') {
        await prisma.notification.create({
          data: {
            userId: userId,
            type: 'SECURITY',
            title: 'Transaction PIN Updated',
            message: 'Your transaction PIN has been updated by an administrator.',
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: 'User updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: 500 }
    );
  }
}

// Delete user by ID (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent deleting admin accounts
    if (user.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'Cannot delete admin accounts' },
        { status: 403 }
      );
    }

    // Delete user and all related data in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete related records first (due to foreign key constraints)
      // Note: Adjust based on your actual schema relationships

      // Delete notifications
      await tx.notification.deleteMany({
        where: { userId: userId },
      });

      // Delete activity logs
      await tx.activityLog.deleteMany({
        where: { userId: userId },
      });

      // Delete transactions
      await tx.transaction.deleteMany({
        where: { userId: userId },
      });

      // Delete accounts
      await tx.account.deleteMany({
        where: { userId: userId },
      });

      // Delete messages (sent and received)
      await tx.message.deleteMany({
        where: {
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
      });

      // Delete KYC submission
      await tx.kYC.deleteMany({
        where: { userId: userId },
      });

      // Delete loan applications
      await tx.loan.deleteMany({
        where: { userId: userId },
      });

      // Delete crypto deposits
      await tx.cryptoDeposit.deleteMany({
        where: { userId: userId },
      });

      // Delete card applications
      await tx.cardApplication.deleteMany({
        where: { userId: userId },
      });

      // Delete cheque deposits
      await tx.chequeDeposit.deleteMany({
        where: { userId: userId },
      });

      // Delete bank deposits
      await tx.bankDeposit.deleteMany({
        where: { userId: userId },
      });

      // Delete assigned bank accounts
      await tx.userBankAccount.deleteMany({
        where: { userId: userId },
      });

      // Delete investments
      await tx.investment.deleteMany({
        where: { userId: userId },
      });

      // Delete investment access
      await tx.investmentAccess.deleteMany({
        where: { userId: userId },
      });

      // Delete owned trade keys (where user is the owner)
      await tx.tradeKey.deleteMany({
        where: { userId: userId },
      });

      // Finally, delete the user
      await tx.user.delete({
        where: { id: userId },
      });
    });

    return NextResponse.json({
      success: true,
      message: `User ${user.name || user.email} deleted successfully`,
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete user' },
      { status: 500 }
    );
  }
}
