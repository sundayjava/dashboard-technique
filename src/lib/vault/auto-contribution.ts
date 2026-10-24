import {
  AccountStatus,
  ContributionStatus,
  ContributionType,
  VaultStatus,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  applyAllocationPlan,
  buildTargetingAllocationPlan,
  summarisePlan,
} from './allocation-engine';

/**
 * Monthly auto-contributions.
 *
 * Members set an amount and a day at onboarding; this charges it. Run from the
 * nightly cron, which is why it must be safe to run every day:
 *
 *  - IDEMPOTENT per calendar month. A completed contribution for the current
 *    month means today is a no-op. Charging someone's retirement twice because
 *    a cron fired twice would be a serious failure.
 *
 *  - CATCHES UP. The condition is "the day has arrived and this month has not
 *    been charged", not "today is exactly the chosen day". Vercel's free plan
 *    runs crons on a best-effort schedule, so an exact-day match would silently
 *    skip a member's contribution for a whole month if a single run was missed.
 *
 *  - RETRIES WITHIN THE MONTH. A failure for insufficient funds is recorded
 *    and retried on later days, because a member paid later in the month
 *    should still get their contribution. Only one failure row is kept per
 *    month, so retries do not flood their history or their notifications.
 */

export interface AutoContributionOutcome {
  vaultId: string;
  vaultNumber: string;
  amount: number;
  status: 'charged' | 'skipped' | 'failed';
  reason?: string;
}

export interface AutoContributionResult {
  considered: number;
  charged: number;
  failed: number;
  skipped: number;
  totalCharged: number;
  outcomes: AutoContributionOutcome[];
}

/** First instant of the calendar month containing `date`, in UTC. */
function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * Charge every due monthly contribution.
 *
 * Vaults are processed independently: one member's failure must never stop
 * another's contribution from being taken.
 */
export async function processAutoContributions(
  asOf: Date = new Date(),
): Promise<AutoContributionResult> {
  const monthStart = startOfMonth(asOf);
  const dayOfMonth = asOf.getUTCDate();

  const vaults = await prisma.retirementVault.findMany({
    where: {
      status: VaultStatus.ACTIVE,
      monthlyContribution: { not: null, gt: 0 },
    },
    select: {
      id: true,
      userId: true,
      vaultNumber: true,
      currency: true,
      monthlyContribution: true,
      monthlyContributionDay: true,
      expertAllocatorActive: true,
    },
  });

  const outcomes: AutoContributionOutcome[] = [];
  let charged = 0;
  let failed = 0;
  let skipped = 0;
  let totalCharged = 0;

  for (const vault of vaults) {
    const amount = vault.monthlyContribution ?? 0;
    const dueDay = vault.monthlyContributionDay ?? 1;

    const record = (
      status: AutoContributionOutcome['status'],
      reason?: string,
    ) => {
      outcomes.push({
        vaultId: vault.id,
        vaultNumber: vault.vaultNumber,
        amount,
        status,
        reason,
      });
      if (status === 'charged') {
        charged += 1;
        totalCharged += amount;
      } else if (status === 'failed') failed += 1;
      else skipped += 1;
    };

    try {
      if (dayOfMonth < dueDay) {
        record('skipped', `Due on day ${dueDay}.`);
        continue;
      }

      // Anything already completed this month means we are done.
      const thisMonth = await prisma.vaultContribution.findFirst({
        where: {
          vaultId: vault.id,
          type: ContributionType.AUTO_MONTHLY,
          createdAt: { gte: monthStart },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (thisMonth !== null && thisMonth.status === ContributionStatus.COMPLETED) {
        record('skipped', 'Already contributed this month.');
        continue;
      }

      const account = await prisma.account.findFirst({
        where: { userId: vault.userId, status: AccountStatus.ACTIVE },
        orderBy: { createdAt: 'asc' },
      });

      const fail = async (reason: string, notify: boolean) => {
        // One failure row per month, updated on each retry, so a member's
        // history is not filled with daily duplicates.
        if (thisMonth !== null) {
          await prisma.vaultContribution.update({
            where: { id: thisMonth.id },
            data: { status: ContributionStatus.FAILED, failureReason: reason },
          });
        } else {
          await prisma.vaultContribution.create({
            data: {
              vaultId: vault.id,
              type: ContributionType.AUTO_MONTHLY,
              amount,
              currency: vault.currency,
              status: ContributionStatus.FAILED,
              failureReason: reason,
              scheduledFor: asOf,
            },
          });
        }

        // Notified only on the first failure of the month, for the same reason.
        if (notify && thisMonth === null) {
          await prisma.notification
            .create({
              data: {
                userId: vault.userId,
                type: 'INVESTMENT',
                title: 'Monthly vault contribution could not be taken',
                message:
                  `We could not take your $${amount.toLocaleString()} contribution to ` +
                  `${vault.vaultNumber}. ${reason} We will try again automatically before ` +
                  `the month ends.`,
                link: '/retirement-vault/dashboard',
              },
            })
            .catch(() => undefined);
        }

        record('failed', reason);
      };

      if (account === null) {
        await fail('No active account to debit.', true);
        continue;
      }

      if (account.balance < amount) {
        await fail(
          `Your account balance of $${account.balance.toFixed(2)} was below the ` +
            `$${amount.toFixed(2)} contribution.`,
          true,
        );
        continue;
      }

      // Only an Expert Allocator vault invests the contribution automatically.
      // With Expert off the member places their own trades, so the money is
      // added as cash and they decide where it goes -- taking it and investing
      // it for them would be the opposite of what they chose.
      const autoInvest = vault.expertAllocatorActive;

      let plan = null as Awaited<ReturnType<typeof buildTargetingAllocationPlan>> | null;
      if (autoInvest) {
        // Price before touching money. A pricing outage must not take the
        // contribution and leave it unallocated.
        plan = await buildTargetingAllocationPlan(vault.id, amount);
        if (!plan.complete || plan.lines.length === 0) {
          await fail(
            plan.lines.length === 0
              ? 'No allocation targets to invest into.'
              : `Live prices unavailable for ${plan.missingPrices.join(', ')}.`,
            // Not the member's problem to fix, so no notification.
            false,
          );
          continue;
        }
      }

      const reference = `RVA-${Date.now()}-${vault.vaultNumber.slice(-5)}`;

      await prisma.$transaction(
        async (tx) => {
          // Re-read inside the transaction: the balance check above happened
          // before pricing, and a transfer could have spent it since.
          const current = await tx.account.findUnique({
            where: { id: account.id },
            select: { balance: true },
          });
          if (current === null || current.balance < amount) {
            throw new Error('Insufficient balance at charge time.');
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
              userId: vault.userId,
              accountId: account.id,
              transactionType: 'INVESTMENT_DEPOSIT',
              amount,
              balanceAfter: debited.balance,
              currency: account.currency,
              status: 'COMPLETED',
              description: `Retirement Vault monthly contribution (${vault.vaultNumber})`,
              reference,
            },
          });

          if (thisMonth !== null) {
            await tx.vaultContribution.update({
              where: { id: thisMonth.id },
              data: {
                amount,
                status: ContributionStatus.COMPLETED,
                failureReason: null,
                processedAt: new Date(),
                allocatedAt: new Date(),
              },
            });
          } else {
            await tx.vaultContribution.create({
              data: {
                vaultId: vault.id,
                type: ContributionType.AUTO_MONTHLY,
                amount,
                currency: vault.currency,
                status: ContributionStatus.COMPLETED,
                scheduledFor: asOf,
                processedAt: new Date(),
                allocatedAt: new Date(),
              },
            });
          }

          if (plan !== null) await applyAllocationPlan(tx, plan);

          await tx.retirementVault.update({
            where: { id: vault.id },
            data: {
              totalContributed: { increment: amount },
              // Invested vaults keep only the rounding residue as cash;
              // member-directed vaults hold the whole contribution.
              cashBalance: { increment: plan === null ? amount : plan.residualCash },
            },
          });
        },
        { timeout: 25_000, maxWait: 15_000 },
      );

      await prisma.notification
        .create({
          data: {
            userId: vault.userId,
            type: 'INVESTMENT',
            title:
              plan === null
                ? 'Monthly contribution received'
                : 'Monthly contribution invested',
            message:
              plan === null
                ? `$${amount.toLocaleString()} was added to ${vault.vaultNumber} and is ` +
                  `waiting for you to invest it.`
                : `$${amount.toLocaleString()} was added to ${vault.vaultNumber} and ` +
                  `invested. ${summarisePlan(plan)}.`,
            link:
              plan === null
                ? '/retirement-vault/allocation'
                : '/retirement-vault/holdings',
          },
        })
        .catch(() => undefined);

      record('charged');
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`[Auto Contribution] ${vault.vaultNumber}: ${reason}`);
      record('failed', reason);
    }
  }

  return {
    considered: vaults.length,
    charged,
    failed,
    skipped,
    totalCharged,
    outcomes,
  };
}
