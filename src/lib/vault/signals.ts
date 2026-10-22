import { VaultAssetClass } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { toUtcDateOnly } from './price-providers';

/**
 * Macro signals for the Expert Allocator.
 *
 * WHAT THIS ACTUALLY MEASURES — read before trusting it.
 *
 * Every signal here is derived from the price history this platform stores.
 * There is no subscription to interest-rate prints, CPI releases or
 * commodity-cycle research, so nothing here is a forecast. What it does is
 * read the market's own revealed behaviour:
 *
 *   - Equity momentum      trailing return of the global equity sleeve
 *   - Rate environment     trailing return of the bond sleeve. Bond prices
 *                          move INVERSELY to yields, so a falling bond proxy
 *                          is a rising-rate environment. This is a genuine
 *                          read on rates, not a proxy for one.
 *   - Inflation pressure   precious metals relative to broad equities. Gold
 *                          outperforming equities is the classic market-priced
 *                          inflation-hedge bid.
 *   - Commodity cycle      trailing return of the futures/commodity sleeve.
 *
 * Signals need real history. With fewer than MIN_HISTORY_DAYS of stored
 * closes, `sufficientHistory` is false and the allocator MUST NOT tilt — it
 * falls back to the member's plain target. Tilting on a week of data would be
 * noise dressed up as judgement, applied to someone's retirement.
 */

/** Trailing window for momentum. One quarter of trading days. */
export const MOMENTUM_WINDOW_DAYS = 90;

/**
 * Minimum stored history before any signal is trusted.
 *
 * Set to a full window: a "90-day momentum" computed over 20 days is not a
 * weaker signal, it is a different and misleading one.
 */
export const MIN_HISTORY_DAYS = 90;

/** Return above/below which a signal counts as meaningfully directional. */
const STRONG_MOVE_PERCENT = 5;

export type SignalDirection = 'positive' | 'negative' | 'neutral';

export interface Signal {
  name: string;
  /** Trailing percentage change over the window. */
  valuePercent: number;
  direction: SignalDirection;
  /** Plain-English reading, used to build the member-facing explanation. */
  reading: string;
}

export interface SignalSet {
  /** False when there is not enough stored history to compute signals. */
  sufficientHistory: boolean;
  historyDays: number;
  windowStart: Date | null;
  windowEnd: Date | null;
  equityMomentum: Signal | null;
  rateEnvironment: Signal | null;
  inflationPressure: Signal | null;
  commodityCycle: Signal | null;
  /** Why signals are unavailable, when they are. */
  note: string | null;
}

function classify(valuePercent: number): SignalDirection {
  if (valuePercent >= STRONG_MOVE_PERCENT) return 'positive';
  if (valuePercent <= -STRONG_MOVE_PERCENT) return 'negative';
  return 'neutral';
}

interface ClassReturn {
  assetClass: VaultAssetClass;
  startValue: number;
  endValue: number;
  returnPercent: number;
}

/**
 * Trailing return per asset class, equal-weighted across its instruments.
 *
 * Equal-weighting avoids a class's reading being dominated by whichever
 * instrument happens to carry the larger sleeve weight, which would make the
 * signal change meaning whenever an admin retunes a split.
 */
async function getClassReturns(
  windowStart: Date,
  windowEnd: Date,
): Promise<Map<VaultAssetClass, ClassReturn>> {
  const assets = await prisma.vaultAsset.findMany({
    where: { isActive: true },
    select: { id: true, assetClass: true, symbol: true },
  });

  const [startRows, endRows] = await Promise.all([
    prisma.$queryRaw<{ assetId: string; close: number }[]>`
      SELECT DISTINCT ON (s."assetId") s."assetId" AS "assetId", s."close" AS close
      FROM asset_price_snapshots s
      WHERE s."priceDate" <= ${windowStart}
      ORDER BY s."assetId", s."priceDate" DESC
    `,
    prisma.$queryRaw<{ assetId: string; close: number }[]>`
      SELECT DISTINCT ON (s."assetId") s."assetId" AS "assetId", s."close" AS close
      FROM asset_price_snapshots s
      WHERE s."priceDate" <= ${windowEnd}
      ORDER BY s."assetId", s."priceDate" DESC
    `,
  ]);

  const startByAsset = new Map(startRows.map((r) => [r.assetId, Number(r.close)]));
  const endByAsset = new Map(endRows.map((r) => [r.assetId, Number(r.close)]));

  const perClass = new Map<VaultAssetClass, { returns: number[] }>();

  for (const asset of assets) {
    const start = startByAsset.get(asset.id);
    const end = endByAsset.get(asset.id);
    if (start === undefined || end === undefined || start <= 0) continue;

    const entry = perClass.get(asset.assetClass) ?? { returns: [] };
    entry.returns.push(((end - start) / start) * 100);
    perClass.set(asset.assetClass, entry);
  }

  const result = new Map<VaultAssetClass, ClassReturn>();
  for (const [assetClass, entry] of perClass) {
    if (entry.returns.length === 0) continue;
    const returnPercent = entry.returns.reduce((a, b) => a + b, 0) / entry.returns.length;
    result.set(assetClass, { assetClass, startValue: 0, endValue: 0, returnPercent });
  }
  return result;
}

/** How many distinct days of price history exist. */
export async function getStoredHistoryDays(): Promise<{
  days: number;
  earliest: Date | null;
  latest: Date | null;
}> {
  const rows = await prisma.$queryRaw<{ days: bigint; earliest: Date | null; latest: Date | null }[]>`
    SELECT COUNT(DISTINCT s."priceDate") AS days,
           MIN(s."priceDate") AS earliest,
           MAX(s."priceDate") AS latest
    FROM asset_price_snapshots s
  `;
  const row = rows[0];
  return {
    days: row === undefined ? 0 : Number(row.days),
    earliest: row?.earliest ?? null,
    latest: row?.latest ?? null,
  };
}

/**
 * Compute the signal set as at a date.
 *
 * Returns sufficientHistory=false rather than throwing, so a caller can fall
 * back to the plain target instead of failing a rebalance outright.
 */
export async function computeSignals(asOf: Date = new Date()): Promise<SignalSet> {
  const windowEnd = toUtcDateOnly(asOf);
  const windowStart = new Date(
    windowEnd.getTime() - MOMENTUM_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const history = await getStoredHistoryDays();

  const empty: SignalSet = {
    sufficientHistory: false,
    historyDays: history.days,
    windowStart,
    windowEnd,
    equityMomentum: null,
    rateEnvironment: null,
    inflationPressure: null,
    commodityCycle: null,
    note: null,
  };

  if (history.days < MIN_HISTORY_DAYS) {
    return {
      ...empty,
      note:
        `Only ${history.days} day(s) of price history are stored; ` +
        `${MIN_HISTORY_DAYS} are needed before macro signals are meaningful. ` +
        `Allocations follow the plain profile target until then.`,
    };
  }

  const returns = await getClassReturns(windowStart, windowEnd);

  const equity = returns.get(VaultAssetClass.GLOBAL_EQUITIES);
  const bonds = returns.get(VaultAssetClass.FIXED_INCOME);
  const commodities = returns.get(VaultAssetClass.COMMODITIES);
  const futures = returns.get(VaultAssetClass.FUTURES_MACRO);

  if (equity === undefined || bonds === undefined) {
    return {
      ...empty,
      note: 'Core asset classes could not be priced across the window.',
    };
  }

  const equityMomentum: Signal = {
    name: 'Equity momentum',
    valuePercent: equity.returnPercent,
    direction: classify(equity.returnPercent),
    reading:
      equity.returnPercent >= STRONG_MOVE_PERCENT
        ? 'global equities have run strongly this quarter'
        : equity.returnPercent <= -STRONG_MOVE_PERCENT
          ? 'global equities have fallen materially this quarter'
          : 'global equities have been broadly flat this quarter',
  };

  // Bond prices move inversely to yields, so the sign is flipped: a falling
  // bond sleeve means rates rose.
  const rateMove = -bonds.returnPercent;
  const rateEnvironment: Signal = {
    name: 'Interest rate environment',
    valuePercent: rateMove,
    direction: classify(rateMove),
    reading:
      rateMove >= STRONG_MOVE_PERCENT
        ? 'bond prices have fallen, indicating a rising rate environment'
        : rateMove <= -STRONG_MOVE_PERCENT
          ? 'bond prices have risen, indicating an easing rate environment'
          : 'the rate environment has been stable',
  };

  // Metals outperforming equities is the market paying up for an inflation
  // hedge, which is what this is reading.
  const inflationSpread =
    commodities === undefined ? 0 : commodities.returnPercent - equity.returnPercent;
  const inflationPressure: Signal = {
    name: 'Inflation pressure',
    valuePercent: inflationSpread,
    direction: classify(inflationSpread),
    reading:
      inflationSpread >= STRONG_MOVE_PERCENT
        ? 'precious metals have outpaced equities, a classic inflation-hedge bid'
        : inflationSpread <= -STRONG_MOVE_PERCENT
          ? 'precious metals have lagged equities, suggesting easing inflation concern'
          : 'inflation signals have been subdued',
  };

  const commodityValue = futures?.returnPercent ?? commodities?.returnPercent ?? 0;
  const commodityCycle: Signal = {
    name: 'Commodity cycle',
    valuePercent: commodityValue,
    direction: classify(commodityValue),
    reading:
      commodityValue >= STRONG_MOVE_PERCENT
        ? 'the broad commodity complex has been advancing'
        : commodityValue <= -STRONG_MOVE_PERCENT
          ? 'the broad commodity complex has been retreating'
          : 'commodities have been range-bound',
  };

  return {
    sufficientHistory: true,
    historyDays: history.days,
    windowStart,
    windowEnd,
    equityMomentum,
    rateEnvironment,
    inflationPressure,
    commodityCycle,
    note: null,
  };
}
