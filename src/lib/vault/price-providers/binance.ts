import { PriceProvider } from '@prisma/client';
import { getJson } from './http';
import {
  PriceProviderAdapter,
  PriceProviderError,
  PriceQuote,
  parseVendorNumber,
  toUtcDateOnly,
} from './types';

const BASE_URL = 'https://api.binance.com/api/v3/ticker/24hr';

interface BinanceTicker {
  symbol?: string;
  lastPrice?: string;
  openPrice?: string;
  highPrice?: string;
  lowPrice?: string;
  prevClosePrice?: string;
  priceChangePercent?: string;
  volume?: string;
}

/**
 * Binance — crypto fallback, mirroring the existing production converter.
 *
 * Provider symbols are trading pairs ("BTCUSDT"). Unlike simple/price this
 * returns full OHLC, so a CoinGecko outage degrades the data slightly upward
 * rather than downward.
 */
export class BinanceAdapter implements PriceProviderAdapter {
  readonly provider = PriceProvider.BINANCE;

  isConfigured(): boolean {
    return true; // Keyless public endpoint
  }

  async fetchQuotes(providerSymbols: string[]): Promise<{
    quotes: Map<string, PriceQuote>;
    errors: PriceProviderError[];
  }> {
    const quotes = new Map<string, PriceQuote>();
    const errors: PriceProviderError[] = [];

    const pairs = [...new Set(providerSymbols.filter((s) => s.trim() !== ''))];
    if (pairs.length === 0) return { quotes, errors };

    // Batch form expects a JSON array literal in the query string.
    const url = `${BASE_URL}?symbols=${encodeURIComponent(JSON.stringify(pairs))}`;

    let payload: BinanceTicker[];
    try {
      payload = await getJson<BinanceTicker[]>({
        url,
        provider: this.provider,
        providerSymbol: pairs.join(','),
      });
    } catch (error) {
      const base =
        error instanceof PriceProviderError
          ? error
          : new PriceProviderError({
              provider: this.provider,
              providerSymbol: pairs.join(','),
              message: error instanceof Error ? error.message : String(error),
              retryable: true,
            });
      for (const pair of pairs) {
        errors.push(
          new PriceProviderError({
            provider: this.provider,
            providerSymbol: pair,
            message: base.message,
            retryable: base.retryable,
            statusCode: base.statusCode,
          }),
        );
      }
      return { quotes, errors };
    }

    if (!Array.isArray(payload)) {
      for (const pair of pairs) {
        errors.push(
          new PriceProviderError({
            provider: this.provider,
            providerSymbol: pair,
            message: 'Expected an array of tickers',
            retryable: true,
          }),
        );
      }
      return { quotes, errors };
    }

    const priceDate = toUtcDateOnly(new Date());
    const bySymbol = new Map<string, BinanceTicker>();
    for (const ticker of payload) {
      if (ticker.symbol !== undefined) bySymbol.set(ticker.symbol, ticker);
    }

    for (const pair of pairs) {
      const ticker = bySymbol.get(pair);

      if (ticker === undefined) {
        errors.push(
          new PriceProviderError({
            provider: this.provider,
            providerSymbol: pair,
            message: 'Trading pair missing from response',
            retryable: false,
          }),
        );
        continue;
      }

      const close = parseVendorNumber(ticker.lastPrice);
      if (close === undefined || close <= 0) {
        errors.push(
          new PriceProviderError({
            provider: this.provider,
            providerSymbol: pair,
            message: `Unusable last price: ${String(ticker.lastPrice)}`,
            retryable: false,
          }),
        );
        continue;
      }

      quotes.set(pair, {
        providerSymbol: pair,
        close,
        open: parseVendorNumber(ticker.openPrice),
        high: parseVendorNumber(ticker.highPrice),
        low: parseVendorNumber(ticker.lowPrice),
        previousClose: parseVendorNumber(ticker.prevClosePrice),
        changePercent: parseVendorNumber(ticker.priceChangePercent),
        volume: parseVendorNumber(ticker.volume),
        priceDate,
        source: this.provider,
      });
    }

    return { quotes, errors };
  }
}
