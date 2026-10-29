import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

/**
 * Restore any class rate that drifted away from the rate members were paid.
 *
 * persistClassRates used to update a stored rate unconditionally, while the
 * credit is frozen after the first write. Running the nightly chain from two
 * schedulers in one day therefore left the published figure disagreeing with
 * the one in members' balances -- crypto for 29 Oct was credited at +0.9969%
 * and redisplayed as -6.6793%.
 *
 * The code no longer allows this: a rate is immutable once anyone has been
 * credited for that class and trading day. This repairs rows written before
 * that fix.
 *
 * THE CREDIT IS THE SOURCE OF TRUTH, not the recomputed rate. A member was
 * paid a specific amount at a specific rate, and VaultClassAccrual recorded
 * both. The statement is corrected to match the money, never the other way
 * round.
 *
 * Reports by default. Pass --apply to write.
 */
async function main() {
  const apply = process.argv.includes('--apply');

  const days = await prisma.vaultClassPerformanceDay.findMany({
    orderBy: [{ performanceDate: 'desc' }, { assetClass: 'asc' }],
  });

  let diverged = 0;
  let repaired = 0;

  for (const day of days) {
    const accruals = await prisma.vaultClassAccrual.findMany({
      where: { assetClass: day.assetClass, accrualDate: day.performanceDate },
      select: { ratePercent: true },
    });

    // Nothing was paid on this day, so there is nothing to contradict.
    if (accruals.length === 0) continue;

    const rates = [...new Set(accruals.map((a) => a.ratePercent))];
    if (rates.length > 1) {
      console.log(
        `  SKIP  ${day.performanceDate.toISOString().slice(0, 10)} ${day.assetClass}: ` +
          `credits disagree on the rate (${rates.join(', ')}); not safe to pick one`,
      );
      continue;
    }

    const credited = rates[0]!;
    if (Math.abs(day.totalPercent - credited) < 1e-9) continue;

    diverged += 1;
    const label = `${day.performanceDate.toISOString().slice(0, 10)} ${day.assetClass}`;
    console.log(
      `  ${label}: stored ${day.totalPercent.toFixed(4)}% vs credited ` +
        `${credited.toFixed(4)}%  (${(day.totalPercent - credited).toFixed(4)} points out)`,
    );

    if (!apply) continue;

    await prisma.vaultClassPerformanceDay.update({
      where: { id: day.id },
      data: {
        totalPercent: credited,
        assetSumPercent: credited - day.upliftPercent,
        // The original per-symbol workings were overwritten by the later run
        // and cannot be recovered. Cleared rather than left showing figures
        // that sum to something other than the headline.
        breakdown: null,
      },
    });
    repaired += 1;
    console.log(`    repaired -> ${credited.toFixed(4)}%`);
  }

  if (diverged === 0) {
    console.log('  Nothing diverged: every credited day matches what members were paid.');
  } else if (apply) {
    console.log(`\n  Repaired ${repaired} of ${diverged}.`);
  } else {
    console.log(`\n  ${diverged} row(s) diverged. Re-run with --apply to repair.`);
  }
}

main()
  .catch((error) => {
    console.error('Failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
