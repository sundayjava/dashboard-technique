import { PriceProvider } from '@prisma/client';
import { getJson } from './http';
import {
  PriceProviderAdapter,
  PriceProviderError,
  PriceQuote,
  parseVendorNumber,
  toUtcDateOnly,
} from './types';

const BASE_URL = 'https://api.coingecko.com/api/v3/coins/markets';

/**
 * CoinGecko — crypto primary feed.
 *
 * Needs no API key and batches every coin into one request, which is why it
 * already backs the production crypto converter. Provider symbols are
 * CoinGecko slugs ("bitcoin", "ethereum", "ripple"), stored per asset in
 * VaultAsset.providerSymbol rather than hardcoded here.
 *
 * Uses /coins/markets rather than /simple/price. Both are keyless, free and
 * batched, and both return the same spot price -- but /simple/price carries
 * no OHLC whatsoever, so every coin showed an empty 24h high and low. This
 * endpoint returns high_24h, low_24h and the prior close outright, which
 * means they no longer have to be derived from the change percentage.
 */
export class CoinGeckoAdapter implements PriceProviderAdapter {
  readonly provider = PriceProvider.COINGECKO;

  isConfigured(): boolean {
    return true; // Keyless public endpoint
  }

  async fetchQuotes(providerSymbols: string[]): Promise<{
    quotes: Map<string, PriceQuote>;
    errors: PriceProviderError[];
  }> {
    const quotes = new Map<string, PriceQuote>();
    const errors: PriceProviderError[] = [];

    const ids = [...new Set(providerSymbols.filter((s) => s.trim() !== ''))];
    if (ids.length === 0) return { quotes, errors };

    const url =
      `${BASE_URL}?vs_currency=usd&ids=${encodeURIComponent(ids.join(','))}` +
      `&per_page=${ids.length}&page=1&sparkline=false&price_change_percentage=24h` +
      // Without this the vendor rounds low-priced coins to 2dp, so XRP sat at
      // $1.29 through every refresh and looked frozen beside BTC and ETH.
      `&precision=6`;

    let rows: Array<Record<string, unknown>>;
    try {
      rows = await getJson<Array<Record<string, unknown>>>({
        url,
        provider: this.provider,
        providerSymbol: ids.join(','),
      });
    } catch (error) {
      const base =
        error instanceof PriceProviderError
          ? error
          : new PriceProviderError({
              provider: this.provider,
              providerSymbol: ids.join(','),
              message: error instanceof Error ? error.message : String(error),
              retryable: true,
            });
      for (const id of ids) {
        errors.push(
          new PriceProviderError({
            provider: this.provider,
            providerSymbol: id,
            message: base.message,
            retryable: base.retryable,
            statusCode: base.statusCode,
          }),
        );
      }
      return { quotes, errors };
    }

    const priceDate = toUtcDateOnly(new Date());

    // The endpoint answers with an array, in its own order, so index it by
    // the coin id we asked for rather than trusting position.
    const payload = new Map<string, Record<string, unknown>>();
    for (const row of Array.isArray(rows) ? rows : []) {
      const id = typeof row['id'] === 'string' ? row['id'] : undefined;
      if (id !== undefined) payload.set(id, row);
    }

    for (const id of ids) {
      const entry = payload.get(id);

      if (entry === undefined) {
        errors.push(
          new PriceProviderError({
            provider: this.provider,
            providerSymbol: id,
            message: 'Coin id not present in response — check the CoinGecko slug',
            retryable: false,
          }),
        );
        continue;
      }

      const close = parseVendorNumber(entry['current_price']);
      if (close === undefined || close <= 0) {
        errors.push(
          new PriceProviderError({
            provider: this.provider,
            providerSymbol: id,
            message: `Unusable USD price: ${String(entry['current_price'])}`,
            retryable: false,
          }),
        );
        continue;
      }

      const changePercent = parseVendorNumber(entry['price_change_percentage_24h']);

      // The vendor gives the 24h move outright; fall back to deriving the
      // prior close from the percentage only when it does not.
      const change24h = parseVendorNumber(entry['price_change_24h']);
      const previousClose =
        change24h !== undefined
          ? close - change24h
          : changePercent !== undefined && changePercent !== -100
            ? close / (1 + changePercent / 100)
            : undefined;

      quotes.set(id, {
        providerSymbol: id,
        close,
        high: parseVendorNumber(entry['high_24h']),
        low: parseVendorNumber(entry['low_24h']),
        previousClose,
        changePercent,
        volume: parseVendorNumber(entry['total_volume']),
        priceDate,
        source: this.provider,
      });
    }

    return { quotes, errors };
  }
}
