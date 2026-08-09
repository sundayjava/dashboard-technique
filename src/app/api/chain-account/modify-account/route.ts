import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendModificationDecisionEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('X-Chain-Access-Token');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { chainAccountId, modificationType, proposedChanges, reason } = await request.json();

    if (!chainAccountId || !modificationType || !proposedChanges || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get session member
    const sessionMember = await prisma.chainAccountMember.findFirst({
      where: {
        chainAccountId,
        accessTokenHash: { not: null }
      },
      include: {
        chainAccount: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });

    if (!sessionMember) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 401 }
      );
    }

    // Generate reference
    const reference = `MOD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Apply the changes immediately - no approval required
    await prisma.chainAccount.update({
      where: { id: chainAccountId },
      data: {
        ...proposedChanges,
      }
    });

    // Record the modification for audit purposes
    await prisma.chainAccountModificationRequest.create({
      data: {
        chainAccountId,
        initiatedBy: sessionMember.id,
        modificationType,
        proposedChanges,
        reason,
        reference,
        status: 'APPROVED',
        allApproved: true,
        processedAt: new Date(),
      }
    });

    // Get all other members
    const otherMembers = await prisma.chainAccountMember.findMany({
      where: { chainAccountId, id: { not: sessionMember.id } },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          }
        }
      }
    });

    // Notify other members that the account was modified
    for (const member of otherMembers) {
      await prisma.chainAccountNotification.create({
        data: {
          chainAccountId,
          userId: member.userId,
          type: 'ACTION_COMPLETED',
          title: 'Account Modified',
          message: `${sessionMember.user?.name || 'A member'} updated the account's ${modificationType.toLowerCase().replace('_', ' ')}.`,
          isRead: false,
        }
      });
    }

    // Email all other members about the change
    const emailResults = await Promise.allSettled(
      otherMembers
        .filter((member) => member.user?.email)
        .map((member) =>
          sendModificationDecisionEmail({
            to: member.user!.email,
            memberName: member.user!.name || 'Member',
            accountName: sessionMember.chainAccount.accountName,
            modificationType,
            decision: 'APPROVED',
            reasonNote: reason,
          })
        )
    );
    const failedEmails = emailResults.filter((r) => r.status === 'rejected').length;
    if (failedEmails > 0) {
      console.error(`Failed to send ${failedEmails} modification notification email(s)`);
    }

    return NextResponse.json({
      success: true,
      message: 'Changes applied successfully. Other members have been notified.',
      reference,
    });

  } catch (error: any) {
    console.error('Error creating modification request:', error);
    return NextResponse.json(
      { error: 'Failed to create modification request' },
      { status: 500 }
    );
  }
}
