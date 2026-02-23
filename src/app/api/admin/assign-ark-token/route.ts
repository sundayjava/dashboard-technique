import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch all users (searchable) + existing ARK_II assignments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('adminId');
    const search = searchParams.get('search') || '';

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }

    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch users with optional search
    const users = await prisma.user.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
            role: 'USER',
          }
        : { role: 'USER' },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        accounts: { select: { currency: true }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Fetch all ARK II assignments with user info
    const assignments = await prisma.arkIIAssignment.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ users, assignments });
  } catch (error) {
    console.error('Error fetching ARK_II data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

// POST - Assign ARK_II to a user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminId, userId, amount, notes } = body;

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    if (amount === undefined || amount === null || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: 'A valid ARK II amount is required' }, { status: 400 });
    }

    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const parsedAmount = parseFloat(amount);

    // If user already has an assignment, update the amount instead of creating a duplicate
    const existing = await prisma.arkIIAssignment.findFirst({ where: { userId } });

    let assignment;
    if (existing) {
      assignment = await prisma.arkIIAssignment.update({
        where: { id: existing.id },
        data: {
          amount: parsedAmount,
          assignedBy: adminId,
          notes: notes || existing.notes,
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    } else {
      assignment = await prisma.arkIIAssignment.create({
        data: {
          userId,
          amount: parsedAmount,
          assignedBy: adminId,
          notes: notes || null,
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    }

    // Notify user
    await prisma.notification.create({
      data: {
        userId,
        title: 'ARK II Assigned',
        message: `${parsedAmount.toLocaleString()} ARK II has been assigned to your account by an administrator.`,
        type: 'SYSTEM',
      },
    });

    return NextResponse.json({
      message: existing ? 'ARK II amount updated successfully' : 'ARK II assigned successfully',
      assignment,
    });
  } catch (error) {
    console.error('Error assigning ARK_II:', error);
    return NextResponse.json({ error: 'Failed to assign ARK II' }, { status: 500 });
  }
}

// PATCH - Update ARK_II amount for existing assignment
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminId, assignmentId, amount, notes } = body;

    if (!adminId) return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    if (!assignmentId) return NextResponse.json({ error: 'Assignment ID is required' }, { status: 400 });
    if (amount === undefined || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: 'A valid amount is required' }, { status: 400 });
    }

    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const assignment = await prisma.arkIIAssignment.update({
      where: { id: assignmentId },
      data: { amount: parseFloat(amount), assignedBy: adminId, notes: notes ?? undefined },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await prisma.notification.create({
      data: {
        userId: assignment.userId,
        title: 'ARK II Updated',
        message: `Your ARK II amount has been updated to ${parseFloat(amount).toLocaleString()} by an administrator.`,
        type: 'SYSTEM',
      },
    });

    return NextResponse.json({ message: 'ARK II amount updated', assignment });
  } catch (error) {
    console.error('Error updating ARK_II:', error);
    return NextResponse.json({ error: 'Failed to update ARK II' }, { status: 500 });
  }
}

// DELETE - Revoke an ARK_II assignment
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('adminId');
    const assignmentId = searchParams.get('assignmentId');

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }
    if (!assignmentId) {
      return NextResponse.json({ error: 'Assignment ID is required' }, { status: 400 });
    }

    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const assignment = await prisma.arkIIAssignment.findUnique({
      where: { id: assignmentId },
      include: { user: true },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    await prisma.arkIIAssignment.delete({ where: { id: assignmentId } });

    await prisma.notification.create({
      data: {
        userId: assignment.userId,
        title: 'ARK II Revoked',
        message: 'Your ARK II has been revoked by an administrator.',
        type: 'SYSTEM',
      },
    });

    return NextResponse.json({ message: 'ARK II assignment revoked successfully' });
  } catch (error) {
    console.error('Error revoking ARK_II:', error);
    return NextResponse.json({ error: 'Failed to revoke ARK II' }, { status: 500 });
  }
}
