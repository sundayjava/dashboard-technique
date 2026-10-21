import { PriceProvider } from '@prisma/client';
import { getJson } from './http';
import {
  PriceProviderAdapter,
  PriceProviderError,
  PriceQuote,
  parseVendorNumber,
  toUtcDateOnly,
} from './types';

const BASE_URL = 'https://api.coingecko.com/api/v3/simple/price';

/**
 * CoinGecko — crypto primary feed.
 *
 * Needs no API key and batches every coin into one request, which is why it
 * already backs the production crypto converter. Provider symbols are
 * CoinGecko slugs ("bitcoin", "ethereum", "ripple"), stored per asset in
 * VaultAsset.providerSymbol rather than hardcoded here.
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
      `${BASE_URL}?ids=${encodeURIComponent(ids.join(','))}` +
      `&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`;

    let payload: Record<string, Record<string, unknown>>;
    try {
      payload = await getJson<Record<string, Record<string, unknown>>>({
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

    for (const id of ids) {
      const entry = payload[id];

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

      const close = parseVendorNumber(entry['usd']);
      if (close === undefined || close <= 0) {
        errors.push(
          new PriceProviderError({
            provider: this.provider,
            providerSymbol: id,
            message: `Unusable USD price: ${String(entry['usd'])}`,
            retryable: false,
          }),
        );
        continue;
      }

      const changePercent = parseVendorNumber(entry['usd_24h_change']);

      // simple/price carries no OHLC. Derive the prior close from the 24h
      // change so downstream gain/loss has a reference point; omit it rather
      // than guess when the change is missing or degenerate.
      const previousClose =
        changePercent !== undefined && changePercent !== -100
          ? close / (1 + changePercent / 100)
          : undefined;

      quotes.set(id, {
        providerSymbol: id,
        close,
        previousClose,
        changePercent,
        volume: parseVendorNumber(entry['usd_24h_vol']),
        priceDate,
        source: this.provider,
      });
    }

    return { quotes, errors };
  }
}
