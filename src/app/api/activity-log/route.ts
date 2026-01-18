import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const action = searchParams.get('action'); // Optional filter

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Build query
    const where: any = { userId };
    if (action && action !== 'ALL') {
      where.action = action;
    }

    // Fetch activity logs
    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity logs' },
      { status: 500 }
    );
  }
}

// Helper function to create activity log
export async function createActivityLog(
  userId: string,
  action: string,
  description: string,
  request?: NextRequest,
  metadata?: any
) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        description,
        ipAddress: request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip') || 'unknown',
        userAgent: request?.headers.get('user-agent') || 'unknown',
        metadata: metadata || null,
      },
    });
  } catch (error) {
    console.error('Error creating activity log:', error);
  }
}
