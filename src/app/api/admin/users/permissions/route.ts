import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createActivityLog } from '@/app/api/activity-log/route';

// Update user permissions (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, canTransfer, accountDisabled, isVerified, requireOTPForInternational } = body;

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

    // Build update data
    const updateData: any = {};
    if (canTransfer !== undefined) updateData.canTransfer = canTransfer;
    if (accountDisabled !== undefined) updateData.accountDisabled = accountDisabled;
    if (isVerified !== undefined) updateData.isVerified = isVerified;
    if (requireOTPForInternational !== undefined) updateData.requireOTPForInternational = requireOTPForInternational;

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        canTransfer: true,
        accountDisabled: true,
        isVerified: true,
        requireOTPForInternational: true,
      },
    });

    // Create activity log
    const changes = [];
    if (canTransfer !== undefined) {
      changes.push(`Transfer permission ${canTransfer ? 'enabled' : 'disabled'}`);
    }
    if (accountDisabled !== undefined) {
      changes.push(`Account ${accountDisabled ? 'disabled' : 'enabled'}`);
    }
    if (isVerified !== undefined) {
      changes.push(`Account ${isVerified ? 'verified' : 'unverified'}`);
    }
    if (requireOTPForInternational !== undefined) {
      changes.push(`OTP for international transfers ${requireOTPForInternational ? 'enabled' : 'disabled'}`);
    }

    await createActivityLog(
      userId,
      'ADMIN_PERMISSION_CHANGE',
      `Admin updated permissions: ${changes.join(', ')}`
    );

    // Notify user if account disabled or transfer disabled
    if (accountDisabled === true) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'SYSTEM',
          title: 'Account Disabled',
          message: 'Your account has been disabled. Please contact support for assistance.',
        },
      });
    }

    if (canTransfer === false) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'SYSTEM',
          title: 'Transfer Privileges Disabled',
          message: 'Your transfer privileges have been disabled. Please contact support for assistance.',
        },
      });
    }

    if (isVerified === false) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'SYSTEM',
          title: 'Account Unverified',
          message: 'Your account verification has been revoked. Please contact support.',
        },
      });
    }

    if (isVerified === true) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'SYSTEM',
          title: 'Account Verified',
          message: 'Congratulations! Your account has been verified. You can now make international transfers.',
        },
      });
    }

    if (requireOTPForInternational === true) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'SYSTEM',
          title: 'OTP Verification Enabled',
          message: 'OTP verification has been enabled for your international transfers. You will receive an OTP via email before completing transfers.',
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'User permissions updated successfully',
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('Error updating user permissions:', error);
    return NextResponse.json(
      { error: 'Failed to update user permissions' },
      { status: 500 }
    );
  }
}
