import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

/**
 * Clear the retired pinning flag from every allocation row.
 *
 * Pinning was removed with the Expert Allocator page. Nothing reads
 * `isUserOverride` any more, so a leftover `true` changes no behaviour -- this
 * only scrubs the rows so the column reads honestly until it is dropped.
 *
 * Safe to run more than once: rows already clear are not matched.
 */
async function main() {
  const before = await prisma.vaultAllocation.findMany({
    where: { isUserOverride: true },
    select: { assetClass: true, targetPercent: true, vault: { select: { vaultNumber: true } } },
  });

  if (before.length === 0) {
    console.log('Nothing to clear: no allocation row carries the flag.');
    return;
  }

  console.log(`Clearing ${before.length} row(s):`);
  for (const row of before) {
    console.log(`  ${row.vault.vaultNumber}  ${row.assetClass} @ ${row.targetPercent}%`);
  }

  const result = await prisma.vaultAllocation.updateMany({
    where: { isUserOverride: true },
    data: { isUserOverride: false, overriddenAt: null },
  });

  console.log(`Cleared ${result.count} row(s).`);
}

main()
  .catch((error) => {
    console.error('Failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
