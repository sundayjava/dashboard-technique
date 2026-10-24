import { NextRequest, NextResponse } from 'next/server';
import {
  AccountStatus,
  ContributionStatus,
  ContributionType,
  VaultStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';
import { MIN_INITIAL_DEPOSIT, getOpenVaultForUser } from '@/lib/vault/vault-utils';

export const dynamic = 'force-dynamic';

/** Deposits can take a little longer: they price the whole universe to allocate. */
export const maxDuration = 60;

/**
 * Fund a Retirement Vault from the member's main account balance.
 *
 * This is an internal transfer, not an external payment: the account is
 * debited and the vault credited in the same breath. The money is then
 * allocated into holdings immediately, at live prices, following the vault's
 * stored targets.
 *
 * Everything runs in ONE transaction — debit, transaction record,
 * contribution, holdings, activation. A partial failure here would either
 * take a member's money without giving them units, or hand out units nobody
 * paid for.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const userId = auth.user.userId;
    const body = (await request.json()) as {
      amount?: number;
      transactionPin?: string;
    };

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Enter a valid amount.' },
        { status: 400 },
      );
    }

    if (amount < MIN_INITIAL_DEPOSIT) {
      return NextResponse.json(
        {
          success: false,
          error: `The minimum deposit is $${MIN_INITIAL_DEPOSIT.toLocaleString()}.`,
        },
        { status: 400 },
      );
    }

    const vault = await getOpenVaultForUser(userId);
    if (vault === null) {
      return NextResponse.json(
        { success: false, error: 'You do not have a Retirement Vault yet.' },
        { status: 404 },
      );
    }

    if (vault.status !== VaultStatus.ACTIVE && vault.status !== VaultStatus.PENDING_ACTIVATION) {
      return NextResponse.json(
        {
          success: false,
          error: `This vault is ${vault.status.toLowerCase().replace('_', ' ')} and cannot accept deposits.`,
        },
        { status: 400 },
      );
    }

    // --- verify the transaction PIN ----------------------------------------
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, transactionPin: true },
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

    // --- find the funding account ------------------------------------------
    const account = await prisma.account.findFirst({
      where: { userId, status: AccountStatus.ACTIVE },
      orderBy: { createdAt: 'asc' },
    });

    if (account === null) {
      return NextResponse.json(
        { success: false, error: 'No active account found to fund this deposit.' },
        { status: 400 },
      );
    }

    if (account.balance < amount) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient balance. Your account holds $${account.balance.toLocaleString()}.`,
        },
        { status: 400 },
      );
    }

    // A deposit no longer buys anything. It moves money into the vault as
    // UNINVESTED CASH, and the member then decides where it goes -- either by
    // setting each asset class themselves, or by handing a total to the Expert
    // Allocator. Because nothing is priced here, a feed outage can no longer
    // block a member from funding their vault.

    const reference = `RVD-${Date.now()}-${vault.vaultNumber.slice(-5)}`;
    const wasActivating = vault.status === VaultStatus.PENDING_ACTIVATION;

    const result = await prisma.$transaction(async (tx) => {
      // Re-read the balance inside the transaction. The check above was made
      // before the PIN and pricing work; a concurrent transfer could have
      // spent the money in between.
      const current = await tx.account.findUnique({
        where: { id: account.id },
        select: { balance: true },
      });

      if (current === null || current.balance < amount) {
        throw new Error('Insufficient balance.');
      }

      const debited = await tx.account.update({
        where: { id: account.id },
        data: {
          balance: { decrement: amount },
          availableBalance: { decrement: amount },
        },
        select: { balance: true },
      });

      await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          transactionType: 'INVESTMENT_DEPOSIT',
          amount,
          balanceAfter: debited.balance,
          currency: account.currency,
          status: 'COMPLETED',
          description: `Retirement Vault deposit (${vault.vaultNumber})`,
          reference,
        },
      });

      // An INITIAL contribution already exists in PENDING from onboarding.
      // Settle that one rather than creating a duplicate, so the member's
      // contribution history matches what they actually agreed to.
      const pendingInitial = await tx.vaultContribution.findFirst({
        where: {
          vaultId: vault.id,
          type: ContributionType.INITIAL,
          status: ContributionStatus.PENDING,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (pendingInitial !== null) {
        await tx.vaultContribution.update({
          where: { id: pendingInitial.id },
          data: {
            amount,
            status: ContributionStatus.COMPLETED,
            processedAt: new Date(),
            allocatedAt: new Date(),
          },
        });
      } else {
        await tx.vaultContribution.create({
          data: {
            vaultId: vault.id,
            type: ContributionType.MANUAL,
            amount,
            currency: vault.currency,
            status: ContributionStatus.COMPLETED,
            processedAt: new Date(),
            allocatedAt: new Date(),
          },
        });
      }

      const updatedVault = await tx.retirementVault.update({
        where: { id: vault.id },
        data: {
          totalContributed: { increment: amount },
          // The whole deposit is held as cash until the member invests it.
          cashBalance: { increment: amount },
          ...(wasActivating
            ? { status: VaultStatus.ACTIVE, activatedAt: new Date() }
            : {}),
        },
      });

      return { updatedVault, balanceAfter: debited.balance };
    },
    {
      // The default 5s is not enough: this transaction makes roughly a dozen
      // round-trips to a remote database to write holdings, and timing out
      // rolls back a deposit the member has already authorised. The route's
      // maxDuration is 60s, so there is ample room.
      timeout: 25_000,
      maxWait: 15_000,
    });

    await prisma.notification
      .create({
        data: {
          userId,
          type: 'INVESTMENT',
          title: wasActivating ? 'Retirement Vault activated' : 'Deposit received',
          message:
            `$${amount.toLocaleString()} is now available in ${vault.vaultNumber}. ` +
            `It is held as cash until you choose how to invest it.`,
          link: '/retirement-vault/allocation',
        },
      })
      .catch((error) => {
        console.error('[Vault Deposit] notification failed:', error);
      });

    return NextResponse.json({
      success: true,
      reference,
      activated: wasActivating,
      vault: {
        vaultNumber: vault.vaultNumber,
        status: result.updatedVault.status,
        totalContributed: result.updatedVault.totalContributed,
        cashBalance: result.updatedVault.cashBalance,
      },
      accountBalanceAfter: result.balanceAfter,
      // Held as cash; the member invests it from the Allocation page.
      awaitingInvestment: Number(result.updatedVault.cashBalance.toFixed(2)),
    });
  } catch (error) {
    console.error('[Vault Deposit] error:', error);
    const message = error instanceof Error ? error.message : 'Deposit failed.';
    const insufficient = message.includes('Insufficient balance');
    return NextResponse.json(
      { success: false, error: insufficient ? message : 'Deposit failed.' },
      { status: insufficient ? 400 : 500 },
    );
  }
}
