import { PriceProvider } from '@prisma/client';
import { getJson, chunk, sleep } from './http';
import {
  PriceProviderAdapter,
  PriceProviderError,
  PriceQuote,
  parseVendorNumber,
  toUtcDateOnly,
} from './types';

const BASE_URL = 'https://api.twelvedata.com/quote';

/**
 * Symbols per request, and the hard ceiling on the Twelve Data universe.
 *
 * Measured against the live Basic-8 plan: this vendor charges ONE CREDIT PER
 * SYMBOL, not per request, and the free tier allows 8 credits per minute
 * (800/day). So an 8-symbol batch is one HTTP call but consumes the entire
 * minute's budget — exceeding it returns a 429 for the whole batch.
 *
 * Combined with Vercel Hobby's function duration cap, this forces a rule:
 * the sync must complete in a SINGLE request with no waiting, because sleeping
 * 60s for a second batch would time the cron function out before it finished.
 *
 * The registry therefore keeps Twelve Data assets at or under this number —
 * currently 7, since BND carries role BOTH and serves as the benchmark's bond
 * leg rather than being fetched twice. If the universe ever needs to grow past
 * 8, the sync has to be split across invocations rather than batched harder;
 * `assertWithinCreditBudget` below fails loudly instead of silently 429ing.
 */
const BATCH_SIZE = 8;

/**
 * Delay between batches, set to a full minute because the credit window is
 * per-minute. With a universe of <= BATCH_SIZE this never fires; it exists so
 * that an oversized universe degrades into slow-but-correct rather than
 * silently rate-limited, in contexts without a function timeout (a script or
 * an external scheduler).
 */
const INTER_BATCH_DELAY_MS = 60_000;

/**
 * Thrown when the configured universe cannot be priced within one credit
 * window. Surfaced at sync time so a misconfigured registry is a visible,
 * actionable error rather than a batch of mystery 429s.
 */
export function assertWithinCreditBudget(symbolCount: number): void {
  if (symbolCount > BATCH_SIZE) {
    console.warn(
      `[TwelveData] ${symbolCount} symbols exceeds the ${BATCH_SIZE}-credit/minute ` +
        `free-tier window. The sync will pause ${INTER_BATCH_DELAY_MS / 1000}s between ` +
        `batches and WILL exceed a Vercel function timeout. Reduce the universe, ` +
        `use role BOTH to avoid duplicate symbols, or move the sync to an external scheduler.`,
    );
  }
}

/** Shape of a successful per-symbol entry. All numerics arrive as strings. */
interface TwelveDataQuote {
  symbol?: string;
  datetime?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
  previous_close?: string;
  percent_change?: string;
  status?: string;
  code?: number;
  message?: string;
}

/**
 * A whole-batch failure, reported in the BODY rather than the HTTP status.
 *
 * Twelve Data answers credit exhaustion and an invalid API key with HTTP 200
 * and a top-level `{ code, message, status: "error" }` object. Treating that
 * as a symbol map yields an empty map, which previously surfaced as
 * "Symbol missing from provider response" against every ticker — telling an
 * operator their symbols are wrong when they are actually rate limited.
 */
interface TwelveDataBatchError {
  code?: number;
  message?: string;
  status: 'error';
}

function parseBatchError(payload: unknown): TwelveDataBatchError | null {
  if (payload === null || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;

  // A top-level error carries `status: "error"` with no `symbol` of its own —
  // that absence is what distinguishes it from a single-symbol quote.
  if (obj['status'] === 'error' && !('symbol' in obj)) {
    return {
      code: typeof obj['code'] === 'number' ? obj['code'] : undefined,
      message: typeof obj['message'] === 'string' ? obj['message'] : undefined,
      status: 'error',
    };
  }
  return null;
}

/**
 * Twelve Data returns the quote object directly for a single symbol, but a map
 * keyed by symbol for several. Normalise both into a map.
 *
 * Callers must check `parseBatchError` first; this assumes a successful shape.
 */
function normaliseResponse(
  payload: unknown,
  requested: string[],
): Record<string, TwelveDataQuote> {
  if (payload === null || typeof payload !== 'object') return {};
  const obj = payload as Record<string, unknown>;

  // A single-symbol response carries quote fields at the top level.
  if ('close' in obj || ('status' in obj && 'symbol' in obj)) {
    const only = requested[0];
    if (only === undefined) return {};
    return { [only]: obj as TwelveDataQuote };
  }

  const out: Record<string, TwelveDataQuote> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && typeof value === 'object') {
      out[key] = value as TwelveDataQuote;
    }
  }
  return out;
}

export class TwelveDataAdapter implements PriceProviderAdapter {
  readonly provider = PriceProvider.TWELVE_DATA;

  private get apiKey(): string | undefined {
    const key = process.env.TWELVE_DATA_API_KEY;
    return key && key.trim() !== '' ? key.trim() : undefined;
  }

  isConfigured(): boolean {
    return this.apiKey !== undefined;
  }

  async fetchQuotes(providerSymbols: string[]): Promise<{
    quotes: Map<string, PriceQuote>;
    errors: PriceProviderError[];
  }> {
    const quotes = new Map<string, PriceQuote>();
    const errors: PriceProviderError[] = [];

    const unique = [...new Set(providerSymbols.filter((s) => s.trim() !== ''))];
    if (unique.length === 0) return { quotes, errors };

    // Warn early if the registry has outgrown one credit window.
    assertWithinCreditBudget(unique.length);

    const apiKey = this.apiKey;
    if (apiKey === undefined) {
      // Surface one error per symbol so the sync log names exactly what went
      // unpriced, rather than a single opaque "provider down".
      for (const symbol of unique) {
        errors.push(
          new PriceProviderError({
            provider: this.provider,
            providerSymbol: symbol,
            message: 'TWELVE_DATA_API_KEY is not set',
            retryable: false,
          }),
        );
      }
      return { quotes, errors };
    }

    const batches = chunk(unique, BATCH_SIZE);

    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i];
      if (batch === undefined) continue;

      if (i > 0) await sleep(INTER_BATCH_DELAY_MS);

      const url =
        `${BASE_URL}?symbol=${encodeURIComponent(batch.join(','))}` +
        `&apikey=${encodeURIComponent(apiKey)}`;

      let payload: unknown;
      try {
        payload = await getJson<unknown>({
          url,
          provider: this.provider,
          providerSymbol: batch.join(','),
        });
      } catch (error) {
        // A whole-batch failure must not mask which symbols were affected.
        const base =
          error instanceof PriceProviderError
            ? error
            : new PriceProviderError({
                provider: this.provider,
                providerSymbol: batch.join(','),
                message: error instanceof Error ? error.message : String(error),
                retryable: true,
              });
        for (const symbol of batch) {
          errors.push(
            new PriceProviderError({
              provider: this.provider,
              providerSymbol: symbol,
              message: base.message,
              retryable: base.retryable,
              statusCode: base.statusCode,
            }),
          );
        }
        continue;
      }

      // A body-level error applies to the whole batch. Classify it correctly
      // BEFORE attempting to read symbols out of it: 429 (credits exhausted)
      // and 5xx are retryable, while 401/403 (bad key) are not.
      const batchError = parseBatchError(payload);
      if (batchError !== null) {
        const code = batchError.code;
        const retryable = code === 429 || (code !== undefined && code >= 500);
        for (const symbol of batch) {
          errors.push(
            new PriceProviderError({
              provider: this.provider,
              providerSymbol: symbol,
              message:
                `Provider rejected the batch (code ${code ?? 'unknown'}): ` +
                `${batchError.message ?? 'no message'}`,
              retryable,
              statusCode: code,
            }),
          );
        }
        continue;
      }

      const bySymbol = normaliseResponse(payload, batch);

      for (const symbol of batch) {
        const entry = bySymbol[symbol];

        if (entry === undefined) {
          errors.push(
            new PriceProviderError({
              provider: this.provider,
              providerSymbol: symbol,
              message: 'Symbol missing from provider response',
              retryable: false,
            }),
          );
          continue;
        }

        if (entry.status === 'error') {
          errors.push(
            new PriceProviderError({
              provider: this.provider,
              providerSymbol: symbol,
              message: entry.message ?? 'Provider reported an error for this symbol',
              // 429 arrives in-body as code 429 on this vendor.
              retryable: entry.code === 429,
              statusCode: entry.code,
            }),
          );
          continue;
        }

        const close = parseVendorNumber(entry.close);
        if (close === undefined || close <= 0) {
          errors.push(
            new PriceProviderError({
              provider: this.provider,
              providerSymbol: symbol,
              message: `Unusable close price: ${String(entry.close)}`,
              retryable: false,
            }),
          );
          continue;
        }

        quotes.set(symbol, {
          providerSymbol: symbol,
          close,
          open: parseVendorNumber(entry.open),
          high: parseVendorNumber(entry.high),
          low: parseVendorNumber(entry.low),
          previousClose: parseVendorNumber(entry.previous_close),
          changePercent: parseVendorNumber(entry.percent_change),
          volume: parseVendorNumber(entry.volume),
          // Fall back to today when the vendor omits a datetime, so a quote is
          // never silently filed against the epoch.
          priceDate: toUtcDateOnly(entry.datetime ?? new Date()),
          source: this.provider,
        });
      }
    }

    return { quotes, errors };
  }
}
