import { VaultAssetClass } from './asset-classes';
import { ContributionStatus, Prisma, VaultStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { BENCHMARK_BLEND } from './asset-registry';
import { AllocationMap, getAllAssetClasses } from './allocation-model';
import { toUtcDateOnly } from './price-providers';
import { buildClassPositions } from './class-performance';

/**
 * Vault valuation.
 *
 * A vault is worth (units x price) for every holding, plus uninvested cash.
 * Nothing here stores a derived value that could go stale: values are computed
 * from units and the price history written by the sync engine.
 *
 * FORWARD FILL — the rule this module exists to get right.
 *
 * Asset classes keep different trading calendars. Crypto prices every day;
 * equities, bonds, commodities and REITs only on exchange trading days. So no
 * single `priceDate` is guaranteed to hold every asset, and valuing a vault by
 * joining all holdings on one date would silently omit whatever failed to
 * match — understating the vault, worst on weekends and holidays.
 *
 * Every price lookup here therefore takes, per asset, the most recent close ON
 * OR BEFORE the valuation date. That is the standard treatment for portfolios
 * mixing 24/7 and exchange-hours assets.
 */

export interface PriceAsOf {
  assetId: string;
  symbol: string;
  close: number;
  /** The trading day this close actually came from; may precede the request. */
  priceDate: Date;
}

interface PriceRow {
  asset_id: string;
  symbol: string;
  close: number;
  price_date: Date;
}


/* ---------------------------------------------------------------- caching */

/**
 * Price lookups are cached per date, because one vault valuation asks for the
 * same prices five or more times: once for the holdings, twice to build the
 * benchmark index, and twice more for every distinct contribution date. Each
 * is a ~230ms round-trip to a remote database, which is most of the 1.5s a
 * valuation used to take.
 *
 * WHAT IS CACHED IS DELIBERATELY NARROW. Only market prices and the benchmark
 * index, which are the same for every member and change only when the sync
 * writes. Holdings, cash and contributions are never cached — those move when
 * a member acts, and serving a stale balance would be worse than being slow.
 *
 * Two things keep it from becoming a constraint:
 *  - the price sync clears it the moment it writes, so new prices are visible
 *    immediately rather than after a timer;
 *  - entries expire anyway, so a cache that somehow missed an invalidation
 *    corrects itself within the TTL instead of being wrong until redeploy.
 */
const PRICE_CACHE_TTL_MS = 60_000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const priceCache = new Map<string, CacheEntry<Map<string, PriceAsOf>>>();
const benchmarkIndexCache = new Map<string, CacheEntry<number | null>>();

/** Drop every cached price and index. Called by the sync after it writes. */
export function invalidatePriceCaches(): void {
  priceCache.clear();
  benchmarkIndexCache.clear();
  benchmarkBaseCache = null;
}

function cacheKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function readCache<T>(store: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const hit = store.get(key);
  if (hit === undefined) return undefined;
  if (hit.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return hit.value;
}

function writeCache<T>(store: Map<string, CacheEntry<T>>, key: string, value: T): void {
  // Bound the map so a long-lived process valuing many historical dates
  // cannot grow it without limit.
  if (store.size > 400) store.clear();
  store.set(key, { value, expiresAt: Date.now() + PRICE_CACHE_TTL_MS });
}

/**
 * Latest close per asset on or before `asOf`.
 *
 * Uses Postgres DISTINCT ON, which resolves the forward fill in one query
 * rather than one query per asset.
 */
export async function getPricesAsOf(asOf: Date = new Date()): Promise<Map<string, PriceAsOf>> {
  const date = toUtcDateOnly(asOf);

  const key = cacheKey(date);
  const cached = readCache(priceCache, key);
  if (cached !== undefined) return cached;

  // Columns are quoted: Prisma's @@map renames tables only, so the columns are
  // camelCase and Postgres would otherwise fold them to lower case.
  const rows = await prisma.$queryRaw<PriceRow[]>`
    SELECT DISTINCT ON (s."assetId")
      s."assetId" AS asset_id,
      a."symbol"  AS symbol,
      s."close"   AS close,
      s."priceDate" AS price_date
    FROM asset_price_snapshots s
    JOIN vault_assets a ON a."id" = s."assetId"
    WHERE s."priceDate" <= ${date}
    ORDER BY s."assetId", s."priceDate" DESC
  `;

  const result = new Map<string, PriceAsOf>();
  for (const row of rows) {
    result.set(row.asset_id, {
      assetId: row.asset_id,
      symbol: row.symbol,
      close: Number(row.close),
      priceDate: row.price_date,
    });
  }

  writeCache(priceCache, key, result);
  return result;
}

/** The same forward-filled prices, keyed by ticker. */
export async function getPricesBySymbolAsOf(
  asOf: Date = new Date(),
): Promise<Map<string, PriceAsOf>> {
  const byId = await getPricesAsOf(asOf);
  const bySymbol = new Map<string, PriceAsOf>();
  for (const price of byId.values()) bySymbol.set(price.symbol, price);
  return bySymbol;
}

/**
 * Base date for the benchmark index.
 *
 * The index is rebased to 100 on the first day both benchmark legs have a
 * price. Cached per process: it only moves if history is deleted.
 */
let benchmarkBaseCache: { date: Date; prices: Map<string, number> } | null = null;

export const BENCHMARK_BASE_VALUE = 100;

async function getBenchmarkBase(): Promise<{ date: Date; prices: Map<string, number> } | null> {
  if (benchmarkBaseCache !== null) return benchmarkBaseCache;

  const symbols = BENCHMARK_BLEND.map((leg) => leg.symbol);

  // The earliest date on which EVERY leg has a close. Starting from a date
  // where one leg is missing would rebase the index against a partial basket.
  const rows = await prisma.$queryRaw<{ price_date: Date }[]>`
    SELECT s."priceDate" AS price_date
    FROM asset_price_snapshots s
    JOIN vault_assets a ON a."id" = s."assetId"
    WHERE a."symbol" IN (${Prisma.join(symbols)})
    GROUP BY s."priceDate"
    HAVING COUNT(DISTINCT a."symbol") = ${symbols.length}
    ORDER BY s."priceDate" ASC
    LIMIT 1
  `;

  const baseDate = rows[0]?.price_date;
  if (baseDate === undefined) return null;

  const prices = await getPricesBySymbolAsOf(baseDate);
  const basePrices = new Map<string, number>();
  for (const leg of BENCHMARK_BLEND) {
    const price = prices.get(leg.symbol);
    if (price === undefined) return null;
    basePrices.set(leg.symbol, price.close);
  }

  benchmarkBaseCache = { date: baseDate, prices: basePrices };
  return benchmarkBaseCache;
}

/** Clear the cached base date. Used by tests and after history is rewritten. */
export function resetBenchmarkBaseCache(): void {
  benchmarkBaseCache = null;
}

/**
 * The traditional-401k comparator, as an index level.
 *
 * A fixed-weight 60/40 basket rebased to 100 at the base date:
 *
 *   index(t) = 100 x SUM( weight_i x price_i(t) / price_i(base) )
 *
 * Weights are applied to each leg's RETURN since the base date, not to raw
 * share counts. Weighting share counts would be wrong: 0.6 shares of a $769
 * ETF against 0.4 shares of a $71 one is a 94/6 split by value, not 60/40.
 *
 * This is buy-and-hold, not periodically rebalanced — which is exactly what a
 * passive 401k does, and so is the fair thing to measure an actively
 * rebalanced vault against.
 */
export async function getBenchmarkIndex(asOf: Date = new Date()): Promise<number | null> {
  const key = cacheKey(toUtcDateOnly(asOf));
  const cached = readCache(benchmarkIndexCache, key);
  if (cached !== undefined) return cached;

  const base = await getBenchmarkBase();
  if (base === null) return null;

  const prices = await getPricesBySymbolAsOf(asOf);

  let index = 0;
  for (const leg of BENCHMARK_BLEND) {
    const current = prices.get(leg.symbol);
    const basePrice = base.prices.get(leg.symbol);
    if (current === undefined || basePrice === undefined || basePrice <= 0) return null;
    index += leg.weight * (current.close / basePrice);
  }

  const value = index * BENCHMARK_BASE_VALUE;
  writeCache(benchmarkIndexCache, key, value);
  return value;
}

export interface HoldingValuation {
  assetId: string;
  symbol: string;
  assetClass: VaultAssetClass;
  units: number;
  price: number;
  priceDate: Date;
  value: number;
  costBasis: number;
  gainLoss: number;
  gainLossPercent: number;
}

export interface VaultValuationResult {
  vaultId: string;
  valuationDate: Date;
  /**
   * False when a held asset had no usable price. The valuation is then
   * incomplete and MUST NOT be stored: an understated figure presented as a
   * balance is worse than no figure at all.
   */
  complete: boolean;
  missingPrices: string[];
  holdingsValue: number;
  cashBalance: number;
  totalValue: number;
  contributedToDate: number;
  unrealisedGainLoss: number;
  unrealisedGainLossPercent: number;
  /** Current share of the vault per asset class, for drift detection. */
  currentAllocation: AllocationMap;
  /** Performance the daily engine has credited, summed across classes. */
  accruedPerformance: number;
  /** Principal and credited performance per class, for the allocation view. */
  classValues: Record<string, { principal: number; accrued: number; value: number }>;
  holdings: HoldingValuation[];
  benchmarkValue: number | null;
  benchmarkIndex: number | null;
}

function emptyAllocationMap(): AllocationMap {
  return {
    [VaultAssetClass.GLOBAL_EQUITIES]: 0,
    [VaultAssetClass.FIXED_INCOME]: 0,
    [VaultAssetClass.COMMODITIES]: 0,
    [VaultAssetClass.REAL_ESTATE]: 0,
    [VaultAssetClass.FUTURES_MACRO]: 0,
    [VaultAssetClass.CRYPTO]: 0,
  };
}

/**
 * Value one vault as at a date.
 *
 * Read-only; `recordVaultValuation` persists the result.
 */
export interface PreloadedVaultRows {
  vault: {
    cashBalance: number;
    totalContributed: number;
    totalWithdrawn: number;
    holdings: Array<{
      assetId: string;
      units: number;
      costBasis: number;
      asset: { symbol: string; assetClass: VaultAssetClass };
    }>;
    allocations: Array<{
      assetClass: string;
      accruedPerformance: number;
      lastAccruedDate: Date | null;
    }>;
  };
  contributions: Array<{ amount: number; processedAt: Date | null }>;
  withdrawals: Array<{ netAmount: number; processedAt: Date | null }>;
}

export async function valueVault(
  vaultId: string,
  asOf: Date = new Date(),
  /**
   * Rows the caller has already fetched.
   *
   * This database multiplexes through a proxy and does NOT execute queries
   * concurrently — five trivial queries in parallel measured slower than five
   * in series. So the only way to make a page faster is to ask for less, and
   * a caller holding the vault already should not make us fetch it again.
   */
  preloaded?: PreloadedVaultRows,
): Promise<VaultValuationResult | null> {
  const valuationDate = toUtcDateOnly(asOf);

  // These three do not depend on one another, and each is a round-trip to a
  // remote database. Running them in series was the bulk of what remained
  // after caching: the member data cannot be cached, but it can be fetched
  // alongside everything else instead of after it.
  const endOfDay = new Date(valuationDate.getTime() + 24 * 60 * 60 * 1000);

  const prices = await getPricesAsOf(valuationDate);

  let vault: PreloadedVaultRows['vault'] | null;
  let contributions: PreloadedVaultRows['contributions'];
  let withdrawals: PreloadedVaultRows['withdrawals'];

  if (preloaded !== undefined) {
    ({ vault, contributions, withdrawals } = preloaded);
  } else {
    const [v, c, w] = await Promise.all([
      prisma.retirementVault.findUnique({
        where: { id: vaultId },
        include: { holdings: { include: { asset: true } }, allocations: true },
      }),
      prisma.vaultContribution.findMany({
        where: {
          vaultId,
          status: ContributionStatus.COMPLETED,
          processedAt: { not: null, lt: endOfDay },
        },
        select: { amount: true, processedAt: true },
        orderBy: { processedAt: 'asc' },
      }),
      prisma.vaultWithdrawalRequest.findMany({
        where: { vaultId, status: 'PAID', processedAt: { not: null, lt: endOfDay } },
        select: { netAmount: true, processedAt: true },
      }),
    ]);
    vault = v;
    contributions = c;
    withdrawals = w;
  }

  if (vault === null) return null;

  // WHAT A HOLDING IS WORTH, AND WHY IT IS NOT units x price.
  //
  // A class now earns one rate a day -- the sum of its instruments' closes
  // plus the admin's uplift -- and that rate is what moves a member's money.
  // See class-performance.ts. Valuing the same market movement a second time
  // through the share price would pay for it twice, so the balance is
  // principal (cost basis) plus the performance credited to the class.
  //
  // Prices are still read and still reported per holding: they are what the
  // member sees on the market board, and they are the input the rate is built
  // from. They simply no longer set the balance.
  const positions = buildClassPositions(vault);

  const holdings: HoldingValuation[] = [];
  const missingPrices: string[] = [];
  let holdingsValue = 0;
  let accruedPerformance = 0;

  for (const holding of vault.holdings) {
    // A zero-unit holding is a closed position, not a missing price.
    if (holding.units === 0) continue;

    const price = prices.get(holding.assetId);
    if (price === undefined) missingPrices.push(holding.asset.symbol);

    const position = positions.get(holding.asset.assetClass);

    // The class's credited performance is split across its instruments by
    // their share of the principal, so the parts still add up to the class.
    const share =
      position !== undefined && position.principal > 0
        ? holding.costBasis / position.principal
        : 0;
    const gainLoss = (position?.accrued ?? 0) * share;
    const value = holding.costBasis + gainLoss;

    holdings.push({
      assetId: holding.assetId,
      symbol: holding.asset.symbol,
      assetClass: holding.asset.assetClass,
      units: holding.units,
      price: price?.close ?? 0,
      priceDate: price?.priceDate ?? valuationDate,
      value,
      costBasis: holding.costBasis,
      gainLoss,
      gainLossPercent: holding.costBasis > 0 ? (gainLoss / holding.costBasis) * 100 : 0,
    });

    holdingsValue += value;
    accruedPerformance += gainLoss;
  }

  // Performance credited to a class the member has since sold out of. It is
  // theirs and must not vanish from the total just because the principal that
  // earned it has gone.
  const classValues: Record<string, { principal: number; accrued: number; value: number }> = {};
  for (const position of positions.values()) {
    classValues[position.assetClass] = {
      principal: position.principal,
      accrued: position.accrued,
      value: position.value,
    };
    if (position.principal <= 0 && position.accrued !== 0) {
      holdingsValue += position.accrued;
      accruedPerformance += position.accrued;
    }
  }

  const totalValue = holdingsValue + vault.cashBalance;

  // Current weights by class. Cash is excluded from the denominator so drift
  // is measured against invested capital: a large pending deposit would
  // otherwise make every class look underweight and trigger a needless
  // rebalance.
  const currentAllocation = emptyAllocationMap();
  if (holdingsValue > 0) {
    for (const holding of holdings) {
      currentAllocation[holding.assetClass] += (holding.value / holdingsValue) * 100;
    }
  }

  const unrealisedGainLoss = totalValue - vault.totalContributed + vault.totalWithdrawn;

  const benchmarkIndex = await getBenchmarkIndex(valuationDate);
  const benchmarkValue = await computeBenchmarkValue(
    valuationDate,
    benchmarkIndex,
    contributions,
    withdrawals,
  );

  return {
    vaultId,
    valuationDate,
    complete: missingPrices.length === 0,
    missingPrices,
    holdingsValue,
    cashBalance: vault.cashBalance,
    totalValue,
    contributedToDate: vault.totalContributed,
    unrealisedGainLoss,
    unrealisedGainLossPercent:
      vault.totalContributed > 0 ? (unrealisedGainLoss / vault.totalContributed) * 100 : 0,
    currentAllocation,
    accruedPerformance,
    classValues,
    holdings,
    benchmarkValue,
    benchmarkIndex,
  };
}

/**
 * What the member's own contributions would be worth in a traditional 401k.
 *
 * Each completed contribution buys units of the benchmark index at the index
 * level on the day it landed, exactly as it bought into the vault. Comparing
 * a lump sum against a vault built from monthly contributions would flatter
 * whichever side happened to suit the market, so the cashflows must match.
 *
 * Withdrawals sell benchmark units at their own date's level, for the same
 * reason.
 */
async function computeBenchmarkValue(
  asOf: Date,
  currentIndex: number | null,
  // Prefetched alongside the holdings, since neither depends on the other.
  // Both are bounded by the END of the valuation day: `asOf` is truncated to
  // UTC midnight, so a `<=` comparison would exclude everything that happened
  // during that day, including the contribution that opened the vault.
  contributions: Array<{ amount: number; processedAt: Date | null }>,
  withdrawals: Array<{ netAmount: number; processedAt: Date | null }>,
): Promise<number | null> {
  if (currentIndex === null) return null;
  if (contributions.length === 0) return null;

  // Index levels are looked up once per distinct date rather than per
  // contribution, since many contributions share a date.
  const indexByDate = new Map<number, number | null>();

  async function indexOn(date: Date): Promise<number | null> {
    const key = toUtcDateOnly(date).getTime();
    const cached = indexByDate.get(key);
    if (cached !== undefined) return cached;
    const value = await getBenchmarkIndex(new Date(key));
    indexByDate.set(key, value);
    return value;
  }

  let units = 0;
  for (const contribution of contributions) {
    if (contribution.processedAt === null) continue;
    const level = await indexOn(contribution.processedAt);
    // A contribution predating any price history cannot be placed on the
    // index; skipping it understates the benchmark, so the comparison is
    // withheld entirely rather than shown as misleadingly low.
    if (level === null || level <= 0) return null;
    units += contribution.amount / level;
  }

  for (const withdrawal of withdrawals) {
    if (withdrawal.processedAt === null) continue;
    const level = await indexOn(withdrawal.processedAt);
    if (level === null || level <= 0) return null;
    units -= withdrawal.netAmount / level;
  }

  return Math.max(0, units) * currentIndex;
}

export interface RecordValuationResult {
  recorded: boolean;
  reason?: string;
  valuation: VaultValuationResult | null;
}

/**
 * Persist a vault's valuation for a date.
 *
 * Idempotent on (vaultId, valuationDate): re-running a day corrects it rather
 * than duplicating it, matching how price snapshots behave.
 *
 * Refuses to store an incomplete valuation. A balance that silently omits a
 * holding is worse than a gap in the series, because the gap is visible and
 * the wrong number is not.
 */
export async function recordVaultValuation(
  vaultId: string,
  asOf: Date = new Date(),
): Promise<RecordValuationResult> {
  const valuation = await valueVault(vaultId, asOf);

  if (valuation === null) {
    return { recorded: false, reason: 'Vault not found.', valuation: null };
  }

  // A MISSING PRICE NO LONGER BLOCKS THE RECORD.
  //
  // This used to refuse, and rightly so: when a vault was worth units x price,
  // an absent price understated it and a wrong balance is worse than a gap.
  // A vault is now worth its principal plus the performance credited to it,
  // and neither depends on a price, so every figure stored below is correct
  // whether or not an instrument happened to sync.
  //
  // Refusing anyway would be worse than useless here, because the gap can
  // never be closed: book value is not reconstructible from price history, so
  // a night skipped is a hole in the member's chart forever. The benchmark is
  // the one price-dependent field and it is already nullable, so it simply
  // comes through empty for that day.

  await prisma.vaultValuation.upsert({
    where: {
      vaultId_valuationDate: {
        vaultId,
        valuationDate: valuation.valuationDate,
      },
    },
    create: {
      vaultId,
      valuationDate: valuation.valuationDate,
      totalValue: valuation.totalValue,
      cashBalance: valuation.cashBalance,
      contributedToDate: valuation.contributedToDate,
      unrealisedGainLoss: valuation.unrealisedGainLoss,
      benchmarkValue: valuation.benchmarkValue,
    },
    update: {
      totalValue: valuation.totalValue,
      cashBalance: valuation.cashBalance,
      contributedToDate: valuation.contributedToDate,
      unrealisedGainLoss: valuation.unrealisedGainLoss,
      benchmarkValue: valuation.benchmarkValue,
    },
  });

  await prisma.retirementVault.update({
    where: { id: vaultId },
    data: { lastValuedAt: new Date() },
  });

  return {
    recorded: true,
    // Still reported, because a missing price means the market board and the
    // benchmark are stale even though the balance is sound.
    reason:
      valuation.missingPrices.length > 0
        ? `Recorded; no price for: ${valuation.missingPrices.join(', ')}`
        : undefined,
    valuation,
  };
}

export interface BatchValuationResult {
  attempted: number;
  recorded: number;
  skipped: number;
  failures: Array<{ vaultId: string; reason: string }>;
}

/**
 * Value every active vault for a date.
 *
 * Vaults are valued independently: one vault missing a price must not stop the
 * rest from being valued.
 */
export async function valueAllActiveVaults(
  asOf: Date = new Date(),
): Promise<BatchValuationResult> {
  const vaults = await prisma.retirementVault.findMany({
    where: { status: VaultStatus.ACTIVE },
    select: { id: true },
  });

  const failures: Array<{ vaultId: string; reason: string }> = [];
  let recorded = 0;

  for (const vault of vaults) {
    try {
      const result = await recordVaultValuation(vault.id, asOf);
      if (result.recorded) {
        recorded += 1;
      } else {
        failures.push({ vaultId: vault.id, reason: result.reason ?? 'Unknown' });
      }
    } catch (error) {
      failures.push({
        vaultId: vault.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    attempted: vaults.length,
    recorded,
    skipped: failures.length,
    failures,
  };
}

/** Asset classes with no holding, useful when building a first allocation. */
export function getUnallocatedClasses(allocation: AllocationMap): VaultAssetClass[] {
  return getAllAssetClasses().filter((c) => allocation[c] === 0);
}
