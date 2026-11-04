import { NextRequest, NextResponse } from 'next/server';
import { verifyChainAccountToken } from '@/lib/chain-account-session';
import { prisma } from '@/lib/prisma';
import {
  ApprovalError,
  decideApproval,
  listPendingApprovals,
  type PendingApprovalKind,
} from '@/lib/chain-account-approvals';

const VALID_KINDS: PendingApprovalKind[] = [
  'WITHDRAWAL',
  'INVESTMENT',
  'CLOSURE',
  'MODIFICATION',
  'REMOVAL_TARGET',
  'REMOVAL_VOTE',
];

/**
 * Resolve the signed-in member from their Chain Account session. The member id
 * is taken from the token and re-checked against the database, so a member can
 * only ever see and decide their own approvals.
 */
async function requireMember(request: NextRequest, chainAccountId: string | null) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApprovalError('Authentication required', 401);
  }

  const session = verifyChainAccountToken(authHeader.substring(7));
  if (!session) {
    throw new ApprovalError('Invalid or expired session', 401);
  }

  if (!chainAccountId) {
    throw new ApprovalError('Chain Account ID is required');
  }

  if (session.chainAccountId !== chainAccountId) {
    throw new ApprovalError('Access denied', 403);
  }

  const member = await prisma.chainAccountMember.findFirst({
    where: { id: session.memberId, chainAccountId, userId: session.userId },
  });

  if (!member) {
    throw new ApprovalError('You are not a member of this Chain Account', 403);
  }

  return { session, member };
}

function errorResponse(error: unknown) {
  if (error instanceof ApprovalError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error('Chain Account approvals error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

// GET - everything currently waiting on the signed-in member
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chainAccountId = searchParams.get('chainAccountId');
    const { member } = await requireMember(request, chainAccountId);

    const approvals = await listPendingApprovals(chainAccountId!, member.id);

    return NextResponse.json({ success: true, approvals });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST - record this member's approve/reject decision
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chainAccountId, kind, id, decision, notes } = body || {};

    const { member } = await requireMember(request, chainAccountId ?? null);

    if (!kind || !VALID_KINDS.includes(kind)) {
      throw new ApprovalError('Unknown approval type');
    }

    if (!id || typeof id !== 'string') {
      throw new ApprovalError('Approval id is required');
    }

    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      throw new ApprovalError('Decision must be APPROVED or REJECTED');
    }

    const result = await decideApproval({
      chainAccountId,
      memberId: member.id,
      kind,
      id,
      decision,
      notes: typeof notes === 'string' && notes.trim() ? notes.trim() : undefined,
    });

    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    return errorResponse(error);
  }
}
