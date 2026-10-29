import { NextRequest, NextResponse } from 'next/server';
import { ContributionStatus, ContributionType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getOpenVaultForUser } from '@/lib/vault/vault-utils';

export const dynamic = 'force-dynamic';

/** The member's current auto-contribution setting and its recent history. */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const vault = await getOpenVaultForUser(auth.user.userId);
    if (vault === null) {
      return NextResponse.json({ success: false, error: 'No vault found.' }, { status: 404 });
    }

    const history = await prisma.vaultContribution.findMany({
      where: { vaultId: vault.id, type: ContributionType.AUTO_MONTHLY },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        id: true,
        amount: true,
        status: true,
        failureReason: true,
        processedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      enabled: vault.monthlyContribution !== null && vault.monthlyContribution > 0,
      monthlyContribution: vault.monthlyContribution,
      monthlyContributionDay: vault.monthlyContributionDay,
      history,
    });
  } catch (error) {
    console.error('[Vault Auto-Contribution] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load your contribution settings.' },
      { status: 500 },
    );
  }
}

/**
 * Change or stop the monthly contribution.
 *
 * No PIN here: this only schedules a FUTURE charge, and every actual debit
 * still runs through the same checks. Requiring a PIN to STOP a recurring
 * payment would be friction in the wrong direction.
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const vault = await getOpenVaultForUser(auth.user.userId);
    if (vault === null) {
      return NextResponse.json({ success: false, error: 'No vault found.' }, { status: 404 });
    }

    const body = (await request.json()) as {
      enabled?: boolean;
      amount?: number;
      dayOfMonth?: number;
    };

    if (body.enabled === false) {
      await prisma.retirementVault.update({
        where: { id: vault.id },
        data: { monthlyContribution: null, monthlyContributionDay: null },
      });

      // A pending or failed row for this month is cancelled, so a stopped
      // contribution is not retried later in the month.
      await prisma.vaultContribution.updateMany({
        where: {
          vaultId: vault.id,
          type: ContributionType.AUTO_MONTHLY,
          status: { in: [ContributionStatus.PENDING, ContributionStatus.FAILED] },
        },
        data: { status: ContributionStatus.CANCELLED },
      });

      return NextResponse.json({ success: true, enabled: false });
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Enter a positive monthly amount.' },
        { status: 400 },
      );
    }

    const day = Number(body.dayOfMonth ?? vault.monthlyContributionDay ?? 1);
    // Capped at 28 so a monthly contribution never skips February.
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      return NextResponse.json(
        { success: false, error: 'Choose a day between 1 and 28.' },
        { status: 400 },
      );
    }

    await prisma.retirementVault.update({
      where: { id: vault.id },
      data: { monthlyContribution: amount, monthlyContributionDay: day },
    });

    return NextResponse.json({
      success: true,
      enabled: true,
      monthlyContribution: amount,
      monthlyContributionDay: day,
    });
  } catch (error) {
    console.error('[Vault Auto-Contribution] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not update your contribution.' },
      { status: 500 },
    );
  }
}
