/**
 * What a Chain Account's authorization model means, in one place.
 *
 * The model and threshold on the account govern the money operations —
 * withdrawals and investments. They do NOT govern closing the account,
 * removing a member or changing how the account is governed: those change who
 * owns the account or the rules themselves, so they always need every party,
 * whatever the model says.
 *
 * The same policy is used on both sides of a request: when it is raised (to
 * decide whether co-owner approval is needed at all) and when each decision
 * lands (to decide whether it can now proceed, is dead, or is still waiting).
 * Keeping both sides on one function is what stops "needs approval" and "has
 * enough approvals" from drifting apart.
 *
 * Raising a request counts as the initiator's own approval, so every count here
 * is expressed in terms of the OTHER members.
 */

export interface ApprovalRequirement {
  /** Does this operation need any co-owner approval at all? */
  required: boolean;
  /** How many of the other members must approve before it can proceed. */
  approvalsNeeded: number;
  /** How many of the other members may reject before it is dead. */
  rejectionsAllowed: number;
  /** UNANIMOUS: everyone. MAJORITY: more than half of all parties. */
  mode: 'NONE' | 'UNANIMOUS' | 'MAJORITY';
  /** Plain-language reason, for notifications and approval cards. */
  reason: string;
}

const NOT_REQUIRED = (reason: string): ApprovalRequirement => ({
  required: false,
  approvalsNeeded: 0,
  rejectionsAllowed: 0,
  mode: 'NONE',
  reason,
});

export function approvalRequirementFor(params: {
  authorizationModel: string;
  thresholdAmount: number | null;
  amount: number;
  /** Total members on the account, including the initiator. */
  memberCount: number;
}): ApprovalRequirement {
  const { authorizationModel, thresholdAmount, amount, memberCount } = params;
  const others = Math.max(0, memberCount - 1);

  // Nobody else to ask.
  if (others === 0) {
    return NOT_REQUIRED('You are the only member of this account');
  }

  // Any signatory may act alone.
  if (authorizationModel === 'INDEPENDENT') {
    return NOT_REQUIRED('This account allows each member to act independently');
  }

  // A threshold of null means every amount is caught.
  const overThreshold = thresholdAmount === null || amount >= thresholdAmount;

  if (!overThreshold) {
    return NOT_REQUIRED(
      `This is below the account's approval threshold of ${thresholdAmount!.toLocaleString()}`
    );
  }

  if (authorizationModel === 'MAJORITY') {
    // A majority of all parties, with the initiator counted as one of them:
    // floor(n/2) + 1 approvals in total, so floor(n/2) from the others.
    const approvalsNeeded = Math.floor(memberCount / 2);

    return {
      required: true,
      approvalsNeeded,
      rejectionsAllowed: others - approvalsNeeded,
      mode: 'MAJORITY',
      reason:
        thresholdAmount === null
          ? 'This account requires majority approval for every transaction'
          : `This is at or above the account's threshold of ${thresholdAmount.toLocaleString()}, so a majority must approve`,
    };
  }

  // THRESHOLD, and anything unrecognised, is treated as the strict reading:
  // every other party has to approve and a single rejection ends it.
  return {
    required: true,
    approvalsNeeded: others,
    rejectionsAllowed: 0,
    mode: 'UNANIMOUS',
    reason:
      thresholdAmount === null
        ? 'This account requires every member to approve each transaction'
        : `This is at or above the account's threshold of ${thresholdAmount.toLocaleString()}, so every member must approve`,
  };
}

/** Where a request stands once a decision has been recorded. */
export type ApprovalProgress = 'PROCEED' | 'DEAD' | 'WAITING';

export function approvalProgress(params: {
  requirement: ApprovalRequirement;
  approvedCount: number;
  rejectedCount: number;
}): { state: ApprovalProgress; stillNeeded: number } {
  const { requirement, approvedCount, rejectedCount } = params;

  const stillNeeded = Math.max(0, requirement.approvalsNeeded - approvedCount);

  if (approvedCount >= requirement.approvalsNeeded) {
    return { state: 'PROCEED', stillNeeded: 0 };
  }

  if (rejectedCount > requirement.rejectionsAllowed) {
    return { state: 'DEAD', stillNeeded };
  }

  return { state: 'WAITING', stillNeeded };
}

/**
 * The rule to judge a request that is ALREADY out for approval.
 *
 * The parties can change their account's authorization model at any time, and
 * the change takes effect the moment the last of them approves it. That can
 * happen while a withdrawal or investment is still out for approval, and
 * recomputing from the new rule would then be wrong in a dangerous way: if the
 * account has just become INDEPENDENT, the live rule says "no approval needed"
 * — approvalsNeeded 0 — and the very next decision would settle the request as
 * approved even if that decision was a REJECTION.
 *
 * So a request raised while approval was required keeps needing it. The
 * outstanding asks stand, every one of them has to approve, and any rejection
 * ends it. Relaxing the rules governs new requests, never ones already in
 * flight.
 */
export function requirementForRequestInFlight(params: {
  live: ApprovalRequirement;
  /** Approvals raised for this request, whatever they have since decided. */
  asksRaised: number;
}): ApprovalRequirement {
  const { live, asksRaised } = params;

  if (live.required || asksRaised === 0) {
    return live;
  }

  return {
    required: true,
    approvalsNeeded: asksRaised,
    rejectionsAllowed: 0,
    mode: 'UNANIMOUS',
    reason:
      'This was raised while the account required approval, so everyone asked must still approve it',
  };
}
