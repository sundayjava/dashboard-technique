import { PriceProvider } from '@prisma/client';
import { PriceProviderError, PROVIDER_TIMEOUT_MS } from './types';

/**
 * JSON GET with a hard timeout, shared by every adapter.
 *
 * Classifies failures into retryable (timeout, 429, 5xx, network) and
 * permanent (4xx other than 429) so the sync engine can decide whether a
 * second attempt is worth a request from the daily budget.
 */
export async function getJson<T>(params: {
  url: string;
  provider: PriceProvider;
  providerSymbol: string;
  timeoutMs?: number;
}): Promise<T> {
  const { url, provider, providerSymbol, timeoutMs = PROVIDER_TIMEOUT_MS } = params;

  let response: Response;
  try {
    response = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    // Timeouts and DNS/socket failures are transient by nature.
    const message = error instanceof Error ? error.message : String(error);
    throw new PriceProviderError({
      provider,
      providerSymbol,
      message: `Network failure: ${message}`,
      retryable: true,
    });
  }

  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new PriceProviderError({
      provider,
      providerSymbol,
      message: `HTTP ${response.status} ${response.statusText}`,
      retryable,
      statusCode: response.status,
    });
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new PriceProviderError({
      provider,
      providerSymbol,
      message: 'Response was not valid JSON',
      retryable: true,
    });
  }
}

/** Split a list into fixed-size chunks, for vendors that cap batch size. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error('chunk size must be >= 1');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
