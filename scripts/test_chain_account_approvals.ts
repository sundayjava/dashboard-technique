import 'dotenv/config';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { createChainAccountToken } from '../src/lib/chain-account-session';
import {
  GET as approvalsGET,
  POST as approvalsPOST,
} from '../src/app/api/chain-account/approvals/route';
import { POST as depositPOST } from '../src/app/api/chain-account/deposit/route';
import { POST as withdrawPOST } from '../src/app/api/chain-account/withdraw/route';
import { POST as investPOST } from '../src/app/api/chain-account/invest/route';
import { POST as removeMemberPOST } from '../src/app/api/chain-account/remove-member/route';
import { POST as closeAccountPOST } from '../src/app/api/chain-account/close-account/route';
import { POST as modifyAccountPOST } from '../src/app/api/chain-account/modify-account/route';
import { throwawayPassword } from './fixtures';

/**
 * Chain Account approvals: who has to agree, and where they agree.
 *
 * Two separate rules are under test here, and the suite is built to stop them
 * being confused for each other:
 *
 *  - MONEY operations (withdrawals, investments) are governed by the account's
 *    own authorization model and threshold. INDEPENDENT lets a member act
 *    alone; THRESHOLD needs every other party at or above its limit; MAJORITY
 *    needs more than half the parties, so it can complete while someone is
 *    still undecided. One account per model, each exercised on both sides of
 *    its threshold.
 *
 *  - STRUCTURAL operations (member removal, account changes, closure) always
 *    need every party, whatever the model says. Removal and account changes
 *    are settled by the parties alone; only closure goes to an admin. These are
 *    deliberately tested on an INDEPENDENT account — the model that skips
 *    approval for money — so a leak of the money rule into them would fail.
 *
 * Throughout: a deposit never needs anyone, approvals are decided from a
 * session with no emailed token in the path, and no member can decide another
 * member's approval.
 */

let passed = 0, failed = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label} ${detail}`); }
}

const STAMP = Date.now();
const userIds: string[] = [];
const accountIds: string[] = [];

function req(path: string, method: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Chain-session requests on the older routes carry the token in this header. */
function chainHeaderReq(path: string, body: unknown, token: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Chain-Access-Token': token },
    body: JSON.stringify(body),
  });
}

async function mkUser(tag: string, walletBalance = 0) {
  const user = await prisma.user.create({
    data: {
      email: `chain-approvals-${tag}-${STAMP}@internal.test`,
      name: `Chain Approvals ${tag}`,
      password: throwawayPassword(),
      transactionPin: await bcrypt.hash('1234', 10),
      phoneNumber: '0', countryCode: 'NG', currency: 'USD',
      authorizationCode: `CAP-${tag}-${STAMP}`,
    },
  });
  userIds.push(user.id);

  await prisma.account.create({
    data: {
      userId: user.id,
      accountNumber: `ACC-${tag}-${STAMP}`,
      accountName: `Chain Approvals ${tag}`,
      accountType: 'PERSONAL',
      balance: walletBalance,
      availableBalance: walletBalance,
      currency: 'USD',
    },
  });

  return user;
}

type Party = { id: string; role: 'PRIMARY_HOLDER' | 'CO_SIGNATORY' };

async function mkAccount(params: {
  tag: string;
  authorizationModel: 'INDEPENDENT' | 'THRESHOLD' | 'MAJORITY';
  thresholdAmount: number | null;
  parties: Party[];
  balance?: number;
}) {
  const { tag, authorizationModel, thresholdAmount, parties, balance = 0 } = params;

  const account = await prisma.chainAccount.create({
    data: {
      accountName: `Approvals ${tag}`,
      accountNumber: `CA-${tag}-${STAMP}`,
      primaryPurpose: 'Investment Partnership',
      purposeDescription: 'seeded',
      numberOfParties: parties.length,
      relationship: 'Business Partners',
      expectedMonthlyVolume: 'Under $5,000',
      combinedCapitalLevel: 'Under $50,000',
      intendedAssetHoldings: 'Both',
      authorizationModel,
      thresholdAmount,
      thresholdCurrency: 'USD',
      status: 'ACTIVE',
      balance,
      createdBy: parties[0].id,
      members: {
        create: parties.map(p => ({ userId: p.id, role: p.role, hasConfirmed: true })),
      },
    },
    include: { members: true },
  });
  accountIds.push(account.id);

  const memberOf = (userId: string) => account.members.find(m => m.userId === userId)!;
  const tokenFor = (userId: string) =>
    createChainAccountToken(
      userId, account.id, memberOf(userId).id, account.accountName,
      memberOf(userId).role,
    );

  return { account, memberOf, tokenFor };
}

const balanceOf = async (id: string) =>
  (await prisma.chainAccount.findUnique({ where: { id } }))!.balance;

const queueFor = async (chainAccountId: string, token: string) => {
  const res = await approvalsGET(
    req(`/api/chain-account/approvals?chainAccountId=${chainAccountId}`, 'GET', undefined, token),
  );
  const body = await res.json();
  return (body?.approvals ?? []) as Array<{ kind: string; id: string; memberShare: number | null }>;
};

const decide = (
  chainAccountId: string, kind: string, id: string,
  decision: 'APPROVED' | 'REJECTED', token: string,
) =>
  approvalsPOST(
    req('/api/chain-account/approvals', 'POST', { chainAccountId, kind, id, decision }, token),
  );

async function main() {
  console.log('=== 0. Setup: three parties, one account per authorization model ===');
  const alice = await mkUser('alice', 20_000);
  const bob = await mkUser('bob', 20_000);
  const carol = await mkUser('carol');

  const parties: Party[] = [
    { id: alice.id, role: 'PRIMARY_HOLDER' },
    { id: bob.id, role: 'CO_SIGNATORY' },
    { id: carol.id, role: 'CO_SIGNATORY' },
  ];

  const thr = await mkAccount({ tag: 'THRESHOLD', authorizationModel: 'THRESHOLD', thresholdAmount: 100, parties });
  const ind = await mkAccount({ tag: 'INDEPENDENT', authorizationModel: 'INDEPENDENT', thresholdAmount: 100, parties, balance: 5_000 });
  const maj = await mkAccount({ tag: 'MAJORITY', authorizationModel: 'MAJORITY', thresholdAmount: 100, parties, balance: 5_000 });

  const thrTokens = { alice: thr.tokenFor(alice.id), bob: thr.tokenFor(bob.id), carol: thr.tokenFor(carol.id) };
  const indTokens = { alice: ind.tokenFor(alice.id), bob: ind.tokenFor(bob.id), carol: ind.tokenFor(carol.id) };
  const majTokens = { alice: maj.tokenFor(alice.id), bob: maj.tokenFor(bob.id), carol: maj.tokenFor(carol.id) };
  console.log('  THRESHOLD($100), INDEPENDENT, MAJORITY($100) — 3 members each');

  console.log('\n=== 1. A deposit is never gated on another member ===');
  const deposit = await depositPOST(
    req('/api/chain-account/deposit', 'POST', {
      chainAccountId: thr.account.id,
      amount: 5_000,
      depositMethod: 'WALLET',
      currency: 'USD',
    }, thrTokens.bob),
  );
  const depositBody = await deposit.json();
  check('wallet deposit succeeds', deposit.status === 200,
    `got ${deposit.status} ${JSON.stringify(depositBody)}`);
  check('and is CONFIRMED straight away', depositBody?.deposit?.status === 'CONFIRMED',
    JSON.stringify(depositBody?.deposit));
  check('the account balance is credited immediately', (await balanceOf(thr.account.id)) === 5_000,
    `balance ${await balanceOf(thr.account.id)}`);
  check('the deposit raised no approval requests',
    (await prisma.chainAccountApproval.count({ where: { chainAccountId: thr.account.id } })) === 0);
  check('and no member is asked to approve it',
    (await queueFor(thr.account.id, thrTokens.carol)).length === 0);

  console.log('\n=== 2. INDEPENDENT: a member may withdraw alone ===');
  const independent = await withdrawPOST(
    req('/api/chain-account/withdraw', 'POST', {
      chainAccountId: ind.account.id,
      currency: 'USD',
      distributions: [{ memberId: ind.memberOf(alice.id).id, amount: 4_000 }],
    }, indTokens.alice),
  );
  const independentBody = await independent.json();
  check('a $4,000 withdrawal is accepted', independent.status === 200,
    `got ${independent.status} ${JSON.stringify(independentBody)}`);
  check('and needs no co-owner approval',
    independentBody?.withdrawal?.requiresApproval === false &&
      independentBody?.withdrawal?.status === 'APPROVED',
    JSON.stringify(independentBody?.withdrawal));
  check('no approval rows are raised',
    (await prisma.chainAccountApproval.count({ where: { chainAccountId: ind.account.id } })) === 0);
  check('and nothing appears in anyone\'s queue',
    (await queueFor(ind.account.id, indTokens.bob)).length === 0);

  console.log('\n=== 3. THRESHOLD: below the limit needs nobody, at it needs everybody ===');
  const below = await withdrawPOST(
    req('/api/chain-account/withdraw', 'POST', {
      chainAccountId: thr.account.id,
      currency: 'USD',
      distributions: [{ memberId: thr.memberOf(alice.id).id, amount: 40 }],
    }, thrTokens.alice),
  );
  const belowBody = await below.json();
  check('a $40 withdrawal under the $100 threshold needs no approval',
    below.status === 200 && belowBody?.withdrawal?.requiresApproval === false &&
      belowBody?.withdrawal?.status === 'APPROVED',
    `got ${below.status} ${JSON.stringify(belowBody?.withdrawal)}`);

  const above = await withdrawPOST(
    req('/api/chain-account/withdraw', 'POST', {
      chainAccountId: thr.account.id,
      currency: 'USD',
      distributions: [
        { memberId: thr.memberOf(alice.id).id, amount: 600 },
        { memberId: thr.memberOf(bob.id).id, amount: 400 },
      ],
    }, thrTokens.alice),
  );
  const aboveBody = await above.json();
  check('a $1,000 withdrawal over it is held for approval',
    above.status === 200 && aboveBody?.withdrawal?.status === 'PENDING_APPROVAL' &&
      aboveBody?.withdrawal?.approvalRule === 'UNANIMOUS',
    `got ${above.status} ${JSON.stringify(aboveBody?.withdrawal)}`);
  check('the record itself says approval was required',
    (await prisma.chainAccountWithdrawal.findFirst({
      where: { reference: aboveBody?.withdrawal?.withdrawalReference },
    }))?.requiresApproval === true);

  const unanimous = await prisma.chainAccountApproval.findMany({
    where: { chainAccountId: thr.account.id, decision: null },
  });
  check('an approval is raised for each other party', unanimous.length === 2, `got ${unanimous.length}`);
  check('and none carries an emailed one-time token',
    unanimous.every(a => a.approvalToken === null),
    'an approval still has an approvalToken, so the email path is still in use');

  console.log('\n=== 4. A co-owner sees and decides it from their session ===');
  const bobQueue = await queueFor(thr.account.id, thrTokens.bob);
  check('the withdrawal is in Bob\'s queue',
    bobQueue.length === 1 && bobQueue[0].kind === 'WITHDRAWAL', JSON.stringify(bobQueue));
  check('and it shows Bob his own share, not just the total', bobQueue[0]?.memberShare === 400,
    `memberShare ${bobQueue[0]?.memberShare}`);

  console.log('\n=== 5. One member cannot decide another member\'s approval ===');
  const carolRow = unanimous.find(a => a.memberId === thr.memberOf(carol.id).id)!;
  const crossVote = await decide(thr.account.id, 'WITHDRAWAL', carolRow.id, 'APPROVED', thrTokens.bob);
  check('Bob deciding Carol\'s approval -> 403', crossVote.status === 403, `got ${crossVote.status}`);
  check('and Carol\'s approval is untouched',
    (await prisma.chainAccountApproval.findUnique({ where: { id: carolRow.id } }))?.decision === null);

  const noSession = await approvalsPOST(
    req('/api/chain-account/approvals', 'POST', {
      chainAccountId: thr.account.id, kind: 'WITHDRAWAL', id: bobQueue[0].id, decision: 'APPROVED',
    }),
  );
  check('deciding without a session -> 401', noSession.status === 401, `got ${noSession.status}`);

  console.log('\n=== 6. THRESHOLD completes only when every party is in ===');
  const bobVote = await decide(thr.account.id, 'WITHDRAWAL', bobQueue[0].id, 'APPROVED', thrTokens.bob);
  check('Bob approves', bobVote.status === 200,
    `got ${bobVote.status} ${JSON.stringify(await bobVote.json())}`);
  check('the withdrawal still waits on Carol',
    (await prisma.chainAccountWithdrawal.findFirst({
      where: { reference: aboveBody.withdrawal.withdrawalReference },
    }))?.status === 'PENDING_APPROVAL');

  const replay = await decide(thr.account.id, 'WITHDRAWAL', bobQueue[0].id, 'REJECTED', thrTokens.bob);
  check('Bob cannot vote twice -> 400', replay.status === 400, `got ${replay.status}`);

  const carolVote = await decide(thr.account.id, 'WITHDRAWAL', carolRow.id, 'APPROVED', thrTokens.carol);
  check('Carol approves', carolVote.status === 200, `got ${carolVote.status}`);
  const settled = await prisma.chainAccountWithdrawal.findFirst({
    where: { reference: aboveBody.withdrawal.withdrawalReference },
  });
  check('with everyone in, it moves to the admin queue',
    settled?.status === 'APPROVED' && settled?.allApproved === true, `status ${settled?.status}`);
  check('Bob\'s queue is now empty', (await queueFor(thr.account.id, thrTokens.bob)).length === 0);

  console.log('\n=== 7. THRESHOLD: one rejection cancels and returns the funds ===');
  const balanceBeforeDoomed = await balanceOf(thr.account.id);
  const doomed = await withdrawPOST(
    req('/api/chain-account/withdraw', 'POST', {
      chainAccountId: thr.account.id,
      currency: 'USD',
      distributions: [{ memberId: thr.memberOf(alice.id).id, amount: 500 }],
    }, thrTokens.alice),
  );
  const doomedBody = await doomed.json();
  check('the withdrawal is raised', doomed.status === 200, `got ${doomed.status}`);
  check('and the funds are reserved out of the balance',
    Math.abs((await balanceOf(thr.account.id)) - (balanceBeforeDoomed - 500)) < 0.001,
    `balance ${await balanceOf(thr.account.id)}`);

  const doomedBobItem = (await queueFor(thr.account.id, thrTokens.bob))[0];
  const rejectRes = await decide(thr.account.id, 'WITHDRAWAL', doomedBobItem.id, 'REJECTED', thrTokens.bob);
  check('Bob rejects it', rejectRes.status === 200, `got ${rejectRes.status}`);
  check('the withdrawal is cancelled',
    (await prisma.chainAccountWithdrawal.findFirst({
      where: { reference: doomedBody.withdrawal.withdrawalReference },
    }))?.status === 'REJECTED');
  check('the funds are back in the account',
    Math.abs((await balanceOf(thr.account.id)) - balanceBeforeDoomed) < 0.001,
    `balance ${await balanceOf(thr.account.id)}, expected ${balanceBeforeDoomed}`);
  check('and Carol is no longer asked about it',
    (await queueFor(thr.account.id, thrTokens.carol)).length === 0);

  console.log('\n=== 8. MAJORITY: proceeds on a majority, without waiting for everyone ===');
  const majWithdrawal = await withdrawPOST(
    req('/api/chain-account/withdraw', 'POST', {
      chainAccountId: maj.account.id,
      currency: 'USD',
      distributions: [{ memberId: maj.memberOf(alice.id).id, amount: 500 }],
    }, majTokens.alice),
  );
  const majBody = await majWithdrawal.json();
  check('the withdrawal is held for approval',
    majWithdrawal.status === 200 && majBody?.withdrawal?.status === 'PENDING_APPROVAL',
    `got ${majWithdrawal.status} ${JSON.stringify(majBody?.withdrawal)}`);
  check('and only one of the two other parties is needed',
    majBody?.withdrawal?.approvalRule === 'MAJORITY' && majBody?.withdrawal?.approvalsNeeded === 1,
    JSON.stringify(majBody?.withdrawal));

  const majBobItem = (await queueFor(maj.account.id, majTokens.bob))[0];
  const majBobVote = await decide(maj.account.id, 'WITHDRAWAL', majBobItem.id, 'APPROVED', majTokens.bob);
  check('Bob approves', majBobVote.status === 200,
    `got ${majBobVote.status} ${JSON.stringify(await majBobVote.json())}`);
  check('that is already a majority, so it moves to the admin queue',
    (await prisma.chainAccountWithdrawal.findFirst({
      where: { reference: majBody.withdrawal.withdrawalReference },
    }))?.status === 'APPROVED');
  check('and Carol, still undecided, is no longer asked',
    (await queueFor(maj.account.id, majTokens.carol)).length === 0);

  console.log('\n=== 9. MAJORITY: dies once a majority is out of reach ===');
  const majBalanceBefore = await balanceOf(maj.account.id);
  const majDoomed = await withdrawPOST(
    req('/api/chain-account/withdraw', 'POST', {
      chainAccountId: maj.account.id,
      currency: 'USD',
      distributions: [{ memberId: maj.memberOf(alice.id).id, amount: 300 }],
    }, majTokens.alice),
  );
  const majDoomedBody = await majDoomed.json();
  check('the withdrawal is raised', majDoomed.status === 200, `got ${majDoomed.status}`);

  const majDoomedBob = (await queueFor(maj.account.id, majTokens.bob))[0];
  const firstReject = await decide(maj.account.id, 'WITHDRAWAL', majDoomedBob.id, 'REJECTED', majTokens.bob);
  check('one rejection does NOT kill it under majority', firstReject.status === 200 &&
    (await prisma.chainAccountWithdrawal.findFirst({
      where: { reference: majDoomedBody.withdrawal.withdrawalReference },
    }))?.status === 'PENDING_APPROVAL',
    'a single rejection should still leave a majority reachable');

  const majDoomedCarol = (await queueFor(maj.account.id, majTokens.carol))[0];
  check('Carol is still asked', !!majDoomedCarol);
  const secondReject = await decide(maj.account.id, 'WITHDRAWAL', majDoomedCarol.id, 'REJECTED', majTokens.carol);
  check('the second rejection does', secondReject.status === 200 &&
    (await prisma.chainAccountWithdrawal.findFirst({
      where: { reference: majDoomedBody.withdrawal.withdrawalReference },
    }))?.status === 'REJECTED');
  check('and the funds are returned',
    Math.abs((await balanceOf(maj.account.id)) - majBalanceBefore) < 0.001,
    `balance ${await balanceOf(maj.account.id)}, expected ${majBalanceBefore}`);

  console.log('\n=== 10. An investment is debited only once it has its approvals ===');
  const plan = await prisma.investmentPlan.create({
    data: {
      planName: `Approvals Test Plan ${STAMP}`,
      minAmount: 1,
      maxAmount: 1_000_000,
      arkIIAllocation: 0,
      duration: 30,
      profitPercentage: 5,
      isActive: true,
      chainAccountsEnabled: true,
    },
  });

  const balanceBeforeInvestment = await balanceOf(thr.account.id);
  const invested = await investPOST(
    req('/api/chain-account/invest', 'POST', {
      chainAccountId: thr.account.id,
      investmentPlanId: plan.id,
      amount: 800,
      currency: 'USD',
    }, thrTokens.alice),
  );
  const investedBody = await invested.json();
  check('investment over the threshold is held for approval',
    invested.status === 200 && investedBody?.investment?.status === 'PENDING_APPROVAL',
    `got ${invested.status} ${JSON.stringify(investedBody)}`);
  check('and nothing is debited while it waits',
    Math.abs((await balanceOf(thr.account.id)) - balanceBeforeInvestment) < 0.001,
    `before ${balanceBeforeInvestment}, now ${await balanceOf(thr.account.id)}`);

  const investRows = await prisma.chainAccountApproval.findMany({
    where: { chainAccountId: thr.account.id, actionType: 'INVESTMENT', decision: null },
  });
  check('an approval is raised for each other party', investRows.length === 2, `got ${investRows.length}`);

  for (const row of investRows) {
    const token = row.memberId === thr.memberOf(bob.id).id ? thrTokens.bob : thrTokens.carol;
    const res = await decide(thr.account.id, 'INVESTMENT', row.id, 'APPROVED', token);
    check('investment approval recorded', res.status === 200,
      `got ${res.status} ${JSON.stringify(await res.json())}`);
  }

  const activated = await prisma.chainAccountInvestment.findFirst({
    where: { chainAccountId: thr.account.id }, orderBy: { createdAt: 'desc' },
  });
  check('the investment goes active once everyone approves', activated?.status === 'ACTIVE',
    `status ${activated?.status}`);
  check('and only then is the account debited',
    Math.abs((await balanceOf(thr.account.id)) - (balanceBeforeInvestment - 800)) < 0.001,
    `before ${balanceBeforeInvestment}, after ${await balanceOf(thr.account.id)}`);

  // Everything below runs on the INDEPENDENT account on purpose. That model
  // lets a member move money alone, so if it also skipped approval here, these
  // would fail.
  console.log('\n=== 11. Member removal: every party, and no admin step ===');
  const removal = await removeMemberPOST(chainHeaderReq('/api/chain-account/remove-member', {
    chainAccountId: ind.account.id,
    targetMemberId: ind.memberOf(carol.id).id,
    reason: 'testing the in-dashboard removal queue',
  }, indTokens.alice));
  check('removal request is raised', removal.status === 200,
    `got ${removal.status} ${JSON.stringify(await removal.json())}`);

  const carolRemovalItem = (await queueFor(ind.account.id, indTokens.carol))
    .find(a => a.kind === 'REMOVAL_TARGET');
  check('Carol sees her own removal in her queue', !!carolRemovalItem);

  const carolAgrees = await decide(ind.account.id, 'REMOVAL_TARGET', carolRemovalItem!.id, 'APPROVED', indTokens.carol);
  check('Carol agrees to be removed', carolAgrees.status === 200, `got ${carolAgrees.status}`);
  check('but she is NOT removed on her own say-so',
    (await prisma.chainAccountMember.count({
      where: { chainAccountId: ind.account.id, userId: carol.id },
    })) === 1);

  const removalRequest = await prisma.chainAccountRemovalRequest.findFirst({
    where: { chainAccountId: ind.account.id }, include: { approvals: true },
  });
  check('the request moves to the remaining parties',
    removalRequest?.status === 'PENDING_APPROVAL', `status ${removalRequest?.status}`);
  check('every remaining party has an approval row', removalRequest?.approvals.length === 2,
    `got ${removalRequest?.approvals.length}`);
  check('and the initiator\'s own approval is already recorded',
    removalRequest?.approvals.find(a => a.memberId === ind.memberOf(alice.id).id)?.decision === 'APPROVED');

  const bobRemovalItem = (await queueFor(ind.account.id, indTokens.bob))
    .find(a => a.kind === 'REMOVAL_VOTE');
  check('Bob is asked to approve the removal', !!bobRemovalItem);
  const bobApproves = await decide(ind.account.id, 'REMOVAL_VOTE', bobRemovalItem!.id, 'APPROVED', indTokens.bob);
  check('Bob approves', bobApproves.status === 200, `got ${bobApproves.status}`);
  const settledRemoval = await prisma.chainAccountRemovalRequest.findFirst({
    where: { chainAccountId: ind.account.id },
  });
  check('with every party in, the removal is complete — no admin step',
    settledRemoval?.status === 'APPROVED' && settledRemoval?.allApproved === true &&
      settledRemoval?.processedAt !== null,
    `status ${settledRemoval?.status}`);
  check('and she is actually off the account',
    (await prisma.chainAccountMember.count({
      where: { chainAccountId: ind.account.id, userId: carol.id },
    })) === 0);
  check('the remaining parties are still on it',
    (await prisma.chainAccountMember.count({ where: { chainAccountId: ind.account.id } })) === 2);

  console.log('\n=== 12. Changing the account: a proposal, and a majority is not enough ===');
  const modify = (body: unknown, token: string) =>
    modifyAccountPOST(chainHeaderReq('/api/chain-account/modify-account', body, token));

  // The balance is the thing that must never be reachable this way: the
  // proposal is replayed into the account later, so an unchecked field here
  // would be a way to mint money.
  const balanceBeforeModify = await balanceOf(maj.account.id);
  const malicious = await modify({
    chainAccountId: maj.account.id,
    modificationType: 'THRESHOLD_AMOUNT',
    proposedChanges: { balance: 999_999 },
    reason: 'trying to rewrite a field that is not mine to change',
  }, majTokens.alice);
  check('a proposal naming a forbidden field is rejected -> 400', malicious.status === 400,
    `got ${malicious.status} ${JSON.stringify(await malicious.json())}`);
  check('and the balance is untouched', (await balanceOf(maj.account.id)) === balanceBeforeModify);

  const proposed = await modify({
    chainAccountId: maj.account.id,
    modificationType: 'AUTHORIZATION_MODEL',
    proposedChanges: { authorizationModel: 'THRESHOLD' },
    reason: 'testing the change approval flow',
  }, majTokens.alice);
  check('a valid change is accepted', proposed.status === 200,
    `got ${proposed.status} ${JSON.stringify(await proposed.json())}`);
  check('but the account is not changed yet',
    (await prisma.chainAccount.findUnique({ where: { id: maj.account.id } }))?.authorizationModel === 'MAJORITY');

  const modRequest = await prisma.chainAccountModificationRequest.findFirst({
    where: { chainAccountId: maj.account.id }, include: { approvals: true },
    orderBy: { createdAt: 'desc' },
  });
  check('it waits on the members', modRequest?.status === 'PENDING_APPROVAL',
    `status ${modRequest?.status}`);
  check('the initiator\'s approval is already recorded',
    modRequest?.approvals.find(a => a.memberId === maj.memberOf(alice.id).id)?.decision === 'APPROVED');

  const modifyItem = (await queueFor(maj.account.id, majTokens.bob)).find(a => a.kind === 'MODIFICATION');
  check('and the other parties are asked', !!modifyItem);

  const carolModRow = modRequest!.approvals.find(a => a.memberId === maj.memberOf(carol.id).id)!;
  const bobModVote = await decide(maj.account.id, 'MODIFICATION', modifyItem!.id, 'APPROVED', majTokens.bob);
  // This account approves MONEY by majority. One of two other parties would
  // be a majority — and it is deliberately not enough for a structural change.
  check('a majority is not enough for a structural change', bobModVote.status === 200 &&
    (await prisma.chainAccountModificationRequest.findUnique({ where: { id: modRequest!.id } }))?.status === 'PENDING_APPROVAL');

  const carolModVote = await decide(maj.account.id, 'MODIFICATION', carolModRow.id, 'APPROVED', majTokens.carol);
  check('with every party in, the change is complete — no admin step', carolModVote.status === 200 &&
    (await prisma.chainAccountModificationRequest.findUnique({ where: { id: modRequest!.id } }))?.status === 'APPROVED');
  check('and the last approval applied it to the account',
    (await prisma.chainAccount.findUnique({ where: { id: maj.account.id } }))?.authorizationModel === 'THRESHOLD',
    `model is ${(await prisma.chainAccount.findUnique({ where: { id: maj.account.id } }))?.authorizationModel}`);

  console.log('\n=== 13. Relaxing the rules does not settle a request already in flight ===');
  // The parties can now switch their account to INDEPENDENT themselves, and it
  // takes effect at once. If the decision side simply re-read the live rule, a
  // withdrawal already out for approval would need zero approvals — and the
  // next decision would settle it as approved even when that decision is a
  // REJECTION. The rule in force when a request was raised has to stick.
  const freeze = await mkAccount({
    tag: 'FREEZE', authorizationModel: 'THRESHOLD', thresholdAmount: 100, parties, balance: 2_000,
  });
  const freezeTokens = {
    alice: freeze.tokenFor(alice.id),
    bob: freeze.tokenFor(bob.id),
    carol: freeze.tokenFor(carol.id),
  };

  const inFlight = await withdrawPOST(
    req('/api/chain-account/withdraw', 'POST', {
      chainAccountId: freeze.account.id,
      currency: 'USD',
      distributions: [{ memberId: freeze.memberOf(alice.id).id, amount: 500 }],
    }, freezeTokens.alice),
  );
  const inFlightBody = await inFlight.json();
  check('a $500 withdrawal is raised under THRESHOLD and held',
    inFlight.status === 200 && inFlightBody?.withdrawal?.status === 'PENDING_APPROVAL',
    `got ${inFlight.status} ${JSON.stringify(inFlightBody?.withdrawal)}`);
  const reservedBalance = await balanceOf(freeze.account.id);

  // The parties agree to go INDEPENDENT; the change applies immediately.
  await prisma.chainAccount.update({
    where: { id: freeze.account.id },
    data: { authorizationModel: 'INDEPENDENT' },
  });

  const freezeBobItem = (await queueFor(freeze.account.id, freezeTokens.bob))[0];
  check('the pending withdrawal is still waiting on the parties who were asked', !!freezeBobItem);

  const freezeBobApproves = await decide(
    freeze.account.id, 'WITHDRAWAL', freezeBobItem.id, 'APPROVED', freezeTokens.bob);
  check('one approval does not settle it just because the rule relaxed',
    freezeBobApproves.status === 200 &&
      (await prisma.chainAccountWithdrawal.findFirst({
        where: { reference: inFlightBody.withdrawal.withdrawalReference },
      }))?.status === 'PENDING_APPROVAL',
    'the relaxed rule leaked into a request that was already in flight');

  const freezeCarolItem = (await queueFor(freeze.account.id, freezeTokens.carol))[0];
  check('Carol is still asked', !!freezeCarolItem);
  const freezeCarolRejects = await decide(
    freeze.account.id, 'WITHDRAWAL', freezeCarolItem.id, 'REJECTED', freezeTokens.carol);
  check('and her rejection still cancels it, rather than reading as approval',
    freezeCarolRejects.status === 200 &&
      (await prisma.chainAccountWithdrawal.findFirst({
        where: { reference: inFlightBody.withdrawal.withdrawalReference },
      }))?.status === 'REJECTED');
  check('with the reserved funds returned',
    Math.abs((await balanceOf(freeze.account.id)) - (reservedBalance + 500)) < 0.001,
    `balance ${await balanceOf(freeze.account.id)}, expected ${reservedBalance + 500}`);

  console.log('\n=== 14. Closure needs every party, and never the initiator twice ===');
  const closing = await mkAccount({
    tag: 'CLOSURE', authorizationModel: 'INDEPENDENT', thresholdAmount: null,
    parties: [{ id: alice.id, role: 'PRIMARY_HOLDER' }, { id: bob.id, role: 'CO_SIGNATORY' }],
    balance: 0,
  });
  const closingAliceToken = closing.tokenFor(alice.id);
  const closingBobToken = closing.tokenFor(bob.id);

  const closure = await closeAccountPOST(chainHeaderReq('/api/chain-account/close-account', {
    chainAccountId: closing.account.id, reason: 'testing closure approvals',
  }, closingAliceToken));
  check('closure request is raised', closure.status === 200,
    `got ${closure.status} ${JSON.stringify(await closure.json())}`);
  check('the initiator is not asked to approve her own request',
    (await queueFor(closing.account.id, closingAliceToken)).length === 0);

  const closureItem = (await queueFor(closing.account.id, closingBobToken)).find(a => a.kind === 'CLOSURE');
  check('but the other party is', !!closureItem);

  const bobConfirms = await decide(closing.account.id, 'CLOSURE', closureItem!.id, 'APPROVED', closingBobToken);
  check('the other party confirms', bobConfirms.status === 200, `got ${bobConfirms.status}`);
  const settledClosure = await prisma.chainAccountClosureRequest.findFirst({
    where: { chainAccountId: closing.account.id },
  });
  check('and the closure waits on the admin',
    settledClosure?.status === 'PENDING_ADMIN' && settledClosure?.allApproved === true,
    `status ${settledClosure?.status}`);
  check('the account is not closed by the members themselves',
    (await prisma.chainAccount.findUnique({ where: { id: closing.account.id } }))?.status === 'ACTIVE');
}

async function cleanup() {
  console.log('\n=== Cleanup ===');
  for (const id of accountIds) {
    await prisma.chainAccount.delete({ where: { id } }).catch(() => undefined);
  }
  await prisma.investmentPlan.deleteMany({
    where: { planName: `Approvals Test Plan ${STAMP}` },
  }).catch(() => undefined);
  for (const id of userIds) {
    await prisma.transaction.deleteMany({ where: { userId: id } }).catch(() => undefined);
    await prisma.account.deleteMany({ where: { userId: id } }).catch(() => undefined);
    await prisma.notification.deleteMany({ where: { userId: id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id } }).catch(() => undefined);
  }
  console.log(`  test users remaining: ${await prisma.user.count({
    where: { email: { contains: 'chain-approvals-' } },
  })}`);
}

main()
  .catch((e) => { console.error('FATAL', e); failed++; })
  .finally(async () => {
    await cleanup();
    console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
    await prisma.$disconnect();
    process.exit(failed === 0 ? 0 : 1);
  });
