import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyAdminsOfUserActivity } from '@/lib/email';

// GET - List card applications
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');

    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const applications = await prisma.cardApplication.findMany({
      where,
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
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ applications });
  } catch (error) {
    console.error('Error fetching card applications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch card applications' },
      { status: 500 }
    );
  }
}

// POST - Create new card application
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, phoneNumber, accountNumber, cardType } = body;

    // Validation
    if (!userId || !phoneNumber || !accountNumber || !cardType) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate card type
    const validCardTypes = ['DEBIT', 'CREDIT', 'VIRTUAL', 'PREPAID'];
    if (!validCardTypes.includes(cardType)) {
      return NextResponse.json(
        { error: 'Invalid card type' },
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

    // Check if user is a premium/plus user
    if (!user.isPlusUser) {
      return NextResponse.json(
        { error: 'Card applications are only available for Acredis Plus users. Please upgrade your account to apply for a card.' },
        { status: 403 }
      );
    }

    // Check if user has a positive balance in any account
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { balance: true }
    });

    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

    if (totalBalance <= 0) {
      return NextResponse.json(
        { error: 'You must have a positive account balance to apply for a card. Please fund your account first.' },
        { status: 403 }
      );
    }

    // Create card application
    const application = await prisma.cardApplication.create({
      data: {
        userId,
        phoneNumber,
        accountNumber,
        cardType,
      },
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

    // Notify admins via email
    notifyAdminsOfUserActivity(
      userId,
      application.user.name || 'Unknown User',
      `a ${cardType} Card Application`
    );

    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        type: 'CARD',
        title: 'Card Application Submitted',
        message: `Your ${cardType.toLowerCase()} card application has been submitted successfully and is pending review.`,
        link: '/dashboard/monetary/cards',
      },
    });

    return NextResponse.json({ application }, { status: 201 });
  } catch (error) {
    console.error('Error creating card application:', error);
    return NextResponse.json(
      { error: 'Failed to create card application' },
      { status: 500 }
    );
  }
}
