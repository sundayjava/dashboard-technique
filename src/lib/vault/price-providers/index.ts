import { PriceProvider } from '@prisma/client';
import { BinanceAdapter } from './binance';
import { CoinGeckoAdapter } from './coingecko';
import { sleep } from './http';
import { TwelveDataAdapter } from './twelve-data';
import { PriceProviderAdapter, PriceProviderError, PriceQuote } from './types';

export * from './types';

/**
 * Pause before the single retry of a transient failure. Long enough for a
 * momentary network blip to clear, short enough to stay well inside the
 * cron function's 60s budget.
 */
const RETRY_DELAY_MS = 1500;

/**
 * The adapter registry.
 *
 * MANUAL has no adapter by design — admin-entered prices are written straight
 * to the asset row and must never be overwritten by a feed.
 */
const ADAPTERS: Partial<Record<PriceProvider, PriceProviderAdapter>> = {
  [PriceProvider.TWELVE_DATA]: new TwelveDataAdapter(),
  [PriceProvider.COINGECKO]: new CoinGeckoAdapter(),
  [PriceProvider.BINANCE]: new BinanceAdapter(),
};

export function getAdapter(provider: PriceProvider): PriceProviderAdapter | undefined {
  return ADAPTERS[provider];
}

/** Which providers are wired up and currently usable (API keys present). */
export function getConfiguredProviders(): PriceProvider[] {
  return (Object.keys(ADAPTERS) as PriceProvider[]).filter((p) => {
    const adapter = ADAPTERS[p];
    return adapter !== undefined && adapter.isConfigured();
  });
}

/** One asset's provider wiring, as the sync engine passes it in. */
export interface AssetFeedRequest {
  /** VaultAsset.id — the key results are returned under. */
  assetId: string;
  /** Display ticker, for error messages a human will read. */
  symbol: string;
  provider: PriceProvider;
  providerSymbol: string;
  fallbackProvider: PriceProvider | null;
  fallbackSymbol: string | null;
}

export interface FeedResolution {
  /** Keyed by assetId. */
  quotes: Map<string, PriceQuote>;
  /** Keyed by assetId — only assets that could not be priced at all. */
  failures: Map<string, PriceProviderError>;
}

/**
 * Price a set of assets, grouping by provider so each vendor is called once.
 *
 * Grouping is the point: pricing ten assets costs one request per provider,
 * not ten requests. Any asset its primary feed could not price is retried on
 * its configured fallback, and only then recorded as a failure — so the result
 * is the best available picture rather than all-or-nothing.
 */
export async function fetchPricesForAssets(
  requests: AssetFeedRequest[],
): Promise<FeedResolution> {
  const quotes = new Map<string, PriceQuote>();
  const failures = new Map<string, PriceProviderError>();

  if (requests.length === 0) return { quotes, failures };

  // Pass 1 — primary providers, one batched call each.
  const pending = await runPass(requests, quotes, (r) => ({
    provider: r.provider,
    providerSymbol: r.providerSymbol,
  }));

  // Pass 2 — fallbacks for whatever is still unpriced.
  const fallbackable = pending.filter(
    (p) => p.request.fallbackProvider !== null && p.request.fallbackSymbol !== null,
  );

  const stillPending = await runPass(
    fallbackable.map((p) => p.request),
    quotes,
    (r) => ({
      // Non-null by the filter above.
      provider: r.fallbackProvider as PriceProvider,
      providerSymbol: r.fallbackSymbol as string,
    }),
  );

  // Pass 3 — one retry on the PRIMARY feed for transient failures.
  //
  // This is what makes `retryable` mean something. It matters most for the
  // equity sleeve: those assets have no fallback, so without a retry a single
  // transient timeout leaves seven of ten assets unpriced until the next
  // nightly run — a whole day of stale valuations caused by one slow response.
  //
  // Deliberately excluded:
  //  - 429. The credit window is per-minute, so an immediate retry is certain
  //    to fail again and would spend credits confirming it.
  //  - permanent errors (bad symbol, missing key), which a retry cannot fix.
  const retryable = [...pending, ...stillPending].filter(
    (p) =>
      !quotes.has(p.request.assetId) &&
      p.error.retryable &&
      p.error.statusCode !== 429,
  );

  // De-duplicate: an asset may appear in both earlier passes.
  const retryRequests = [
    ...new Map(retryable.map((p) => [p.request.assetId, p.request])).values(),
  ];

  const afterRetry: PendingFailure[] = [];
  if (retryRequests.length > 0) {
    // A brief pause lets a momentary blip clear without stalling the run.
    await sleep(RETRY_DELAY_MS);
    const retryFailures = await runPass(retryRequests, quotes, (r) => ({
      provider: r.provider,
      providerSymbol: r.providerSymbol,
    }));
    afterRetry.push(...retryFailures);
  }

  // Record the most recent error for anything still unpriced. Later passes
  // overwrite earlier ones, so the reported cause is the last attempt made.
  for (const p of [...pending, ...stillPending, ...afterRetry]) {
    if (quotes.has(p.request.assetId)) continue;
    failures.set(p.request.assetId, p.error);
  }

  return { quotes, failures };
}

interface PendingFailure {
  request: AssetFeedRequest;
  error: PriceProviderError;
}

/**
 * Run one resolution pass, selecting each asset's provider via `select`.
 * Successful quotes are written into `quotes`; the unpriced are returned.
 */
async function runPass(
  requests: AssetFeedRequest[],
  quotes: Map<string, PriceQuote>,
  select: (r: AssetFeedRequest) => { provider: PriceProvider; providerSymbol: string },
): Promise<PendingFailure[]> {
  const pending: PendingFailure[] = [];
  if (requests.length === 0) return pending;

  // provider -> providerSymbol -> assetIds (a symbol may back several assets)
  const grouped = new Map<PriceProvider, Map<string, AssetFeedRequest[]>>();

  for (const request of requests) {
    const { provider, providerSymbol } = select(request);
    let byProvider = grouped.get(provider);
    if (byProvider === undefined) {
      byProvider = new Map<string, AssetFeedRequest[]>();
      grouped.set(provider, byProvider);
    }
    const existing = byProvider.get(providerSymbol);
    if (existing === undefined) {
      byProvider.set(providerSymbol, [request]);
    } else {
      existing.push(request);
    }
  }

  // Providers are independent, so call them concurrently. Batching happens
  // inside each adapter, which owns its own rate limit.
  const results = await Promise.all(
    [...grouped.entries()].map(async ([provider, bySymbol]) => {
      const symbols = [...bySymbol.keys()];
      const adapter = getAdapter(provider);

      if (adapter === undefined) {
        return {
          bySymbol,
          quotes: new Map<string, PriceQuote>(),
          errors: symbols.map(
            (symbol) =>
              new PriceProviderError({
                provider,
                providerSymbol: symbol,
                message: `No adapter registered for provider ${provider}`,
                retryable: false,
              }),
          ),
        };
      }

      try {
        const outcome = await adapter.fetchQuotes(symbols);
        return { bySymbol, quotes: outcome.quotes, errors: outcome.errors };
      } catch (error) {
        // An adapter throwing instead of reporting is a bug, but it must not
        // take down pricing for every other provider in the same sync.
        const message = error instanceof Error ? error.message : String(error);
        return {
          bySymbol,
          quotes: new Map<string, PriceQuote>(),
          errors: symbols.map(
            (symbol) =>
              new PriceProviderError({
                provider,
                providerSymbol: symbol,
                message: `Adapter threw: ${message}`,
                retryable: true,
              }),
          ),
        };
      }
    }),
  );

  for (const result of results) {
    const errorBySymbol = new Map<string, PriceProviderError>();
    for (const error of result.errors) {
      errorBySymbol.set(error.providerSymbol, error);
    }

    for (const [providerSymbol, assetRequests] of result.bySymbol.entries()) {
      const quote = result.quotes.get(providerSymbol);

      for (const request of assetRequests) {
        if (quote !== undefined) {
          quotes.set(request.assetId, quote);
          continue;
        }
        pending.push({
          request,
          error:
            errorBySymbol.get(providerSymbol) ??
            new PriceProviderError({
              provider: result.errors[0]?.provider ?? request.provider,
              providerSymbol,
              message: 'Provider returned neither a quote nor an error',
              retryable: true,
            }),
        });
      }
    }
  }

  return pending;
}
