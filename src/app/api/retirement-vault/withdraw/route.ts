import { NextRequest, NextResponse } from 'next/server';
import { VaultStatus, VaultWithdrawalStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';
import { loadVaultPolicy } from '@/lib/vault/policy-store';
import { getOpenVaultForUser } from '@/lib/vault/vault-utils';
import { valueVault } from '@/lib/vault/valuation';
import {
  OPEN_WITHDRAWAL_STATUSES,
  getCommittedWithdrawalAmount,
  quoteWithdrawal,
} from '@/lib/vault/withdrawal-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * List a member's withdrawal requests, and quote a prospective one.
 *
 * `?quote=<amount>` prices a withdrawal without creating it, so the member can
 * see the penalty and the release date before committing.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const vault = await getOpenVaultForUser(auth.user.userId);
    if (vault === null) {
      return NextResponse.json(
        { success: false, error: 'You do not have a Retirement Vault.' },
        { status: 404 },
      );
    }

    const [requests, policy, valuation, committed] = await Promise.all([
      prisma.vaultWithdrawalRequest.findMany({
        where: { vaultId: vault.id },
        orderBy: { requestedAt: 'desc' },
        take: 20,
      }),
      loadVaultPolicy(),
      valueVault(vault.id),
      getCommittedWithdrawalAmount(vault.id),
    ]);

    const available = Math.max(0, (valuation?.totalValue ?? 0) - committed);

    const quoteParam = new URL(request.url).searchParams.get('quote');
    let quote = null;
    if (quoteParam !== null) {
      const amount = Number(quoteParam);
      if (Number.isFinite(amount) && amount > 0) {
        quote = quoteWithdrawal({
          amount,
          horizon: vault.horizon,
          activatedAt: vault.activatedAt,
          lockInPreference: vault.lockInPreference,
          policy,
        });
      }
    }

    return NextResponse.json({
      success: true,
      vaultValue: valuation?.totalValue ?? 0,
      committedToOpenRequests: committed,
      availableToWithdraw: available,
      lockInPreference: vault.lockInPreference,
      noticePeriodDays: policy.withdrawalNoticeDays,
      quote,
      requests: requests.map((r) => ({
        id: r.id,
        amount: r.amount,
        penaltyPercent: r.penaltyPercent,
        penaltyAmount: r.penaltyAmount,
        netAmount: r.netAmount,
        isEarlyWithdrawal: r.isEarlyWithdrawal,
        status: r.status,
        requestedAt: r.requestedAt,
        noticeEndsAt: r.noticeEndsAt,
        processedAt: r.processedAt,
        canCancel: OPEN_WITHDRAWAL_STATUSES.includes(r.status),
      })),
    });
  } catch (error) {
    console.error('[Vault Withdraw] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load withdrawals.' },
      { status: 500 },
    );
  }
}

/**
 * Request a withdrawal.
 *
 * Nothing is sold here. The notice period must be served first, so units stay
 * invested — and keep earning — until the request is actually paid. The quote
 * is stored on the request, so a later policy change cannot alter the penalty
 * the member agreed to.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const userId = auth.user.userId;
    const body = (await request.json()) as { amount?: number; transactionPin?: string; reason?: string };

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Enter a valid amount.' },
        { status: 400 },
      );
    }

    const vault = await getOpenVaultForUser(userId);
    if (vault === null) {
      return NextResponse.json(
        { success: false, error: 'You do not have a Retirement Vault.' },
        { status: 404 },
      );
    }

    if (vault.status !== VaultStatus.ACTIVE) {
      return NextResponse.json(
        { success: false, error: 'Only an active vault can be withdrawn from.' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { transactionPin: true },
    });
    if (user === null) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    if (typeof body.transactionPin !== 'string' || body.transactionPin.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Your transaction PIN is required.' },
        { status: 400 },
      );
    }

    const pinValid = await bcrypt.compare(body.transactionPin, user.transactionPin);
    if (!pinValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction PIN.' },
        { status: 401 },
      );
    }

    const [valuation, committed, policy] = await Promise.all([
      valueVault(vault.id),
      getCommittedWithdrawalAmount(vault.id),
      loadVaultPolicy(),
    ]);

    if (valuation === null || !valuation.complete) {
      return NextResponse.json(
        {
          success: false,
          error: 'Your vault cannot be valued right now. Please try again shortly.',
        },
        { status: 503 },
      );
    }

    // Already-committed requests count against the balance, or several
    // requests could each pass on their own and together exceed the vault.
    const available = valuation.totalValue - committed;
    if (amount > available + 1e-6) {
      return NextResponse.json(
        {
          success: false,
          error:
            committed > 0
              ? `You can withdraw up to $${available.toFixed(2)}. ` +
                `$${committed.toFixed(2)} is committed to existing requests.`
              : `You can withdraw up to $${available.toFixed(2)}.`,
        },
        { status: 400 },
      );
    }

    const quote = quoteWithdrawal({
      amount,
      horizon: vault.horizon,
      activatedAt: vault.activatedAt,
      lockInPreference: vault.lockInPreference,
      policy,
    });

    const created = await prisma.vaultWithdrawalRequest.create({
      data: {
        vaultId: vault.id,
        amount,
        currency: vault.currency,
        noticePeriodDays: quote.noticePeriodDays,
        noticeEndsAt: quote.noticeEndsAt,
        penaltyPercent: quote.penaltyPercent,
        penaltyAmount: quote.penaltyAmount,
        netAmount: quote.netAmount,
        isEarlyWithdrawal: quote.isEarly,
        reason: body.reason?.slice(0, 500) ?? null,
        status: VaultWithdrawalStatus.PENDING_NOTICE,
      },
    });

    await prisma.notification
      .create({
        data: {
          userId,
          type: 'INVESTMENT',
          title: 'Withdrawal request received',
          message:
            `Your request to withdraw $${amount.toLocaleString()} from ${vault.vaultNumber} ` +
            `is in its ${quote.noticePeriodDays}-day notice period. ` +
            `You will receive $${quote.netAmount.toFixed(2)} after a ` +
            `$${quote.penaltyAmount.toFixed(2)} penalty. You can cancel before release.`,
          link: '/retirement-vault/dashboard',
        },
      })
      .catch((e) => console.error('[Vault Withdraw] notification failed:', e));

    return NextResponse.json({
      success: true,
      request: {
        id: created.id,
        amount: created.amount,
        penaltyPercent: created.penaltyPercent,
        penaltyAmount: created.penaltyAmount,
        netAmount: created.netAmount,
        isEarlyWithdrawal: created.isEarlyWithdrawal,
        noticeEndsAt: created.noticeEndsAt,
        status: created.status,
      },
      explanation: quote.explanation,
    });
  } catch (error) {
    console.error('[Vault Withdraw] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not submit your request.' },
      { status: 500 },
    );
  }
}

/**
 * Cancel a request during or after notice, before it is paid.
 *
 * Cancellation is always available while money has not moved: the notice
 * period exists to make someone pause, not to lock them into a decision.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const requestId = new URL(request.url).searchParams.get('id');
    if (requestId === null) {
      return NextResponse.json(
        { success: false, error: 'Request id is required.' },
        { status: 400 },
      );
    }

    const vault = await getOpenVaultForUser(auth.user.userId);
    if (vault === null) {
      return NextResponse.json({ success: false, error: 'No vault found.' }, { status: 404 });
    }

    // Scoped to the member's own vault so an id alone cannot cancel someone
    // else's request.
    const existing = await prisma.vaultWithdrawalRequest.findFirst({
      where: { id: requestId, vaultId: vault.id },
    });

    if (existing === null) {
      return NextResponse.json(
        { success: false, error: 'Request not found.' },
        { status: 404 },
      );
    }

    if (!OPEN_WITHDRAWAL_STATUSES.includes(existing.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `This request is ${existing.status.toLowerCase().replace(/_/g, ' ')} and can no longer be cancelled.`,
        },
        { status: 400 },
      );
    }

    await prisma.vaultWithdrawalRequest.update({
      where: { id: existing.id },
      data: { status: VaultWithdrawalStatus.CANCELLED, processedAt: new Date() },
    });

    return NextResponse.json({ success: true, cancelled: existing.id });
  } catch (error) {
    console.error('[Vault Withdraw] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not cancel the request.' },
      { status: 500 },
    );
  }
}
