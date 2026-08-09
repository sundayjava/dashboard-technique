import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendClosureVoteRequestEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('X-Chain-Access-Token');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { chainAccountId, reason } = await request.json();

    if (!chainAccountId || !reason) {
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

    // Check if account has balance
    if (sessionMember.chainAccount.balance > 0) {
      return NextResponse.json(
        { error: 'Cannot close account with remaining balance. Please withdraw all funds first.' },
        { status: 400 }
      );
    }

    // Generate reference
    const reference = `CLO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create closure request
    const closureRequest = await prisma.chainAccountClosureRequest.create({
      data: {
        chainAccountId,
        initiatedBy: sessionMember.id,
        reason,
        reference,
        status: 'PENDING_APPROVAL',
      }
    });

    // Get all members
    const allMembers = await prisma.chainAccountMember.findMany({
      where: { chainAccountId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          }
        }
      }
    });

    // Create approval records for all members
    for (const member of allMembers) {
      await prisma.chainAccountClosureApproval.create({
        data: {
          closureRequestId: closureRequest.id,
          memberId: member.id,
        }
      });

      // Notify member
      await prisma.chainAccountNotification.create({
        data: {
          chainAccountId,
          userId: member.userId,
          type: 'CLOSURE_REQUEST',
          title: 'Account Closure Request',
          message: `A member has requested to close this Chain Account. Your approval is required.`,
          isRead: false,
        }
      });
    }

    // Email all members a direct link to confirm or reject the closure
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const emailResults = await Promise.allSettled(
      allMembers
        .filter((member) => member.user?.email)
        .map((member) =>
          sendClosureVoteRequestEmail({
            to: member.user!.email,
            memberName: member.user!.name || 'Member',
            accountName: sessionMember.chainAccount.accountName,
            accountNumber: sessionMember.chainAccount.accountNumber,
            initiatorName: sessionMember.user?.name || 'A member',
            reason,
            approvalLink: `${baseUrl}/chain-account/approve-closure?ref=${reference}&member=${member.id}`,
          })
        )
    );
    const failedEmails = emailResults.filter((r) => r.status === 'rejected').length;
    if (failedEmails > 0) {
      console.error(`Failed to send ${failedEmails} closure request email(s)`);
    }

    return NextResponse.json({
      success: true,
      message: 'Closure request created. All members must approve.',
      reference,
    });

  } catch (error: any) {
    console.error('Error creating closure request:', error);
    return NextResponse.json(
      { error: 'Failed to create closure request' },
      { status: 500 }
    );
  }
}
