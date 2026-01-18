import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Get all loan applications (with filters)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');

    let where: any = {};

    if (userId) {
      where.userId = userId;
    }

    if (status) {
      where.status = status;
    }

    const loans = await prisma.loan.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            authorizationCode: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ loans });
  } catch (error) {
    console.error('Error fetching loans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch loans' },
      { status: 500 }
    );
  }
}

// Create a new loan application
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, fromDate, fullName, amount, duration, loanType, reason } = body;

    if (!userId || !fromDate || !fullName || !amount || !duration || !loanType || !reason) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate amount is positive
    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Loan amount must be greater than zero' },
        { status: 400 }
      );
    }

    // Validate duration is positive
    if (duration <= 0) {
      return NextResponse.json(
        { error: 'Loan duration must be greater than zero' },
        { status: 400 }
      );
    }

    const loan = await prisma.loan.create({
      data: {
        userId,
        fromDate: new Date(fromDate),
        fullName,
        amount: parseFloat(amount),
        duration: parseInt(duration),
        loanType,
        reason
      },
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
    await prisma.notification.create({
      data: {
        userId,
        type: 'LOAN',
        title: 'Loan Application Submitted',
        message: `Your loan application for $${amount} has been submitted successfully and is pending approval.`,
        link: '/dashboard/loan/status'
      }
    });

    return NextResponse.json({
      message: 'Loan application submitted successfully',
      loan
    });
  } catch (error) {
    console.error('Error creating loan:', error);
    return NextResponse.json(
      { error: 'Failed to create loan application' },
      { status: 500 }
    );
  }
}
