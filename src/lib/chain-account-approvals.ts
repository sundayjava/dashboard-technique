/**
 * Chain Account — in-dashboard approvals
 *
 * Every co-owner decision (withdrawals, investments, account closure, being
 * removed from an account) used to be driven by a one-time link emailed to each
 * party. SMTP costs made that unworkable, so the approval queue now lives in
 * the dashboard: any member with a live Chain Account session can list what is
 * waiting on them and decide it at any time. Nothing expires, nothing depends
 * on an email arriving.
 *
 * Deposits are deliberately absent from this file. A deposit only ever adds
 * money to the account, so it never waits on a co-owner.
 */

import { prisma } from './prisma';
import {
  approvalProgress,
  approvalRequirementFor,
  requirementForRequestInFlight,
  type ApprovalRequirement,
} from './chain-account-authorization';
import { sanitizeProposedChanges } from './chain-account-modifications';

export type PendingApprovalKind =
  | 'WITHDRAWAL'
  | 'INVESTMENT'
  | 'CLOSURE'
  | 'MODIFICATION'
  | 'REMOVAL_TARGET'
  | 'REMOVAL_VOTE';

export interface PendingApproval {
  /** Which queue this came from — decides how the vote is recorded. */
  kind: PendingApprovalKind;
  /** Id of the approval/request row the decision is written against. */
  id: string;
  title: string;
  /** Human sentence describing what is being asked. */
  description: string;
  reference: string | null;
  amount: number | null;
  currency: string | null;
  /** This member's own share of a withdrawal, when applicable. */
  memberShare: number | null;
  initiatorName: string;
  /** How many members (including this one) still have to decide. */
  awaitingCount: number;
  createdAt: string;
}

export type ApprovalDecisionInput = 'APPROVED' | 'REJECTED';

export interface DecideResult {
  message: string;
}

export class ApprovalError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** One sentence describing what has to happen for an operation to proceed. */
function ruleSentence(requirement: ApprovalRequirement): string {
  return requirement.mode === 'MAJORITY'
    ? `This account needs a majority to approve, so ${requirement.approvalsNeeded} of the other member(s) must agree.`
    : 'This account needs every member to approve.';
}

function displayName(user?: { name: string | null; email: string } | null): string {
  if (!user) return 'A member';
  return user.name || user.email;
}

/**
 * Everything currently waiting on this one member, across every request type.
 * Ordered newest first so the dashboard shows the freshest ask at the top.
 */
export async function listPendingApprovals(
  chainAccountId: string,
  memberId: string
): Promise<PendingApproval[]> {
  const items: PendingApproval[] = [];

  // Needed to describe money operations accurately: what a member is waiting
  // for depends on the account's authorization model, not just on the count of
  // undecided members.
  const account = await prisma.chainAccount.findUnique({
    where: { id: chainAccountId },
    select: {
      authorizationModel: true,
      thresholdAmount: true,
      _count: { select: { members: true } },
    },
  });

  const requirementForAmount = (amount: number) =>
    approvalRequirementFor({
      authorizationModel: account?.authorizationModel ?? 'THRESHOLD',
      thresholdAmount: account?.thresholdAmount ?? null,
      amount,
      memberCount: account?._count.members ?? 1,
    });

  // --- Withdrawals and investments (ChainAccountApproval) ---
  const actionApprovals = await prisma.chainAccountApproval.findMany({
    where: { chainAccountId, memberId, decision: null },
    orderBy: { createdAt: 'desc' },
  });

  const withdrawalIds = actionApprovals.filter(a => a.actionType === 'WITHDRAWAL').map(a => a.actionId);
  const investmentIds = actionApprovals.filter(a => a.actionType === 'INVESTMENT').map(a => a.actionId);

  const [withdrawals, investments] = await Promise.all([
    withdrawalIds.length
      ? prisma.chainAccountWithdrawal.findMany({
          where: { id: { in: withdrawalIds }, status: 'PENDING_APPROVAL' },
          include: { initiator: { include: { user: { select: { name: true, email: true } } } } },
        })
      : Promise.resolve([]),
    investmentIds.length
      ? prisma.chainAccountInvestment.findMany({
          where: { id: { in: investmentIds }, status: 'PENDING_APPROVAL' },
          include: {
            initiator: { include: { user: { select: { name: true, email: true } } } },
            plan: { select: { planName: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  // How many members still owe a decision on each action, so the UI can say so.
  const siblingCounts = await prisma.chainAccountApproval.groupBy({
    by: ['actionId'],
    where: {
      chainAccountId,
      decision: null,
      actionId: { in: [...withdrawalIds, ...investmentIds] },
    },
    _count: { _all: true },
  });
  const awaitingFor = (actionId: string) =>
    siblingCounts.find(c => c.actionId === actionId)?._count._all ?? 1;

  for (const approval of actionApprovals) {
    if (approval.actionType === 'WITHDRAWAL') {
      const withdrawal = withdrawals.find(w => w.id === approval.actionId);
      if (!withdrawal) continue; // already resolved elsewhere

      const distributions = (withdrawal.distribution as Array<{ memberId: string; amount: number }>) || [];
      const memberShare = distributions.find(d => d.memberId === memberId)?.amount ?? 0;
      const initiatorName = displayName(withdrawal.initiator.user);

      items.push({
        kind: 'WITHDRAWAL',
        id: approval.id,
        title: 'Withdrawal approval',
        description: `${initiatorName} wants to withdraw ${withdrawal.currency} ${withdrawal.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} from this account. Your share of it is ${withdrawal.currency} ${memberShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}. ${ruleSentence(requirementForAmount(withdrawal.totalAmount))} An admin then gives final sign-off before any wallet is credited.`,
        reference: withdrawal.reference,
        amount: withdrawal.totalAmount,
        currency: withdrawal.currency,
        memberShare,
        initiatorName,
        awaitingCount: awaitingFor(withdrawal.id),
        createdAt: approval.createdAt.toISOString(),
      });
      continue;
    }

    const investment = investments.find(i => i.id === approval.actionId);
    if (!investment) continue;

    const initiatorName = displayName(investment.initiator.user);
    items.push({
      kind: 'INVESTMENT',
      id: approval.id,
      title: 'Investment approval',
      description: `${initiatorName} wants to invest ${investment.currency} ${investment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} in ${investment.plan.planName}. ${ruleSentence(requirementForAmount(investment.amount))} The money stays in the account balance until then.`,
      reference: investment.reference,
      amount: investment.amount,
      currency: investment.currency,
      memberShare: null,
      initiatorName,
      awaitingCount: awaitingFor(investment.id),
      createdAt: approval.createdAt.toISOString(),
    });
  }

  // --- Account closure ---
  const closureApprovals = await prisma.chainAccountClosureApproval.findMany({
    where: {
      memberId,
      decision: null,
      closureRequest: { chainAccountId, status: 'PENDING_APPROVAL' },
    },
    include: { closureRequest: true },
    orderBy: { createdAt: 'desc' },
  });

  for (const approval of closureApprovals) {
    const initiator = await prisma.chainAccountMember.findUnique({
      where: { id: approval.closureRequest.initiatedBy },
      include: { user: { select: { name: true, email: true } } },
    });
    const awaiting = await prisma.chainAccountClosureApproval.count({
      where: { closureRequestId: approval.closureRequestId, decision: null },
    });
    const initiatorName = displayName(initiator?.user);

    items.push({
      kind: 'CLOSURE',
      id: approval.id,
      title: 'Account closure approval',
      description: `${initiatorName} asked to close this Chain Account. Reason given: "${approval.closureRequest.reason}". Every member must confirm before an admin closes it — a single rejection cancels the request.`,
      reference: approval.closureRequest.reference,
      amount: null,
      currency: null,
      memberShare: null,
      initiatorName,
      awaitingCount: awaiting,
      createdAt: approval.createdAt.toISOString(),
    });
  }

  // --- Account modification ---
  const modificationApprovals = await prisma.chainAccountModificationApproval.findMany({
    where: {
      memberId,
      decision: null,
      modificationRequest: { chainAccountId, status: 'PENDING_APPROVAL' },
    },
    include: { modificationRequest: true },
    orderBy: { createdAt: 'desc' },
  });

  for (const approval of modificationApprovals) {
    const initiator = await prisma.chainAccountMember.findUnique({
      where: { id: approval.modificationRequest.initiatedBy },
      include: { user: { select: { name: true, email: true } } },
    });
    const awaiting = await prisma.chainAccountModificationApproval.count({
      where: { modificationRequestId: approval.modificationRequestId, decision: null },
    });
    const initiatorName = displayName(initiator?.user);
    const what = approval.modificationRequest.modificationType.toLowerCase().replace(/_/g, ' ');

    items.push({
      kind: 'MODIFICATION',
      id: approval.id,
      title: 'Account change approval',
      description: `${initiatorName} wants to change this account's ${what}. Reason given: "${approval.modificationRequest.reason}".`,
      reference: approval.modificationRequest.reference,
      amount: null,
      currency: null,
      memberShare: null,
      initiatorName,
      awaitingCount: awaiting,
      createdAt: approval.createdAt.toISOString(),
    });
  }

  // --- Being removed from the account (this member is the target) ---
  const removalTargets = await prisma.chainAccountRemovalRequest.findMany({
    where: { chainAccountId, targetMemberId: memberId, status: 'PENDING_TARGET_APPROVAL' },
    orderBy: { createdAt: 'desc' },
  });

  for (const request of removalTargets) {
    const initiator = await prisma.chainAccountMember.findUnique({
      where: { id: request.initiatedBy },
      include: { user: { select: { name: true, email: true } } },
    });
    const initiatorName = displayName(initiator?.user);

    items.push({
      kind: 'REMOVAL_TARGET',
      id: request.id,
      title: 'Your removal from this account',
      description: `${initiatorName} asked to remove you from this Chain Account. Reason given: "${request.reason}". If you agree, your removal takes effect as soon as the remaining members approve it; rejecting cancels the request outright.`,
      reference: request.reference,
      amount: null,
      currency: null,
      memberShare: null,
      initiatorName,
      awaitingCount: 1,
      createdAt: request.createdAt.toISOString(),
    });
  }

  // --- Voting on another member's removal ---
  const removalVotes = await prisma.chainAccountRemovalApproval.findMany({
    where: {
      memberId,
      decision: null,
      removalRequest: { chainAccountId, status: 'PENDING_APPROVAL' },
    },
    include: { removalRequest: true },
    orderBy: { createdAt: 'desc' },
  });

  for (const approval of removalVotes) {
    const [initiator, target, awaiting] = await Promise.all([
      prisma.chainAccountMember.findUnique({
        where: { id: approval.removalRequest.initiatedBy },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.chainAccountMember.findUnique({
        where: { id: approval.removalRequest.targetMemberId },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.chainAccountRemovalApproval.count({
        where: { removalRequestId: approval.removalRequestId, decision: null },
      }),
    ]);
    const initiatorName = displayName(initiator?.user);

    items.push({
      kind: 'REMOVAL_VOTE',
      id: approval.id,
      title: 'Member removal approval',
      description: `${initiatorName} asked to remove ${displayName(target?.user)} from this Chain Account, and they have agreed. Reason given: "${approval.removalRequest.reason}". The removal takes effect once every remaining party approves — there is no admin step.`,
      reference: approval.removalRequest.reference,
      amount: null,
      currency: null,
      memberShare: null,
      initiatorName,
      awaitingCount: awaiting,
      createdAt: approval.createdAt.toISOString(),
    });
  }

  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/**
 * Record one member's decision and apply whatever follows from it. The member
 * is always taken from their session, never from the request body, so a member
 * can only ever vote as themselves.
 */
export async function decideApproval(params: {
  chainAccountId: string;
  memberId: string;
  kind: PendingApprovalKind;
  id: string;
  decision: ApprovalDecisionInput;
  notes?: string;
}): Promise<DecideResult> {
  const { chainAccountId, memberId, kind, id, decision, notes } = params;

  switch (kind) {
    case 'WITHDRAWAL':
      return decideWithdrawal({ chainAccountId, memberId, approvalId: id, decision, notes });
    case 'INVESTMENT':
      return decideInvestment({ chainAccountId, memberId, approvalId: id, decision, notes });
    case 'CLOSURE':
      return decideClosure({ chainAccountId, memberId, approvalId: id, decision, notes });
    case 'MODIFICATION':
      return decideModification({ chainAccountId, memberId, approvalId: id, decision, notes });
    case 'REMOVAL_TARGET':
      return decideOwnRemoval({ chainAccountId, memberId, requestId: id, decision });
    case 'REMOVAL_VOTE':
      return decideMemberRemoval({ chainAccountId, memberId, approvalId: id, decision, notes });
    default:
      throw new ApprovalError('Unknown approval type');
  }
}

/** Shared loader for the ChainAccountApproval queue (withdrawals + investments). */
async function loadActionApproval(
  chainAccountId: string,
  memberId: string,
  approvalId: string,
  actionType: 'WITHDRAWAL' | 'INVESTMENT'
) {
  const approval = await prisma.chainAccountApproval.findUnique({
    where: { id: approvalId },
    include: { member: { include: { user: { select: { name: true, email: true } } } } },
  });

  if (!approval || approval.chainAccountId !== chainAccountId || approval.actionType !== actionType) {
    throw new ApprovalError('Approval request not found', 404);
  }

  if (approval.memberId !== memberId) {
    throw new ApprovalError('This approval is not addressed to you', 403);
  }

  if (approval.decision) {
    throw new ApprovalError('You have already responded to this request');
  }

  return approval;
}

/** Approve/reject counts among the other members of one action. */
async function tallyActionApprovals(
  chainAccountId: string,
  actionType: 'WITHDRAWAL' | 'INVESTMENT',
  actionId: string
): Promise<{ approvedCount: number; rejectedCount: number; asksRaised: number }> {
  const rows = await prisma.chainAccountApproval.groupBy({
    by: ['decision'],
    where: { chainAccountId, actionType, actionId },
    _count: { _all: true },
  });

  const countOf = (decision: 'APPROVED' | 'REJECTED') =>
    rows.find(r => r.decision === decision)?._count._all ?? 0;

  return {
    approvedCount: countOf('APPROVED'),
    rejectedCount: countOf('REJECTED'),
    asksRaised: rows.reduce((sum, r) => sum + r._count._all, 0),
  };
}

function approvalSummary(requirement: ApprovalRequirement, approvedCount: number): string {
  return requirement.mode === 'MAJORITY'
    ? `A majority of members (${approvedCount + 1} including the initiator) have approved`
    : 'All members have approved';
}

function rejectionSummary(requirement: ApprovalRequirement, rejectedCount: number): string {
  return requirement.mode === 'MAJORITY'
    ? `Too many members (${rejectedCount}) rejected it for a majority to be reached.`
    : 'A single rejection cancels a request on this account.';
}

async function notifyMembers(
  chainAccountId: string,
  members: Array<{ userId: string }>,
  payload: {
    type: 'APPROVAL_GRANTED' | 'APPROVAL_REJECTED' | 'ACTION_COMPLETED' | 'APPROVAL_REQUEST';
    title: string;
    message: string;
    actionType?: 'WITHDRAWAL' | 'INVESTMENT';
    actionId?: string;
  }
) {
  await Promise.all(
    members.map(m =>
      prisma.chainAccountNotification.create({
        data: {
          chainAccountId,
          userId: m.userId,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          actionType: payload.actionType,
          actionId: payload.actionId,
          isRead: false,
        },
      })
    )
  );
}

async function decideWithdrawal(params: {
  chainAccountId: string;
  memberId: string;
  approvalId: string;
  decision: ApprovalDecisionInput;
  notes?: string;
}): Promise<DecideResult> {
  const { chainAccountId, memberId, approvalId, decision, notes } = params;
  const approval = await loadActionApproval(chainAccountId, memberId, approvalId, 'WITHDRAWAL');

  const withdrawal = await prisma.chainAccountWithdrawal.findUnique({
    where: { id: approval.actionId },
    include: { chainAccount: { include: { members: true } } },
  });

  if (!withdrawal || withdrawal.status !== 'PENDING_APPROVAL') {
    throw new ApprovalError('This withdrawal is no longer awaiting approval');
  }

  await prisma.chainAccountApproval.update({
    where: { id: approval.id },
    data: { decision, status: 'DECIDED', decidedAt: new Date(), notes },
  });

  const approverName = displayName(approval.member.user);
  const otherMembers = withdrawal.chainAccount.members.filter(m => m.id !== memberId);

  // The account's own rule decides whether this decision settles the matter.
  // Under MAJORITY a withdrawal can proceed while a member is still undecided,
  // and one rejection does not necessarily kill it; under THRESHOLD it needs
  // everyone and a single rejection ends it.
  const requirement = approvalRequirementFor({
    authorizationModel: withdrawal.chainAccount.authorizationModel,
    thresholdAmount: withdrawal.chainAccount.thresholdAmount,
    amount: withdrawal.totalAmount,
    memberCount: withdrawal.chainAccount.members.length,
  });

  const tally = await tallyActionApprovals(chainAccountId, 'WITHDRAWAL', withdrawal.id);

  // Judge against the rule this request was raised under, not a rule the
  // parties may have relaxed since.
  const inFlight = requirementForRequestInFlight({
    live: requirement,
    asksRaised: tally.asksRaised,
  });
  const progress = approvalProgress({ requirement: inFlight, ...tally });

  if (progress.state === 'DEAD') {
    // Funds were reserved when the withdrawal was raised, so put them back.
    await prisma.$transaction([
      prisma.chainAccountWithdrawal.update({
        where: { id: withdrawal.id },
        data: { status: 'REJECTED', rejectionReason: notes || `Rejected by ${approverName}` },
      }),
      prisma.chainAccount.update({
        where: { id: withdrawal.chainAccountId },
        data: { balance: { increment: withdrawal.totalAmount } },
      }),
    ]);

    await notifyMembers(chainAccountId, otherMembers, {
      type: 'APPROVAL_REJECTED',
      title: 'Withdrawal rejected',
      message: `${approverName} rejected the withdrawal of ${withdrawal.currency} ${withdrawal.totalAmount.toLocaleString()}. ${rejectionSummary(inFlight, tally.rejectedCount)} The amount has been returned to the account balance.`,
    });

    return {
      message:
        decision === 'REJECTED'
          ? 'You rejected this withdrawal. It has been cancelled and the funds returned to the account.'
          : 'This withdrawal can no longer be approved and has been cancelled. The funds are back in the account.',
    };
  }

  if (progress.state === 'PROCEED') {
    await prisma.chainAccountWithdrawal.update({
      where: { id: withdrawal.id },
      data: { status: 'APPROVED', allApproved: true },
    });

    await notifyMembers(chainAccountId, withdrawal.chainAccount.members, {
      type: 'APPROVAL_GRANTED',
      title: 'Withdrawal approved',
      message: `${approvalSummary(inFlight, tally.approvedCount)} the withdrawal of ${withdrawal.currency} ${withdrawal.totalAmount.toLocaleString()}. It is now awaiting final admin approval.`,
    });

    return { message: 'This withdrawal now has the approvals it needs and is awaiting final admin approval.' };
  }

  await notifyMembers(chainAccountId, otherMembers, {
    type: decision === 'APPROVED' ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED',
    title: 'Withdrawal approval update',
    message: `${approverName} ${decision === 'APPROVED' ? 'approved' : 'rejected'} the withdrawal of ${withdrawal.currency} ${withdrawal.totalAmount.toLocaleString()}. ${progress.stillNeeded} more approval(s) needed.`,
  });

  return {
    message:
      decision === 'APPROVED'
        ? `Approval recorded. ${progress.stillNeeded} more approval(s) needed before this can proceed.`
        : `Your rejection has been recorded. ${progress.stillNeeded} more approval(s) would still let this proceed.`,
  };
}

async function decideInvestment(params: {
  chainAccountId: string;
  memberId: string;
  approvalId: string;
  decision: ApprovalDecisionInput;
  notes?: string;
}): Promise<DecideResult> {
  const { chainAccountId, memberId, approvalId, decision, notes } = params;
  const approval = await loadActionApproval(chainAccountId, memberId, approvalId, 'INVESTMENT');

  const investment = await prisma.chainAccountInvestment.findUnique({
    where: { id: approval.actionId },
    include: {
      plan: { select: { planName: true } },
      chainAccount: { include: { members: true } },
    },
  });

  if (!investment || investment.status !== 'PENDING_APPROVAL') {
    throw new ApprovalError('This investment is no longer awaiting approval');
  }

  await prisma.chainAccountApproval.update({
    where: { id: approval.id },
    data: { decision, status: 'DECIDED', decidedAt: new Date(), notes },
  });

  const approverName = displayName(approval.member.user);
  const otherMembers = investment.chainAccount.members.filter(m => m.id !== memberId);

  const requirement = approvalRequirementFor({
    authorizationModel: investment.chainAccount.authorizationModel,
    thresholdAmount: investment.chainAccount.thresholdAmount,
    amount: investment.amount,
    memberCount: investment.chainAccount.members.length,
  });

  const tally = await tallyActionApprovals(chainAccountId, 'INVESTMENT', investment.id);

  // Judge against the rule this request was raised under, not a rule the
  // parties may have relaxed since.
  const inFlight = requirementForRequestInFlight({
    live: requirement,
    asksRaised: tally.asksRaised,
  });
  const progress = approvalProgress({ requirement: inFlight, ...tally });

  if (progress.state === 'DEAD') {
    // Nothing was debited while the investment was pending, so only the record
    // needs correcting.
    await prisma.chainAccountInvestment.update({
      where: { id: investment.id },
      data: { status: 'CANCELLED', processedAt: new Date() },
    });

    await notifyMembers(chainAccountId, otherMembers, {
      type: 'APPROVAL_REJECTED',
      title: 'Investment rejected',
      message: `${approverName} rejected the ${investment.currency} ${investment.amount.toLocaleString()} investment in ${investment.plan.planName}. ${rejectionSummary(inFlight, tally.rejectedCount)} No funds left the account.`,
    });

    return {
      message:
        decision === 'REJECTED'
          ? 'You rejected this investment. It has been cancelled and no funds left the account.'
          : 'This investment can no longer be approved and has been cancelled. No funds left the account.',
    };
  }

  if (progress.state === 'PROCEED') {
    // Enough approvals in: debit the account and start the investment.
    await prisma.$transaction(async tx => {
      const account = await tx.chainAccount.findUnique({
        where: { id: chainAccountId },
        select: { balance: true },
      });

      if (!account || account.balance < investment.amount) {
        throw new ApprovalError(
          'The account balance is no longer enough to fund this investment. It needs to be raised again.'
        );
      }

      await tx.chainAccount.update({
        where: { id: chainAccountId },
        data: { balance: { decrement: investment.amount }, lastActivityAt: new Date() },
      });

      await tx.chainAccountInvestment.update({
        where: { id: investment.id },
        data: { status: 'ACTIVE', allApproved: true },
      });

      // The ledger line written when the investment was raised recorded an
      // unchanged balance; correct it now that the money has actually moved.
      await tx.chainAccountTransaction.updateMany({
        where: { chainAccountId, relatedInvestmentId: investment.id },
        data: { balanceAfter: account.balance - investment.amount },
      });
    });

    await notifyMembers(chainAccountId, investment.chainAccount.members, {
      type: 'ACTION_COMPLETED',
      title: 'Investment approved and active',
      message: `${approvalSummary(inFlight, tally.approvedCount)} the ${investment.currency} ${investment.amount.toLocaleString()} investment in ${investment.plan.planName}. It is now active.`,
    });

    return { message: 'This investment now has the approvals it needs and is active.' };
  }

  await notifyMembers(chainAccountId, otherMembers, {
    type: decision === 'APPROVED' ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED',
    title: 'Investment approval update',
    message: `${approverName} ${decision === 'APPROVED' ? 'approved' : 'rejected'} the ${investment.currency} ${investment.amount.toLocaleString()} investment in ${investment.plan.planName}. ${progress.stillNeeded} more approval(s) needed.`,
  });

  return {
    message:
      decision === 'APPROVED'
        ? `Approval recorded. ${progress.stillNeeded} more approval(s) needed before this can proceed.`
        : `Your rejection has been recorded. ${progress.stillNeeded} more approval(s) would still let this proceed.`,
  };
}

async function decideClosure(params: {
  chainAccountId: string;
  memberId: string;
  approvalId: string;
  decision: ApprovalDecisionInput;
  notes?: string;
}): Promise<DecideResult> {
  const { chainAccountId, memberId, approvalId, decision, notes } = params;

  const approval = await prisma.chainAccountClosureApproval.findUnique({
    where: { id: approvalId },
    include: { closureRequest: { include: { chainAccount: { include: { members: true } } } } },
  });

  if (!approval || approval.closureRequest.chainAccountId !== chainAccountId) {
    throw new ApprovalError('Closure request not found', 404);
  }

  if (approval.memberId !== memberId) {
    throw new ApprovalError('This approval is not addressed to you', 403);
  }

  if (approval.decision) {
    throw new ApprovalError('You have already responded to this request');
  }

  if (approval.closureRequest.status !== 'PENDING_APPROVAL') {
    throw new ApprovalError('This closure request has already been processed');
  }

  await prisma.chainAccountClosureApproval.update({
    where: { id: approval.id },
    data: { decision, decidedAt: new Date(), notes },
  });

  const members = approval.closureRequest.chainAccount.members;

  if (decision === 'REJECTED') {
    await prisma.chainAccountClosureRequest.update({
      where: { id: approval.closureRequestId },
      data: { status: 'REJECTED', allApproved: false, rejectionReason: notes || undefined },
    });

    await notifyMembers(chainAccountId, members, {
      type: 'APPROVAL_REJECTED',
      title: 'Closure request rejected',
      message: `The request to close ${approval.closureRequest.chainAccount.accountName} was rejected by a member. The account stays open.`,
    });

    return { message: 'You rejected the closure. The account stays open.' };
  }

  const pending = await prisma.chainAccountClosureApproval.count({
    where: { closureRequestId: approval.closureRequestId, decision: null },
  });

  if (pending === 0) {
    await prisma.chainAccountClosureRequest.update({
      where: { id: approval.closureRequestId },
      data: { status: 'PENDING_ADMIN', allApproved: true },
    });

    await notifyMembers(chainAccountId, members, {
      type: 'APPROVAL_GRANTED',
      title: 'Closure fully approved',
      message: `All members have confirmed closing ${approval.closureRequest.chainAccount.accountName}. It is now with an admin for final closure.`,
    });

    return { message: 'All members have confirmed. The closure is now with an admin for final sign-off.' };
  }

  return { message: `Confirmation recorded. Waiting on ${pending} more member(s).` };
}

async function decideModification(params: {
  chainAccountId: string;
  memberId: string;
  approvalId: string;
  decision: ApprovalDecisionInput;
  notes?: string;
}): Promise<DecideResult> {
  const { chainAccountId, memberId, approvalId, decision, notes } = params;

  const approval = await prisma.chainAccountModificationApproval.findUnique({
    where: { id: approvalId },
    include: { modificationRequest: { include: { chainAccount: { include: { members: true } } } } },
  });

  if (!approval || approval.modificationRequest.chainAccountId !== chainAccountId) {
    throw new ApprovalError('Modification request not found', 404);
  }

  if (approval.memberId !== memberId) {
    throw new ApprovalError('This approval is not addressed to you', 403);
  }

  if (approval.decision) {
    throw new ApprovalError('You have already responded to this request');
  }

  if (approval.modificationRequest.status !== 'PENDING_APPROVAL') {
    throw new ApprovalError('This change request has already been processed');
  }

  await prisma.chainAccountModificationApproval.update({
    where: { id: approval.id },
    data: { decision, decidedAt: new Date(), notes },
  });

  const members = approval.modificationRequest.chainAccount.members;
  const what = approval.modificationRequest.modificationType.toLowerCase().replace(/_/g, ' ');

  if (decision === 'REJECTED') {
    await prisma.chainAccountModificationRequest.update({
      where: { id: approval.modificationRequestId },
      data: { status: 'REJECTED', allApproved: false, rejectionReason: notes || undefined },
    });

    await notifyMembers(chainAccountId, members, {
      type: 'APPROVAL_REJECTED',
      title: 'Account change rejected',
      message: `A member rejected the proposed change to this account's ${what}. Nothing has changed.`,
    });

    return { message: 'You rejected the change. Nothing has been applied.' };
  }

  const pending = await prisma.chainAccountModificationApproval.count({
    where: { modificationRequestId: approval.modificationRequestId, decision: null },
  });

  if (pending === 0) {
    // The parties settle their own rules: the last approval applies the change
    // itself. The proposal is re-validated here because this is the point where
    // stored JSON becomes an account update — see chain-account-modifications.
    const sanitized = sanitizeProposedChanges(approval.modificationRequest.proposedChanges);

    if ('error' in sanitized) {
      // Refuse rather than write something unchecked into the account. The
      // request is closed so it cannot sit in anyone's queue forever.
      await prisma.chainAccountModificationRequest.update({
        where: { id: approval.modificationRequestId },
        data: {
          status: 'REJECTED',
          allApproved: false,
          rejectionReason: `Could not be applied: ${sanitized.error}`,
        },
      });

      await notifyMembers(chainAccountId, members, {
        type: 'APPROVAL_REJECTED',
        title: 'Account change could not be applied',
        message: `The approved change to this account's ${what} was not valid and has been cancelled. Nothing has changed.`,
      });

      throw new ApprovalError(`This change cannot be applied: ${sanitized.error}`);
    }

    await prisma.$transaction([
      prisma.chainAccount.update({
        where: { id: chainAccountId },
        data: sanitized.changes,
      }),
      prisma.chainAccountModificationRequest.update({
        where: { id: approval.modificationRequestId },
        data: { status: 'APPROVED', allApproved: true, processedAt: new Date() },
      }),
    ]);

    await notifyMembers(chainAccountId, members, {
      type: 'ACTION_COMPLETED',
      title: 'Account changed',
      message: `All members approved the change to this account's ${what}, and it has been applied.`,
    });

    return { message: 'Every member has approved, and the change has been applied to the account.' };
  }

  return { message: `Approval recorded. Waiting on ${pending} more member(s).` };
}

/**
 * Carry out a removal that every party has agreed to.
 *
 * Removing a member is settled by the parties alone — no admin step. This is
 * the one approval flow that ends in the change itself rather than in a queue,
 * so it is written once and called from both the "the initiator was the only
 * other party" shortcut and the normal vote.
 */
async function completeMemberRemoval(params: {
  chainAccountId: string;
  removalRequestId: string;
  targetMemberId: string;
}): Promise<void> {
  const { chainAccountId, removalRequestId, targetMemberId } = params;

  const target = await prisma.chainAccountMember.findUnique({
    where: { id: targetMemberId },
    include: { user: { select: { name: true, email: true } } },
  });

  await prisma.$transaction([
    prisma.chainAccountRemovalRequest.update({
      where: { id: removalRequestId },
      data: { status: 'APPROVED', allApproved: true, processedAt: new Date() },
    }),
    prisma.chainAccountMember.delete({ where: { id: targetMemberId } }),
  ]);

  const remaining = await prisma.chainAccountMember.findMany({ where: { chainAccountId } });

  await notifyMembers(chainAccountId, remaining, {
    type: 'ACTION_COMPLETED',
    title: 'Member removed',
    message: `${displayName(target?.user)} has been removed from the Chain Account. Every party approved the removal.`,
  });
}

async function decideOwnRemoval(params: {
  chainAccountId: string;
  memberId: string;
  requestId: string;
  decision: ApprovalDecisionInput;
}): Promise<DecideResult> {
  const { chainAccountId, memberId, requestId, decision } = params;

  const request = await prisma.chainAccountRemovalRequest.findUnique({
    where: { id: requestId },
    include: { chainAccount: true },
  });

  if (!request || request.chainAccountId !== chainAccountId) {
    throw new ApprovalError('Removal request not found', 404);
  }

  if (request.targetMemberId !== memberId) {
    throw new ApprovalError('This removal request is not about you', 403);
  }

  if (request.status !== 'PENDING_TARGET_APPROVAL') {
    throw new ApprovalError('This removal request has already been processed');
  }

  if (decision === 'REJECTED') {
    await prisma.chainAccountRemovalRequest.update({
      where: { id: request.id },
      data: { status: 'REJECTED' },
    });

    const initiator = await prisma.chainAccountMember.findUnique({ where: { id: request.initiatedBy } });
    if (initiator) {
      await notifyMembers(chainAccountId, [initiator], {
        type: 'APPROVAL_REJECTED',
        title: 'Removal request rejected',
        message: 'The member rejected their removal from the Chain Account.',
      });
    }

    return { message: 'You rejected the removal. You remain a member of this account.' };
  }

  const target = await prisma.chainAccountMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { name: true, email: true } } },
  });

  // The target agreeing is only the first step. Removing a party changes who
  // owns the account, so every remaining member has to approve as well, and an
  // admin performs the removal itself — nobody is taken off the account here.
  const remaining = await prisma.chainAccountMember.findMany({
    where: { chainAccountId, id: { not: memberId } },
  });

  await prisma.$transaction([
    prisma.chainAccountRemovalRequest.update({
      where: { id: request.id },
      data: {
        targetApproved: true,
        targetApprovedAt: new Date(),
        status: 'PENDING_APPROVAL',
      },
    }),
    // Raising the request counts as the initiator's own approval, so it is
    // recorded rather than asked for — the audit trail still shows every
    // party's decision.
    ...remaining.map(m =>
      prisma.chainAccountRemovalApproval.create({
        data: {
          removalRequestId: request.id,
          memberId: m.id,
          ...(m.id === request.initiatedBy
            ? {
                decision: 'APPROVED' as const,
                decidedAt: new Date(),
                notes: 'Raised this removal request',
              }
            : {}),
        },
      })
    ),
  ]);

  const stillToDecide = await prisma.chainAccountRemovalApproval.count({
    where: { removalRequestId: request.id, decision: null },
  });

  if (stillToDecide === 0) {
    // The initiator was the only other party, so every party has now agreed.
    await completeMemberRemoval({
      chainAccountId,
      removalRequestId: request.id,
      targetMemberId: memberId,
    });

    return {
      message: 'You have agreed to the removal and every party has approved. You are no longer a member of this Chain Account.',
    };
  }

  await notifyMembers(chainAccountId, remaining, {
    type: 'APPROVAL_REQUEST',
    title: 'Member Removal Approval Required',
    message: `${displayName(target?.user)} agreed to be removed from this Chain Account. Your approval is required — open the Approvals panel in your Chain Account dashboard to approve or reject it.`,
  });

  return {
    message:
      'You have agreed to the removal. It takes effect once the remaining members approve it.',
  };
}

async function decideMemberRemoval(params: {
  chainAccountId: string;
  memberId: string;
  approvalId: string;
  decision: ApprovalDecisionInput;
  notes?: string;
}): Promise<DecideResult> {
  const { chainAccountId, memberId, approvalId, decision, notes } = params;

  const approval = await prisma.chainAccountRemovalApproval.findUnique({
    where: { id: approvalId },
    include: { removalRequest: true },
  });

  if (!approval || approval.removalRequest.chainAccountId !== chainAccountId) {
    throw new ApprovalError('Removal request not found', 404);
  }

  if (approval.memberId !== memberId) {
    throw new ApprovalError('This approval is not addressed to you', 403);
  }

  if (approval.decision) {
    throw new ApprovalError('You have already responded to this request');
  }

  if (approval.removalRequest.status !== 'PENDING_APPROVAL') {
    throw new ApprovalError('This removal request has already been processed');
  }

  await prisma.chainAccountRemovalApproval.update({
    where: { id: approval.id },
    data: { decision, decidedAt: new Date(), notes },
  });

  const members = await prisma.chainAccountMember.findMany({ where: { chainAccountId } });

  if (decision === 'REJECTED') {
    await prisma.chainAccountRemovalRequest.update({
      where: { id: approval.removalRequestId },
      data: { status: 'REJECTED', allApproved: false, rejectionReason: notes || undefined },
    });

    await notifyMembers(chainAccountId, members, {
      type: 'APPROVAL_REJECTED',
      title: 'Member removal rejected',
      message: 'A member rejected the removal request. No one has been removed.',
    });

    return { message: 'You rejected the removal. No one has been removed.' };
  }

  const pending = await prisma.chainAccountRemovalApproval.count({
    where: { removalRequestId: approval.removalRequestId, decision: null },
  });

  if (pending === 0) {
    await completeMemberRemoval({
      chainAccountId,
      removalRequestId: approval.removalRequestId,
      targetMemberId: approval.removalRequest.targetMemberId,
    });

    return { message: 'Every party has approved. The member has been removed from this Chain Account.' };
  }

  return { message: `Approval recorded. Waiting on ${pending} more member(s).` };
}
