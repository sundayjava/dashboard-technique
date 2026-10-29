import { PriceSyncTrigger } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { syncAssetPrices } from './price-sync';
import { runDailyClassPerformance } from './class-performance';
import { valueAllActiveVaults } from './valuation';
import { generateReportCards } from './report-card';
import { processAutoContributions } from './auto-contribution';
import { runScheduledRebalances } from './rebalance-engine';
import { serveElapsedNotices } from './withdrawal-engine';
import { loadVaultPolicy } from './policy-store';

/**
 * Everything the vault does once a night, in the only order that works.
 *
 * Lives here rather than in the cron route so a scheduler outside Vercel can
 * run exactly the same chain. Two copies of this ordering would drift, and the
 * ordering is the part that matters:
 *
 *   prices -> class performance -> valuations -> report cards
 *                                             -> contributions -> rebalances
 *
 * The rates are built from the closes the sync just wrote; a valuation has to
 * see the credits to report them; report cards are built from the valuations;
 * and new money is contributed before rebalancing so it is placed in the same
 * pass rather than sitting until tomorrow.
 *
 * EVERY STEP IS ISOLATED. A vendor outage or one bad vault must not take down
 * the rest, so each stage catches its own failures and the result says what
 * happened. Nothing here throws.
 *
 * Safe to run more than once in a day. The price sync has a single-flight
 * guard, performance is keyed one credit per vault per class per trading day,
 * valuations upsert on their date, and contributions only fire when genuinely
 * due -- so a VPS schedule and a leftover Vercel cron can overlap without
 * paying anyone twice.
 */

export interface VaultNightlyResult {
  priceSync: {
    status: string;
    attempted: number;
    succeeded: number;
    failed: number;
    skipped: boolean;
    failures: Array<{ symbol: string; message: string }>;
  };
  classPerformance: {
    date: string;
    classRates: number;
    creditsWritten: number;
    vaultsCredited: number;
    alreadyCredited: number;
    netAmount: number;
  } | null;
  valuations: { attempted: number; recorded: number; skipped: number } | null;
  reportCards: { vaults: number; generated: number } | null;
  autoContributions: {
    considered: number;
    charged: number;
    failed: number;
    totalCharged: number;
  } | null;
  rebalances: { considered: number; applied: number; skipped: number } | null;
  withdrawalNoticesServed: number;
}

export async function runVaultNightly(
  trigger: PriceSyncTrigger = PriceSyncTrigger.CRON,
): Promise<VaultNightlyResult> {
  const priceSync = await runPriceSync(trigger);

  // Nothing downstream may run on prices we could not fetch: crediting
  // performance or rebalancing real holdings against stale figures is worse
  // than a visible gap in the series.
  const priced = priceSync.succeeded > 0;

  const classPerformance = priced ? await runClassPerformance() : null;
  const valuations = priced ? await runValuations() : null;
  const reportCards = valuations !== null ? await runReportCards() : null;
  const autoContributions = priced ? await runAutoContributions() : null;
  const rebalances = priced ? await runRebalances() : null;

  // Independent of pricing: a notice period elapses whether or not a feed
  // answered, and the admin queue should reflect what is genuinely ready.
  let withdrawalNoticesServed = 0;
  try {
    withdrawalNoticesServed = await serveElapsedNotices();
    if (withdrawalNoticesServed > 0) {
      console.log(`📤 Withdrawal notices served: ${withdrawalNoticesServed}`);
    }
  } catch (error) {
    console.error('❌ Withdrawal notices threw:', error);
  }

  return {
    priceSync,
    classPerformance,
    valuations,
    reportCards,
    autoContributions,
    rebalances,
    withdrawalNoticesServed,
  };
}

async function runPriceSync(trigger: PriceSyncTrigger) {
  try {
    const result = await syncAssetPrices(trigger);
    console.log(
      `💹 Vault price sync: ${result.status} ` +
        `${result.succeeded}/${result.attempted} ok, ${result.failed} failed, ` +
        `${result.durationMs}ms${result.skipped ? ' (skipped)' : ''}`,
    );
    for (const failure of result.failures) {
      console.warn(`   ${failure.symbol}: ${failure.message}`);
    }
    return {
      status: result.status,
      attempted: result.attempted,
      succeeded: result.succeeded,
      failed: result.failed,
      skipped: result.skipped,
      failures: result.failures,
    };
  } catch (error) {
    console.error('❌ Vault price sync threw:', error);
    return {
      status: 'FAILED',
      attempted: 0,
      succeeded: 0,
      failed: 0,
      skipped: false,
      failures: [],
    };
  }
}

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
    for (const failure of result.failures) {
      console.warn(`   vault ${failure.vaultId}: ${failure.reason}`);
    }

    return {
      date: result.date.toISOString().slice(0, 10),
      classRates: result.rates.length,
      creditsWritten: result.creditsWritten,
      vaultsCredited: result.vaultsCredited,
      alreadyCredited: result.alreadyCredited,
      netAmount: result.netAmount,
    };
  } catch (error) {
    console.error('❌ Class performance threw:', error);
    return null;
  }
}

async function runValuations() {
  try {
    const result = await valueAllActiveVaults();
    console.log(
      `📊 Vault valuations: ${result.recorded}/${result.attempted} recorded, ` +
        `${result.skipped} skipped`,
    );
    for (const failure of result.failures) {
      console.warn(`   vault ${failure.vaultId}: ${failure.reason}`);
    }
    return { attempted: result.attempted, recorded: result.recorded, skipped: result.skipped };
  } catch (error) {
    console.error('❌ Vault valuation threw:', error);
    return null;
  }
}

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

async function runAutoContributions() {
  try {
    const result = await processAutoContributions();
    if (result.charged > 0 || result.failed > 0) {
      console.log(
        `💵 Auto-contributions: ${result.charged} charged ` +
          `($${result.totalCharged.toLocaleString()}), ${result.failed} failed`,
      );
    }
    return {
      considered: result.considered,
      charged: result.charged,
      failed: result.failed,
      totalCharged: result.totalCharged,
    };
  } catch (error) {
    console.error('❌ Auto-contributions threw:', error);
    return null;
  }
}

async function runRebalances() {
  try {
    const result = await runScheduledRebalances();
    if (result.applied > 0) {
      console.log(`⚖️  Vault rebalances applied: ${result.applied}/${result.considered}`);
    }
    for (const failure of result.failures) {
      console.warn(`   vault ${failure.vaultId}: ${failure.reason}`);
    }
    return {
      considered: result.considered,
      applied: result.applied,
      skipped: result.skipped,
    };
  } catch (error) {
    console.error('❌ Vault rebalancing threw:', error);
    return null;
  }
}
