import 'dotenv/config';
import { PriceSyncTrigger } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { runVaultNightly } from '../src/lib/vault/nightly';

/**
 * The vault's nightly chain, for a scheduler outside Vercel.
 *
 * Runs exactly what /api/cron/check-investments runs for the vault, because
 * both call runVaultNightly() -- the ordering is the fragile part and two
 * copies of it would drift.
 *
 * Idempotent, so it is safe to leave the Vercel cron in place while this
 * takes over: the price sync is single-flight, performance is keyed one
 * credit per vault per class per trading day, valuations upsert on their
 * date, and contributions only fire when genuinely due.
 *
 * Exits non-zero only when the sync priced nothing, which is the one outcome
 * a scheduler should alert on -- everything downstream is skipped and the day
 * produces no data.
 */
async function main() {
  const started = Date.now();
  console.log(`[vault-nightly] start ${new Date().toISOString()}`);

  const result = await runVaultNightly(PriceSyncTrigger.CRON);

  console.log(`[vault-nightly] done in ${Date.now() - started}ms`);
  console.log(JSON.stringify(result, null, 2));

  if (result.priceSync.succeeded === 0) {
    console.error('[vault-nightly] nothing could be priced; downstream steps were skipped');
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('[vault-nightly] FATAL', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    // Keep-alive sockets from the price providers hold the event loop open.
    process.exit(process.exitCode ?? 0);
  });
