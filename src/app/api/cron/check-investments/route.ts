import { NextRequest, NextResponse } from 'next/server';
import { PriceSyncTrigger } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendInvestmentMaturityNotification } from '@/lib/email';
import { syncAssetPrices } from '@/lib/vault/price-sync';
import { runDailyClassPerformance } from '@/lib/vault/class-performance';
import { loadVaultPolicy } from '@/lib/vault/policy-store';
import { valueAllActiveVaults } from '@/lib/vault/valuation';
import { generateReportCards } from '@/lib/vault/report-card';
import { serveElapsedNotices } from '@/lib/vault/withdrawal-engine';
import { runScheduledRebalances } from '@/lib/vault/rebalance-engine';
import { processAutoContributions } from '@/lib/vault/auto-contribution';

export const dynamic = 'force-dynamic';

// Raised from the 10s default: this route now also drives the Retirement Vault
// price sync, which pays DNS and TLS per provider on a cold start. 60s is the
// Vercel Hobby maximum.
export const maxDuration = 60;

// This endpoint should be called by a cron job (e.g., Vercel Cron, GitHub Actions, or external cron service)
// Call it every hour or day: GET /api/cron/check-investments
// You can protect it with a secret token in production

export async function GET(request: NextRequest) {
  // Optional: Add authentication token check for security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Investment maturity processing runs FIRST and to completion.
  //
  // It moves real money, so it must not be left truncated because a price
  // vendor was slow. The sync below can consume ~20s of the 60s budget when
  // feeds time out, and running it first risked the function being killed
  // mid-loop with investments half-processed.
  let investmentPayload: Record<string, unknown>;
  let httpStatus = 200;

  try {
    investmentPayload = await processMaturedInvestments();
  } catch (error) {
    console.error('❌ Error in investment maturity check:', error);
    investmentPayload = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check investments',
    };
    httpStatus = 500;
  }

  // --- Retirement Vault price sync ---------------------------------------
  // Folded in here because the Vercel Hobby plan allows only two cron entries
  // and both are already in use.
  //
  // It runs LAST and is fully isolated: a vendor outage can neither throw into
  // the investment work above nor steal function time from it. Failures are
  // logged and recorded in price_sync_runs, never thrown.
  const vaultPriceSync = await runVaultPriceSync();

  // The day's performance is credited between the sync and the valuations,
  // which is the only order that works: the rates are built from the closes the
  // sync just wrote, and a valuation has to see the credits to report them.
  const vaultClassPerformance =
    vaultPriceSync.succeeded > 0 ? await runClassPerformance() : null;

  // Vaults are revalued immediately after the sync, while prices are freshest.
  // Skipped when nothing could be priced: revaluing against stale prices would
  // write a misleading NAV for the day, and a gap in the series is both more
  // honest and easier to spot.
  const vaultValuations =
    vaultPriceSync.succeeded > 0 ? await runVaultValuations() : null;

  // Report cards come straight after the valuations they are built from.
  // They used to be regenerated on every visit to the performance tab, which
  // walked every quarter the vault had existed in and cost ~460ms a page view
  // for figures that change once a quarter.
  const vaultReportCards = vaultValuations !== null ? await runReportCards() : null;

  // Monthly auto-contributions. Runs BEFORE rebalancing so new money is
  // invested at today's prices and then included in the same allocation pass,
  // rather than sitting until tomorrow.
  let vaultAutoContributions = null;
  if (vaultPriceSync.succeeded > 0) {
    try {
      const result = await processAutoContributions();
      vaultAutoContributions = {
        considered: result.considered,
        charged: result.charged,
        failed: result.failed,
        totalCharged: result.totalCharged,
      };
      if (result.charged > 0 || result.failed > 0) {
        console.log(
          `💵 Auto-contributions: ${result.charged} charged ` +
            `($${result.totalCharged.toLocaleString()}), ${result.failed} failed`,
        );
      }
    } catch (error) {
      console.error('❌ Auto-contributions threw:', error);
    }
  }

  // Expert Allocator. Runs after valuation so it works on today's prices, and
  // only when pricing succeeded: rebalancing against stale prices would trade
  // real holdings on figures we know to be wrong.
  let vaultRebalances = null;
  if (vaultPriceSync.succeeded > 0) {
    try {
      const result = await runScheduledRebalances();
      vaultRebalances = {
        considered: result.considered,
        applied: result.applied,
        skipped: result.skipped,
      };
      if (result.applied > 0) {
        console.log(`⚖️  Vault rebalances applied: ${result.applied}/${result.considered}`);
      }
      for (const failure of result.failures) {
        console.warn(`   vault ${failure.vaultId}: ${failure.reason}`);
      }
    } catch (error) {
      console.error('❌ Vault rebalancing threw:', error);
    }
  }

  // Promote withdrawal requests whose notice period has elapsed, so the admin
  // queue reflects what is genuinely ready to pay. Independent of pricing: a
  // notice period passes whether or not a feed responded.
  let withdrawalNoticesServed = 0;
  try {
    withdrawalNoticesServed = await serveElapsedNotices();
    if (withdrawalNoticesServed > 0) {
      console.log(`📤 Withdrawal notices served: ${withdrawalNoticesServed}`);
    }
  } catch (error) {
    console.error('❌ Serving withdrawal notices failed:', error);
  }

  return NextResponse.json(
    {
      ...investmentPayload,
      vaultPriceSync,
      vaultClassPerformance,
      vaultValuations,
      vaultReportCards,
      vaultAutoContributions,
      vaultRebalances,
      withdrawalNoticesServed,
    },
    { status: httpStatus },
  );
}

/**
 * Close the day for every asset class and credit each member.
 *
 * Isolated like the sync above: this moves real balances, so a failure must
 * leave them untouched rather than half-credited. The engine's own unique keys
 * make a retry safe, so a failed night can simply be run again.
 */
async function runClassPerformance() {
  try {
    const policy = await loadVaultPolicy();
    const result = await runDailyClassPerformance(new Date(), policy);

    console.log(
      `📈 Class performance ${result.date.toISOString().slice(0, 10)}: ` +
        `${result.rates.length} class rate(s), ${result.creditsWritten} credit(s) across ` +
        `${result.vaultsCredited}/${result.vaultsConsidered} vault(s), net ` +
        `${result.netAmount.toFixed(2)}`,
    );
    for (const rate of result.rates) {
      console.log(
        `   ${rate.assetClass} @ ${rate.performanceDate.toISOString().slice(0, 10)}: ` +
          `${rate.assetSumPercent.toFixed(4)}% (${rate.assetCount} asset(s))` +
          ` + ${rate.upliftPercent}% uplift = ${rate.totalPercent.toFixed(4)}%` +
          (rate.wasClamped ? ' [capped]' : ''),
      );
    }
    if (result.alreadyCredited > 0) {
      console.log(`   ${result.alreadyCredited} already credited today; left alone.`);
    }
    for (const failure of result.failures) {
      console.warn(`   vault ${failure.vaultId}: ${failure.reason}`);
    }

    return {
      date: result.date,
      classRates: result.rates.length,
      creditsWritten: result.creditsWritten,
      vaultsCredited: result.vaultsCredited,
      vaultsConsidered: result.vaultsConsidered,
      alreadyCredited: result.alreadyCredited,
      netAmount: result.netAmount,
      failed: result.failures.length,
    };
  } catch (error) {
    console.error('❌ Class performance threw:', error);
    return null;
  }
}

/** Refresh every active vault's quarterly cards, once a night. */
async function runReportCards() {
  try {
    const vaults = await prisma.retirementVault.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    let generated = 0;
    for (const vault of vaults) {
      // One vault's cards failing must not stop the rest.
      generated += await generateReportCards(vault.id).catch(() => 0);
    }

    console.log(`🧾 Vault report cards: ${generated} card(s) across ${vaults.length} vault(s)`);
    return { vaults: vaults.length, generated };
  } catch (error) {
    console.error('❌ Vault report cards threw:', error);
    return null;
  }
}

async function runVaultValuations() {
  try {
    const result = await valueAllActiveVaults();
    console.log(
      `📊 Vault valuations: ${result.recorded}/${result.attempted} recorded, ` +
        `${result.skipped} skipped`,
    );
    for (const failure of result.failures) {
      console.warn(`   vault ${failure.vaultId}: ${failure.reason}`);
    }
    return {
      attempted: result.attempted,
      recorded: result.recorded,
      skipped: result.skipped,
    };
  } catch (error) {
    // Isolated for the same reason as the price sync: it must not affect the
    // investment work that already completed above.
    console.error('❌ Vault valuation threw:', error);
    return { attempted: 0, recorded: 0, skipped: 0 };
  }
}

async function runVaultPriceSync() {
  try {
    const result = await syncAssetPrices(PriceSyncTrigger.CRON);
    console.log(
      `💹 Vault price sync: ${result.status} ` +
        `(${result.succeeded} ok, ${result.failed} failed, ${result.durationMs}ms)`,
    );
    return {
      status: result.status,
      skipped: result.skipped,
      succeeded: result.succeeded,
      failed: result.failed,
      durationMs: result.durationMs,
    };
  } catch (error) {
    console.error('❌ Vault price sync threw:', error);
    return { status: 'ERROR', skipped: false, succeeded: 0, failed: 0, durationMs: 0 };
  }
}

/**
 * Existing investment maturity logic, unchanged apart from returning a payload
 * object rather than a NextResponse, so the caller can attach the price sync
 * result and choose the HTTP status.
 */
async function processMaturedInvestments(): Promise<Record<string, unknown>> {
  {
    const now = new Date();
    console.log('🔍 Checking for matured investments at:', now.toISOString());

    // Find all ACTIVE investments that have reached or passed their endDate
    const maturedInvestments = await prisma.investment.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          lte: now, // Less than or equal to current time
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        plan: {
          select: {
            id: true,
            planName: true,
            profitPercentage: true,
            duration: true,
            compoundingCycles: true,
          },
        },
      },
    });

    console.log(`📊 Found ${maturedInvestments.length} matured investments`);

    // Auto-compound investments that have more cycles
    let autoCompoundedCount = 0;
    let needsAdminCount = 0;
    const investmentsNeedingAdmin = [];

    for (const investment of maturedInvestments) {
      const isCompounding = investment.plan.compoundingCycles > 0;
      const hasMoreCycles = investment.currentCycle < investment.totalCycles;

      if (isCompounding && hasMoreCycles && !investment.isStopped) {
        // AUTO-COMPOUND: Calculate profit and reinvest
        const profitEarned = investment.amount * (investment.plan.profitPercentage / 100);
        const newPrincipal = investment.amount + profitEarned;
        const newStartDate = new Date();
        const newEndDate = new Date(newStartDate.getTime() + (investment.plan.duration * 24 * 60 * 60 * 1000));

        await prisma.investment.update({
          where: { id: investment.id },
          data: {
            amount: newPrincipal, // Grow principal
            currentCycle: investment.currentCycle + 1,
            startDate: newStartDate,
            endDate: newEndDate,
            profitEarned: 0, // Reset for new cycle
          },
        });

        // Notify user about auto-compounding
        await prisma.notification.create({
          data: {
            userId: investment.userId,
            type: 'INVESTMENT',
            title: 'Investment Auto-Compounded',
            message: `Your ${investment.plan.planName} investment completed cycle ${investment.currentCycle} of ${investment.totalCycles}. Profit: $${profitEarned.toFixed(2)}. New principal: $${newPrincipal.toFixed(2)}. Automatically starting cycle ${investment.currentCycle + 1}.`,
            link: '/investment',
          },
        });

        console.log(`✅ Auto-compounded investment #${investment.id} to cycle ${investment.currentCycle + 1}/${investment.totalCycles}`);
        autoCompoundedCount++;
      } else {
        // NEEDS ADMIN: Final cycle or stopped - add to list for admin notification
        investmentsNeedingAdmin.push(investment);
        needsAdminCount++;
      }
    }

    console.log(`🔄 Auto-compounded: ${autoCompoundedCount}, Needs admin completion: ${needsAdminCount}`);

    if (investmentsNeedingAdmin.length === 0) {
      return {
        success: true,
        message: autoCompoundedCount > 0
          ? `Auto-compounded ${autoCompoundedCount} investments. No investments need admin completion.`
          : 'No matured investments found',
        autoCompoundedCount,
        needsAdminCount: 0,
      };
    }

    // Get all admin users for final completion notifications
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    console.log(`👥 Found ${admins.length} admin users`);

    if (admins.length === 0) {
      console.error('❌ No admin users found in the database');
      return {
        success: false,
        error: 'No admin users found',
        autoCompoundedCount,
        needsAdminCount,
      };
    }

    // Send email to admins about investments needing final completion
    const emailPromises = [];
    
    for (const investment of investmentsNeedingAdmin) {
      // Calculate expected profit
      const expectedProfit = investment.amount * (investment.plan.profitPercentage / 100);
      const totalReturn = investment.amount + expectedProfit;

      // Determine if it's a compounding investment
      const isCompounding = investment.plan.compoundingCycles > 1;
      const hasMoreCycles = investment.currentCycle < investment.totalCycles;

      for (const admin of admins) {
        const emailPromise = sendInvestmentMaturityNotification({
          adminEmail: admin.email,
          adminName: admin.name || 'Admin',
          investment: {
            id: investment.id,
            investorName: investment.user.name || 'Investor',
            investorEmail: investment.user.email,
            planName: investment.plan.planName,
            amount: investment.amount,
            expectedProfit,
            totalReturn,
            startDate: investment.startDate!,
            endDate: investment.endDate!,
            currentCycle: investment.currentCycle,
            totalCycles: investment.totalCycles,
            isCompounding,
            hasMoreCycles,
          },
        }).catch((error) => {
          console.error(`❌ Failed to send email to admin ${admin.email}:`, error);
          return { success: false, error: error.message };
        });
        
        emailPromises.push(emailPromise);
      }

      // Create a notification for each admin
      const notificationPromises = admins.map((admin) =>
        prisma.notification.create({
          data: {
            userId: admin.id,
            type: 'INVESTMENT',
            title: 'Investment Maturity Alert',
            message: `Investment for ${investment.user.name} (${investment.plan.planName}) has matured. Amount: $${investment.amount.toLocaleString()}, Expected Profit: $${expectedProfit.toLocaleString()}. Please review and complete manually.`,
            link: '/admin/investments',
          },
        }).catch((error) => {
          console.error(`❌ Failed to create notification for admin ${admin.id}:`, error);
          return null;
        })
      );

      emailPromises.push(...notificationPromises);
    }

    // Wait for all emails and notifications to be sent
    const results = await Promise.allSettled(emailPromises);
    
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failureCount = results.filter((r) => r.status === 'rejected').length;

    console.log(`✅ Sent ${successCount} notifications successfully`);
    if (failureCount > 0) {
      console.log(`⚠️ Failed to send ${failureCount} notifications`);
    }

    return {
      success: true,
      message: `Processed ${maturedInvestments.length} matured investments: ${autoCompoundedCount} auto-compounded, ${needsAdminCount} need admin completion`,
      totalMatured: maturedInvestments.length,
      autoCompoundedCount,
      needsAdminCount,
      adminsNotified: admins.length,
      emailsSent: successCount,
      emailsFailed: failureCount,
      investments: investmentsNeedingAdmin.map((inv) => ({
        id: inv.id,
        investor: inv.user.name,
        plan: inv.plan.planName,
        amount: inv.amount,
        endDate: inv.endDate,
        currentCycle: inv.currentCycle,
        totalCycles: inv.totalCycles,
      })),
    };
  }
}
