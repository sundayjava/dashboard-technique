import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get single KYC submission
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const kyc = await prisma.kYC.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!kyc) {
      return NextResponse.json(
        { error: 'KYC submission not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ kyc });
  } catch (error) {
    console.error('Error fetching KYC:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KYC submission' },
      { status: 500 }
    );
  }
}

// PATCH - Update KYC status (approve/reject)
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { status, rejectionReason } = body;

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const kyc = await prisma.kYC.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!kyc) {
      return NextResponse.json(
        { error: 'KYC submission not found' },
        { status: 404 }
      );
    }

    const updateData: any = {
      status,
      verifiedAt: new Date(),
    };

    if (status === 'REJECTED' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    // If approved, mark user as verified
    if (status === 'APPROVED') {
      await prisma.user.update({
        where: { id: kyc.userId },
        data: { isVerified: true },
      });

      // Create notification
      await prisma.notification.create({
        data: {
          userId: kyc.userId,
          type: 'SYSTEM',
          title: 'KYC Verified',
          message: 'Your KYC verification has been approved. Your account is now fully verified.',
          link: '/dashboard/account/kyc',
        },
      });
    } else if (status === 'REJECTED') {
      // Create rejection notification
      await prisma.notification.create({
        data: {
          userId: kyc.userId,
          type: 'SYSTEM',
          title: 'KYC Rejected',
          message: `Your KYC verification was rejected. ${rejectionReason || 'Please resubmit with correct information.'}`,
          link: '/dashboard/account/kyc',
        },
      });
    }

    const updatedKyc = await prisma.kYC.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: `KYC ${status.toLowerCase()} successfully`,
      kyc: updatedKyc,
    });
  } catch (error) {
    console.error('Error updating KYC:', error);
    return NextResponse.json(
      { error: 'Failed to update KYC submission' },
      { status: 500 }
    );
  }
}
