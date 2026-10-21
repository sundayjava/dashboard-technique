import { PriceProvider } from '@prisma/client';

/**
 * A single normalised price reading.
 *
 * Every provider adapter converts its vendor-specific payload into this shape,
 * so the sync engine and everything downstream never learns which feed a price
 * came from — only `source` records it, for audit.
 */
export interface PriceQuote {
  /** Vendor identifier this quote was requested under. */
  providerSymbol: string;
  /** The value all vault maths uses. Always > 0. */
  close: number;
  open?: number;
  high?: number;
  low?: number;
  /** Prior trading day's close, when the vendor supplies it. */
  previousClose?: number;
  /** Percentage change vs `previousClose`. */
  changePercent?: number;
  volume?: number;
  /** Trading day this close belongs to, normalised to UTC midnight. */
  priceDate: Date;
  source: PriceProvider;
}

/**
 * Error raised by an adapter when it cannot produce a quote.
 *
 * `retryable` distinguishes conditions worth another attempt (timeout, 5xx,
 * rate limit) from permanent ones (unknown symbol, bad API key). The sync
 * engine retries only the former, so a typo in a symbol does not burn the
 * daily request budget.
 */
export class PriceProviderError extends Error {
  readonly provider: PriceProvider;
  readonly providerSymbol: string;
  readonly retryable: boolean;
  readonly statusCode?: number;

  constructor(params: {
    provider: PriceProvider;
    providerSymbol: string;
    message: string;
    retryable: boolean;
    statusCode?: number;
  }) {
    super(params.message);
    this.name = 'PriceProviderError';
    this.provider = params.provider;
    this.providerSymbol = params.providerSymbol;
    this.retryable = params.retryable;
    this.statusCode = params.statusCode;
  }
}

/**
 * Contract every price feed implements.
 */
export interface PriceProviderAdapter {
  readonly provider: PriceProvider;

  /**
   * Whether this adapter is usable right now — chiefly an API-key check.
   * Unconfigured adapters are skipped with a clear error rather than failing
   * mid-request, which keeps a missing key from looking like an outage.
   */
  isConfigured(): boolean;

  /**
   * Fetch quotes for several symbols at once.
   *
   * Adapters whose vendor supports batching MUST use it — one request for all
   * equities instead of eight is the difference between living inside a free
   * tier and exhausting it. Adapters without batch support may loop, serially,
   * respecting their own per-minute limit.
   *
   * Resolves to a map keyed by `providerSymbol`. A symbol that could not be
   * priced is absent from the map and present in `errors`; a partial result is
   * a success, because a vault that can price 9 of 10 assets is still far more
   * useful than one that reports nothing.
   */
  fetchQuotes(providerSymbols: string[]): Promise<{
    quotes: Map<string, PriceQuote>;
    errors: PriceProviderError[];
  }>;
}

/**
 * Per-request timeout.
 *
 * Sized against measurements, not guesswork:
 *
 *  - At 3.5s, the FIRST sync in a cold process failed every asset. A cold
 *    start pays DNS resolution and a TLS handshake per host before any data
 *    moves, and a Vercel cron is cold by definition — so a timeout that only
 *    suits a warm process would fail precisely when it matters.
 *  - A failed asset costs TWO timeouts, primary then fallback, so the ceiling
 *    is roughly 2x this value per failing asset.
 *
 * 6s still lost every Twelve Data symbol on a cold run while crypto succeeded,
 * so the ceiling is raised again to 10s. Because the two resolution passes run
 * once each (not per asset), the worst case is ~20s even with every feed dead,
 * which sits comfortably inside the 60s maxDuration the cron routes declare.
 * There is no reason to be stingy here: a timeout that is too short turns a
 * slow night into missing data, while one that is too long merely costs
 * seconds of a nightly job.
 *
 * Binance in particular has been observed to hang rather than refuse when
 * unreachable, so this timeout is the only thing bounding it.
 */
export const PROVIDER_TIMEOUT_MS = 10000;

/**
 * Normalise any date to UTC midnight.
 *
 * `AssetPriceSnapshot.priceDate` is a `@db.Date` with a unique constraint per
 * asset. If the time component leaked through, the same trading day fetched at
 * two different clock times could land as two rows and double-count in every
 * return calculation. This function is the single guard against that.
 */
export function toUtcDateOnly(input: Date | string | number): Date {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date supplied to toUtcDateOnly: ${String(input)}`);
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Coerce a vendor numeric field, which may arrive as a string or be absent.
 * Returns undefined for anything non-finite so bad data never reaches the DB.
 */
export function parseVendorNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}
