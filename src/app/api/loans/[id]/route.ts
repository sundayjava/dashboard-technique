import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Get a single loan application
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const loan = await prisma.loan.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            authorizationCode: true
          }
        }
      }
    });

    if (!loan) {
      return NextResponse.json(
        { error: 'Loan application not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(loan);
  } catch (error) {
    console.error('Error fetching loan:', error);
    return NextResponse.json(
      { error: 'Failed to fetch loan' },
      { status: 500 }
    );
  }
}

// Update loan status (Admin only - approve/reject)
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { status, adminNotes, approvedBy } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    const updateData: any = {
      status,
      adminNotes
    };

    if (status === 'APPROVED') {
      updateData.approvedBy = approvedBy;
      updateData.approvedAt = new Date();
    } else if (status === 'REJECTED') {
      updateData.rejectedAt = new Date();
    }

    const loan = await prisma.loan.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            authorizationCode: true
          }
        }
      }
    });

    // Create notification for user
    const notificationTitle = status === 'APPROVED' 
      ? 'Loan Application Approved' 
      : status === 'REJECTED' 
        ? 'Loan Application Rejected'
        : 'Loan Status Updated';
    
    const notificationMessage = status === 'APPROVED'
      ? `Your loan application for $${loan.amount} has been approved!`
      : status === 'REJECTED'
        ? `Your loan application for $${loan.amount} has been rejected. ${adminNotes || ''}`
        : `Your loan application status has been updated to ${status}.`;

    await prisma.notification.create({
      data: {
        userId: loan.userId,
        type: 'LOAN',
        title: notificationTitle,
        message: notificationMessage,
        link: '/dashboard/loan/status'
      }
    });

    return NextResponse.json({
      message: 'Loan status updated successfully',
      loan
    });
  } catch (error) {
    console.error('Error updating loan:', error);
    return NextResponse.json(
      { error: 'Failed to update loan' },
      { status: 500 }
    );
  }
}

// Delete loan application
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await prisma.loan.delete({
      where: { id }
    });

    return NextResponse.json({
      message: 'Loan application deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting loan:', error);
    return NextResponse.json(
      { error: 'Failed to delete loan' },
      { status: 500 }
    );
  }
}
