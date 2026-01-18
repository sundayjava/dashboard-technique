import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch KYC submission for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const kycSubmission = await prisma.kYC.findUnique({
      where: { userId },
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
      kyc: kycSubmission,
      message: kycSubmission ? 'KYC submission found' : 'No KYC submission found',
    });
  } catch (error: any) {
    console.error('Error fetching KYC:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KYC submission' },
      { status: 500 }
    );
  }
}

// POST - Submit KYC
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      fullName,
      dateOfBirth,
      nationality,
      address,
      city,
      state,
      postalCode,
      country,
      documentType,
      documentNumber,
      documentFrontImage,
      documentBackImage,
      selfieImage,
      occupation,
      employerName,
      annualIncome,
      sourceOfFunds,
    } = body;

    // Validation
    if (!userId || !fullName || !dateOfBirth || !nationality || !address || 
        !city || !state || !postalCode || !country || !documentType || 
        !documentNumber || !documentFrontImage || !selfieImage) {
      return NextResponse.json(
        { error: 'All required fields must be provided' },
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

    // Check if KYC already exists
    const existingKYC = await prisma.kYC.findUnique({
      where: { userId },
    });

    let kycSubmission;

    if (existingKYC) {
      // Update existing KYC
      kycSubmission = await prisma.kYC.update({
        where: { userId },
        data: {
          fullName,
          dateOfBirth: new Date(dateOfBirth),
          nationality,
          address,
          city,
          state,
          postalCode,
          country,
          documentType,
          documentNumber,
          documentFrontImage,
          documentBackImage,
          selfieImage,
          occupation,
          employerName,
          annualIncome,
          sourceOfFunds,
          status: 'PENDING',
          rejectionReason: null,
          verifiedBy: null,
          verifiedAt: null,
          submittedAt: new Date(),
        },
      });
    } else {
      // Create new KYC
      kycSubmission = await prisma.kYC.create({
        data: {
          userId,
          fullName,
          dateOfBirth: new Date(dateOfBirth),
          nationality,
          address,
          city,
          state,
          postalCode,
          country,
          documentType,
          documentNumber,
          documentFrontImage,
          documentBackImage,
          selfieImage,
          occupation,
          employerName,
          annualIncome,
          sourceOfFunds,
          status: 'PENDING',
        },
      });
    }

    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        type: 'SECURITY',
        title: 'KYC Submitted',
        message: 'Your KYC verification has been submitted and is under review. We will notify you once it\'s approved.',
        link: '/dashboard/account/kyc',
      },
    });

    return NextResponse.json({
      kyc: kycSubmission,
      message: existingKYC ? 'KYC resubmitted successfully' : 'KYC submitted successfully',
    });
  } catch (error: any) {
    console.error('Error submitting KYC:', error);
    return NextResponse.json(
      { error: 'Failed to submit KYC' },
      { status: 500 }
    );
  }
}

// PUT - Update KYC status (Admin only)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { kycId, status, rejectionReason, verifiedBy } = body;

    if (!kycId || !status) {
      return NextResponse.json(
        { error: 'KYC ID and status are required' },
        { status: 400 }
      );
    }

    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'APPROVED') {
      updateData.verifiedBy = verifiedBy;
      updateData.verifiedAt = new Date();
      updateData.rejectionReason = null;
    } else if (status === 'REJECTED' || status === 'RESUBMIT_REQUIRED') {
      updateData.rejectionReason = rejectionReason;
    }

    const kycSubmission = await prisma.kYC.update({
      where: { id: kycId },
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

    // Send notification to user
    let notificationMessage = '';
    if (status === 'APPROVED') {
      notificationMessage = 'Congratulations! Your KYC verification has been approved.';
    } else if (status === 'REJECTED') {
      notificationMessage = `Your KYC verification was rejected. Reason: ${rejectionReason || 'Not specified'}`;
    } else if (status === 'RESUBMIT_REQUIRED') {
      notificationMessage = `Please resubmit your KYC documents. Reason: ${rejectionReason || 'Not specified'}`;
    }

    await prisma.notification.create({
      data: {
        userId: kycSubmission.userId,
        type: 'SECURITY',
        title: `KYC ${status}`,
        message: notificationMessage,
        link: '/dashboard/account/kyc',
      },
    });

    return NextResponse.json({
      kyc: kycSubmission,
      message: 'KYC status updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating KYC status:', error);
    return NextResponse.json(
      { error: 'Failed to update KYC status' },
      { status: 500 }
    );
  }
}
