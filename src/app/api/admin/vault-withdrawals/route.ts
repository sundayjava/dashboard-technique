import { NextRequest, NextResponse } from 'next/server';
import { AccountStatus, VaultStatus, VaultWithdrawalStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-middleware';
import {
  applyLiquidationPlan,
  buildLiquidationPlan,
  serveElapsedNotices,
} from '@/lib/vault/withdrawal-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Queue of withdrawal requests for admin review. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.success) return auth.response;

    // Promote anything whose notice has quietly elapsed, so the queue an admin
    // sees is accurate even if the nightly cron has not run since.
    const served = await serveElapsedNotices();

    const status = new URL(request.url).searchParams.get('status');

    const requests = await prisma.vaultWithdrawalRequest.findMany({
      where: status ? { status: status as VaultWithdrawalStatus } : {},
      orderBy: { requestedAt: 'desc' },
      take: 100,
      include: {
        vault: {
          select: {
            vaultNumber: true,
            lockInPreference: true,
            horizon: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      promotedFromNotice: served,
      requests: requests.map((r) => ({
        id: r.id,
        vaultNumber: r.vault.vaultNumber,
        memberName: r.vault.user.name,
        memberEmail: r.vault.user.email,
        amount: r.amount,
        penaltyPercent: r.penaltyPercent,
        penaltyAmount: r.penaltyAmount,
        penaltyWaived: r.penaltyWaived,
        netAmount: r.netAmount,
        isEarlyWithdrawal: r.isEarlyWithdrawal,
        status: r.status,
        reason: r.reason,
        requestedAt: r.requestedAt,
        noticeEndsAt: r.noticeEndsAt,
        noticeElapsed: r.noticeEndsAt <= new Date(),
        processedAt: r.processedAt,
        adminNotes: r.adminNotes,
      })),
    });
  } catch (error) {
    console.error('[Admin Vault Withdrawals] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load withdrawals.' },
      { status: 500 },
    );
  }
}

/**
 * Act on a withdrawal request: pay, reject, or waive its penalty.
 *
 * Paying is the only action that moves money. It sells units proportionally,
 * credits the member's account and records the whole thing in one transaction,
 * because a sale without a credit would take someone's holdings and give them
 * nothing.
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.success) return auth.response;

    const adminId = auth.user.userId;
    const body = (await request.json()) as {
      id?: string;
      action?: 'pay' | 'reject' | 'waive-penalty';
      adminNotes?: string;
    };

    if (typeof body.id !== 'string') {
      return NextResponse.json({ success: false, error: 'Request id required.' }, { status: 400 });
    }

    const existing = await prisma.vaultWithdrawalRequest.findUnique({
      where: { id: body.id },
      include: { vault: { select: { id: true, userId: true, vaultNumber: true, currency: true } } },
    });

    if (existing === null) {
      return NextResponse.json({ success: false, error: 'Request not found.' }, { status: 404 });
    }

    const terminal: VaultWithdrawalStatus[] = [
      VaultWithdrawalStatus.PAID,
      VaultWithdrawalStatus.REJECTED,
      VaultWithdrawalStatus.CANCELLED,
    ];
    if (terminal.includes(existing.status)) {
      return NextResponse.json(
        { success: false, error: `This request is already ${existing.status.toLowerCase()}.` },
        { status: 400 },
      );
    }

    // --- reject -------------------------------------------------------------
    if (body.action === 'reject') {
      await prisma.vaultWithdrawalRequest.update({
        where: { id: existing.id },
        data: {
          status: VaultWithdrawalStatus.REJECTED,
          processedBy: adminId,
          processedAt: new Date(),
          adminNotes: body.adminNotes?.slice(0, 1000) ?? null,
        },
      });

      await prisma.notification
        .create({
          data: {
            userId: existing.vault.userId,
            type: 'INVESTMENT',
            title: 'Withdrawal request declined',
            message:
              `Your request to withdraw $${existing.amount.toLocaleString()} was declined. ` +
              `${body.adminNotes ?? 'Please contact support for details.'}`,
            link: '/retirement-vault/dashboard',
          },
        })
        .catch(() => undefined);

      return NextResponse.json({ success: true, status: 'REJECTED' });
    }

    // --- waive the penalty --------------------------------------------------
    if (body.action === 'waive-penalty') {
      const updated = await prisma.vaultWithdrawalRequest.update({
        where: { id: existing.id },
        data: {
          penaltyWaived: true,
          penaltyAmount: 0,
          // Waiving returns the penalty to the member, so net rises to gross.
          netAmount: existing.amount,
          waiverReason: body.adminNotes?.slice(0, 1000) ?? null,
          processedBy: adminId,
        },
      });
      return NextResponse.json({
        success: true,
        penaltyWaived: true,
        netAmount: updated.netAmount,
      });
    }

    // --- pay ----------------------------------------------------------------
    if (body.action !== 'pay') {
      return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400 });
    }

    if (existing.status === VaultWithdrawalStatus.PENDING_NOTICE) {
      return NextResponse.json(
        {
          success: false,
          error:
            `The notice period runs until ${existing.noticeEndsAt.toISOString().slice(0, 10)}. ` +
            `Pay only after it has elapsed.`,
        },
        { status: 400 },
      );
    }

    const account = await prisma.account.findFirst({
      where: { userId: existing.vault.userId, status: AccountStatus.ACTIVE },
      orderBy: { createdAt: 'asc' },
    });

    if (account === null) {
      return NextResponse.json(
        { success: false, error: 'Member has no active account to credit.' },
        { status: 400 },
      );
    }

    // The gross amount leaves the vault; the member receives the net. The
    // penalty is the difference and stays with the business.
    const plan = await buildLiquidationPlan(existing.vault.id, existing.amount);

    if (!plan.complete) {
      return NextResponse.json(
        { success: false, error: plan.reason ?? 'Could not liquidate holdings.' },
        { status: 400 },
      );
    }

    const reference = `RVW-${Date.now()}-${existing.vault.vaultNumber.slice(-5)}`;

    const result = await prisma.$transaction(
      async (tx) => {
        await applyLiquidationPlan(tx, plan);

        const credited = await tx.account.update({
          where: { id: account.id },
          data: {
            balance: { increment: existing.netAmount },
            availableBalance: { increment: existing.netAmount },
          },
          select: { balance: true },
        });

        await tx.transaction.create({
          data: {
            userId: existing.vault.userId,
            accountId: account.id,
            transactionType: 'INVESTMENT_WITHDRAWAL',
            amount: existing.netAmount,
            balanceAfter: credited.balance,
            currency: account.currency,
            status: 'COMPLETED',
            description:
              `Retirement Vault withdrawal (${existing.vault.vaultNumber})` +
              (existing.penaltyAmount > 0
                ? ` after $${existing.penaltyAmount.toFixed(2)} early withdrawal penalty`
                : ''),
            reference,
            fee: existing.penaltyAmount,
          },
        });

        const vault = await tx.retirementVault.update({
          where: { id: existing.vault.id },
          data: {
            totalWithdrawn: { increment: existing.amount },
            cashBalance: { decrement: plan.fromCash },
          },
        });

        await tx.vaultWithdrawalRequest.update({
          where: { id: existing.id },
          data: {
            status: VaultWithdrawalStatus.PAID,
            processedBy: adminId,
            processedAt: new Date(),
            adminNotes: body.adminNotes?.slice(0, 1000) ?? null,
          },
        });

        return { balanceAfter: credited.balance, vault };
      },
      { timeout: 25_000, maxWait: 15_000 },
    );

    // A vault emptied by a withdrawal is closed rather than left active and
    // worthless, so it stops appearing as a live retirement plan.
    const remaining = await prisma.vaultHolding.aggregate({
      where: { vaultId: existing.vault.id },
      _sum: { units: true },
    });
    if ((remaining._sum.units ?? 0) <= 1e-9 && result.vault.cashBalance <= 0.01) {
      await prisma.retirementVault.update({
        where: { id: existing.vault.id },
        data: { status: VaultStatus.CLOSED, closedAt: new Date(), closureReason: 'Fully withdrawn' },
      });
    }

    await prisma.notification
      .create({
        data: {
          userId: existing.vault.userId,
          type: 'INVESTMENT',
          title: 'Withdrawal paid',
          message:
            `$${existing.netAmount.toFixed(2)} has been credited to your account from ` +
            `${existing.vault.vaultNumber}.` +
            (existing.penaltyAmount > 0
              ? ` A $${existing.penaltyAmount.toFixed(2)} early withdrawal penalty was applied.`
              : ''),
          link: '/dashboard',
        },
      })
      .catch(() => undefined);

    return NextResponse.json({
      success: true,
      status: 'PAID',
      reference,
      netPaid: existing.netAmount,
      penaltyRetained: existing.penaltyAmount,
      accountBalanceAfter: result.balanceAfter,
      soldFromCash: plan.fromCash,
      unitsSold: plan.lines.map((l) => ({
        symbol: l.symbol,
        units: l.unitsSold,
        proceeds: Number(l.proceeds.toFixed(2)),
      })),
    });
  } catch (error) {
    console.error('[Admin Vault Withdrawals] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not process the withdrawal.' },
      { status: 500 },
    );
  }
}
