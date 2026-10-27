import { NextRequest, NextResponse } from 'next/server';
import { PriceProvider, VaultAssetRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';
import { fetchPricesForAssets } from '@/lib/vault/price-providers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Hard ceiling on the market board. */
export const MARKET_ASSET_LIMIT = 15;

/**
 * How long a live crypto quote is reused before it is fetched again.
 *
 * CoinGecko is keyless and free, but it is NOT unmetered: every member
 * watching the board would otherwise call it on their own polling interval
 * and trip the rate limit for everyone. One shared refresh every 30s keeps
 * the board moving while the vendor sees a single caller.
 */
const LIVE_TTL_MS = 30_000;

interface LiveQuote {
  price: number;
  changePercent: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  at: number;
}

/** Module-level, so it is shared by every request this instance serves. */
let liveCache: Map<string, LiveQuote> = new Map();
let liveFetchedAt = 0;
let inFlight: Promise<void> | null = null;

/**
 * The market board: what the assets we track are doing right now.
 *
 * Deliberately NOT tied to the member's allocation. This answers "what are
 * markets doing", not "what do I own" -- so every tracked asset appears
 * whether or not the member holds a penny of it, and adding an asset class in
 * admin does not change what is listed here.
 *
 * Freshness differs by provider, and the response says which is which rather
 * than implying everything is live:
 *
 *   CRYPTO   CoinGecko, keyless and free, refreshed every 30s -> live
 *   EQUITY   Twelve Data free tier, 8 credits/min and 800/day, so intraday
 *            polling is impossible. These are the latest stored close.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const assets = await prisma.vaultAsset.findMany({
      where: { isActive: true, role: { not: VaultAssetRole.BENCHMARK } },
      orderBy: [{ displayOrder: 'asc' }, { symbol: 'asc' }],
      take: MARKET_ASSET_LIMIT,
      select: {
        id: true, symbol: true, name: true, assetClass: true,
        provider: true, providerSymbol: true,
        fallbackProvider: true, fallbackSymbol: true,
        currentPrice: true, previousClose: true, priceChange24h: true,
        lastSyncedAt: true,
      },
    });

    // Open/high/low/volume live on the snapshot, not on the denormalised
    // asset row, so the board would otherwise show a column of dashes for
    // every equity. One query, latest row per asset.
    const snapshots = assets.length === 0 ? [] : await prisma.assetPriceSnapshot.findMany({
      where: { assetId: { in: assets.map((a) => a.id) } },
      orderBy: [{ assetId: 'asc' }, { priceDate: 'desc' }],
      distinct: ['assetId'],
      select: { assetId: true, open: true, high: true, low: true, volume: true, priceDate: true },
    });
    const latest = new Map(snapshots.map((s) => [s.assetId, s]));

    await refreshLiveQuotes(assets);

    const rows = assets.map((a) => {
      const live = liveCache.get(a.id);
      const snap = latest.get(a.id);
      const price = live?.price ?? a.currentPrice;
      // A stored change of exactly 0 is far more often "never computed" than
      // "unchanged", and showing a confident 0.00% would be a lie.
      const stored = a.priceChange24h !== 0 ? a.priceChange24h : null;
      return {
        symbol: a.symbol,
        name: a.name,
        assetClass: a.assetClass,
        price,
        performance: live?.changePercent ?? stored,
        high: live?.high ?? snap?.high ?? null,
        low: live?.low ?? snap?.low ?? null,
        open: snap?.open ?? null,
        volume: live?.volume ?? snap?.volume ?? null,
        previousClose: a.previousClose > 0 ? a.previousClose : null,
        live: live !== undefined,
        asOf: live !== undefined ? new Date(live.at) : a.lastSyncedAt,
      };
    });

    return NextResponse.json({
      success: true,
      assets: rows,
      limit: MARKET_ASSET_LIMIT,
      refreshSeconds: LIVE_TTL_MS / 1000,
    });
  } catch (error) {
    console.error('[Vault Market] error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load market data.' },
      { status: 500 },
    );
  }
}

type FeedAsset = {
  id: string; symbol: string;
  provider: PriceProvider; providerSymbol: string;
  fallbackProvider: PriceProvider | null; fallbackSymbol: string | null;
};

/**
 * Refresh the coins, at most once per TTL across all callers.
 *
 * Only CoinGecko assets are refreshed. Calling Twelve Data here would spend
 * the daily credit budget on page views and starve the nightly sync that the
 * vault's actual valuations depend on -- a board that looks livelier is not
 * worth stale portfolio maths.
 *
 * A failure is swallowed: the board falls back to stored closes rather than
 * failing the whole response, because a market board is informational and
 * must never be the reason a member cannot see their vault.
 */
async function refreshLiveQuotes(assets: FeedAsset[]): Promise<void> {
  if (Date.now() - liveFetchedAt < LIVE_TTL_MS) return;

  // Collapse concurrent callers onto one in-flight fetch.
  if (inFlight !== null) {
    await inFlight;
    return;
  }

  const liveAssets = assets.filter((a) => a.provider === PriceProvider.COINGECKO);
  if (liveAssets.length === 0) {
    liveFetchedAt = Date.now();
    return;
  }

  inFlight = (async () => {
    try {
      const { quotes } = await fetchPricesForAssets(
        liveAssets.map((a) => ({
          assetId: a.id,
          symbol: a.symbol,
          provider: a.provider,
          providerSymbol: a.providerSymbol,
          fallbackProvider: a.fallbackProvider,
          fallbackSymbol: a.fallbackSymbol,
        })),
      );

      const next = new Map<string, LiveQuote>();
      const at = Date.now();
      for (const [assetId, q] of quotes) {
        next.set(assetId, {
          price: q.close,
          changePercent: q.changePercent ?? null,
          high: q.high ?? null,
          low: q.low ?? null,
          volume: q.volume ?? null,
          at,
        });
      }
      // Only replace on a result. An empty fetch keeps the previous quotes
      // rather than blanking the board.
      if (next.size > 0) liveCache = next;
    } catch (error) {
      console.error('[Vault Market] live refresh failed:', error);
    } finally {
      liveFetchedAt = Date.now();
      inFlight = null;
    }
  })();

  await inFlight;
}
