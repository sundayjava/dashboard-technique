import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const runs = await prisma.priceSyncRun.findMany({ orderBy: { startedAt: 'asc' } });
  console.log(`=== ALL SYNC RUNS (${runs.length}) ===`);
  for (const r of runs) {
    console.log(
      `${r.startedAt.toISOString()} ${r.trigger.padEnd(8)} ${r.status.padEnd(8)} ` +
        `attempted=${r.assetsAttempted} ok=${r.assetsSucceeded} failed=${r.assetsFailed} ` +
        `${r.durationMs ?? '?'}ms`,
    );
    if (r.errors) console.log(`   errors: ${r.errors.slice(0, 160)}`);
  }

  const snaps = await prisma.assetPriceSnapshot.findMany({
    include: { asset: { select: { symbol: true } } },
    orderBy: [{ priceDate: 'desc' }, { asset: { displayOrder: 'asc' } }],
  });
  console.log(`\n=== SNAPSHOTS (${snaps.length}) ===`);
  for (const s of snaps) {
    console.log(
      `${s.priceDate.toISOString().slice(0, 10)} ${s.asset.symbol.padEnd(5)} ` +
        `close=${String(s.close).padEnd(12)} src=${s.source.padEnd(12)} ` +
        `chg=${s.changePercent?.toFixed(2) ?? '—'}%`,
    );
  }

  // Prove the unique constraint holds: group by (assetId, priceDate).
  const grouped = await prisma.assetPriceSnapshot.groupBy({
    by: ['assetId', 'priceDate'],
    _count: { _all: true },
  });
  const dupes = grouped.filter((g) => g._count._all > 1);
  console.log(
    `\n=== DUPLICATE CHECK ===\n${dupes.length === 0 ? 'OK: no (asset, date) duplicates' : `FAIL: ${dupes.length} duplicated keys`}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
