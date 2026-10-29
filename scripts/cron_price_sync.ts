import 'dotenv/config';
import { PriceSyncTrigger } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { syncAssetPrices } from '../src/lib/vault/price-sync';

/**
 * Prices only, for running often.
 *
 * Separate from the nightly chain because it carries no consequences: it
 * writes snapshots and nothing else. Crediting performance or rebalancing on
 * a fifteen-minute cadence would be wrong; refreshing a price is not.
 *
 * WHY MARKET HOURS. Twelve Data charges one credit per symbol with 800 a day,
 * and outside the US session there is nothing new to fetch -- the vendor
 * returns the same close. Polling then would spend the budget to write the
 * figure already stored. Crypto trades continuously, so --force exists for a
 * schedule that wants coins refreshed out of hours.
 *
 * US equities trade 13:30-20:00 UTC while the US is on daylight time and
 * 14:30-21:00 UTC otherwise. The window below is deliberately generous at
 * both ends rather than tracking the changeover: a few wasted credits either
 * side costs less than missing the open.
 */
const SESSION_START_UTC_MINUTES = 13 * 60; // 13:00
const SESSION_END_UTC_MINUTES = 21 * 60 + 30; // 21:30

function withinSession(now: Date): boolean {
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false; // no weekend session
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return minutes >= SESSION_START_UTC_MINUTES && minutes <= SESSION_END_UTC_MINUTES;
}

async function main() {
  const force = process.argv.includes('--force');
  const now = new Date();

  if (!force && !withinSession(now)) {
    console.log(
      `[vault-prices] ${now.toISOString()} outside the US session; skipping. ` +
        `Use --force to sync anyway.`,
    );
    return;
  }

  const result = await syncAssetPrices(PriceSyncTrigger.CRON);
  console.log(
    `[vault-prices] ${result.status} ${result.succeeded}/${result.attempted} ok, ` +
      `${result.failed} failed, ${result.durationMs}ms${result.skipped ? ' (skipped)' : ''}`,
  );
  for (const failure of result.failures) {
    console.warn(`   ${failure.symbol}: ${failure.message}`);
  }

  // A partial sync is worth surfacing: it usually means a missing API key or
  // a symbol the vendor no longer serves, both of which need a human.
  if (result.failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('[vault-prices] FATAL', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
