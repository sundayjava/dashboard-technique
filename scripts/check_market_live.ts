import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { isUsSessionOpen } from '../src/lib/vault/market-hours';

/**
 * Why each row on the market board says "live" or "close".
 *
 * The board's dot is three ANDed conditions, and when it is not green the
 * interesting question is always WHICH one failed -- a missed sync, a bar the
 * vendor stamped yesterday, or simply a shut market. Reading that off the
 * board is impossible, and guessing at it cost real time, so this prints the
 * three columns the rule actually evaluates.
 *
 * Mirrors the STORED half of src/app/api/retirement-vault/market/route.ts.
 * The route additionally fetches CoinGecko in the request path, so the coins
 * are live there whenever that fetch succeeds regardless of what this prints;
 * a "close" on a crypto row here means only that the stored row is stale, which
 * is what the nightly chain reads. Read-only.
 */
const STORED_LIVE_WINDOW_MS = 30 * 60 * 1000;

async function main() {
  const now = new Date();
  const sessionOpen = isUsSessionOpen(now);
  const todayUtc = now.toISOString().slice(0, 10);

  console.log(`\n  now             ${now.toISOString()}   (UTC weekday ${now.getUTCDay()})`);
  console.log(`  US session      ${sessionOpen ? 'OPEN' : 'closed'}`);
  console.log(`  today (UTC)     ${todayUtc}\n`);

  const assets = await prisma.vaultAsset.findMany({
    where: { isActive: true },
    orderBy: [{ provider: 'asc' }, { symbol: 'asc' }],
    select: { id: true, symbol: true, provider: true, lastSyncedAt: true },
  });

  const snaps = await prisma.assetPriceSnapshot.findMany({
    where: { assetId: { in: assets.map((a) => a.id) } },
    orderBy: [{ assetId: 'asc' }, { priceDate: 'desc' }],
    distinct: ['assetId'],
    select: { assetId: true, priceDate: true },
  });
  const latest = new Map(snaps.map((s) => [s.assetId, s]));

  console.log('  symbol  provider     latest bar   synced       bar=today  fresh  trading   dot');
  console.log('  ' + '-'.repeat(84));

  for (const a of assets) {
    const snap = latest.get(a.id);
    const syncedAt = a.lastSyncedAt?.getTime() ?? 0;
    const continuous = a.provider === 'COINGECKO';
    const dateOk = snap?.priceDate.toISOString().slice(0, 10) === todayUtc;
    const freshOk = Date.now() - syncedAt < STORED_LIVE_WINDOW_MS;
    const tradingOk = continuous || sessionOpen;
    const live = tradingOk && dateOk && freshOk;

    const age = syncedAt ? `${Math.round((Date.now() - syncedAt) / 60000)}m ago` : 'never';
    console.log(
      `  ${a.symbol.padEnd(7)} ${a.provider.padEnd(12)} ` +
        `${(snap?.priceDate.toISOString().slice(0, 10) ?? '-').padEnd(12)} ${age.padEnd(12)} ` +
        `${(dateOk ? 'yes' : 'NO').padEnd(10)} ${(freshOk ? 'yes' : 'NO').padEnd(6)} ` +
        `${(continuous ? '24/7' : tradingOk ? 'yes' : 'NO').padEnd(9)} ${live ? 'LIVE' : 'close'}`,
    );
  }
  console.log();
}

main()
  .catch((error) => {
    console.error('Failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
