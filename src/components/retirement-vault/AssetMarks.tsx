'use client';

import {
  Bitcoin,
  Building2,
  CandlestickChart,
  Coins,
  Gem,
  Globe,
  Landmark,
  LineChart,
  Shapes,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

/**
 * The real mark for each asset, instead of its first few letters.
 *
 * Truncating a name to make an avatar produced things like "GLO", "FIX" and
 * "REA" in the allocation table, which name nothing. Every asset here gets
 * either its own brand mark or a glyph that says what it is.
 *
 * Two kinds of mark, because the vault holds two kinds of thing:
 *
 *   CRYPTO      BTC, ETH and XRP have genuine, recognisable brand marks, so
 *               they get those, drawn inline as SVG. No network request, no
 *               CDN, nothing to fail offline or on a cold cache.
 *   FUNDS       VT, BND, GLD and the rest are ETFs with no logo anyone would
 *               recognise. Their ticker already appears as text beside the
 *               icon, so the icon says what the asset IS -- a globe for total
 *               world stock, a gem for gold, a building for REITs.
 *
 * An asset class an admin adds later has no mapping and falls back to a
 * generic glyph, never to letters.
 */

type MarkComponent = ComponentType<SVGProps<SVGSVGElement>> | LucideIcon;

/** Ethereum's diamond: two stacked facets. */
function EthereumMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 1.8 5.2 12.1 12 15.8l6.8-3.7L12 1.8Z" opacity={0.95} />
      <path d="M12 17.3 5.2 13.6 12 22.2l6.8-8.6L12 17.3Z" opacity={0.65} />
    </svg>
  );
}

/** XRP's mark: four arms crossing at the centre. */
function XrpMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}
      strokeLinecap="round" {...props}>
      <path d="M4.5 4.5 19.5 19.5" />
      <path d="M19.5 4.5 4.5 19.5" />
    </svg>
  );
}

/** Brand colour per coin. A coin is known by its colour as much as its shape. */
const CRYPTO_MARKS: Record<string, { Mark: MarkComponent; color: string }> = {
  BTC: { Mark: Bitcoin, color: '#f7931a' },
  ETH: { Mark: EthereumMark, color: '#627eea' },
  XRP: { Mark: XrpMark, color: '#23292f' },
};

/** Per-fund glyphs, so two funds in one class still read apart. */
const SYMBOL_MARKS: Record<string, MarkComponent> = {
  VT: Globe,            // Vanguard Total World Stock
  BND: Landmark,        // Vanguard Total Bond Market
  GLD: Gem,             // SPDR Gold Shares
  SLV: Coins,           // iShares Silver Trust
  VNQ: Building2,       // Vanguard Real Estate
  DBC: CandlestickChart,// Invesco DB Commodity Index
  SPY: LineChart,       // SPDR S&P 500, the benchmark leg
};

/** Fallback by class, which also covers class-level rows with no ticker. */
const CLASS_MARKS: Record<string, MarkComponent> = {
  GLOBAL_EQUITIES: Globe,
  FIXED_INCOME: Landmark,
  COMMODITIES: Gem,
  REAL_ESTATE: Building2,
  FUTURES_MACRO: CandlestickChart,
  CRYPTO: Bitcoin,
};

/**
 * Resolve the mark for an asset.
 *
 * `brandColor` is set only for a coin. Everything else returns null and keeps
 * its class colour, so a class reads the same colour in its icon, its row and
 * its doughnut slice -- colour stays identity. A coin row is per-asset rather
 * than per-class, where its own brand colour tells BTC from ETH at a glance.
 */
export function resolveAssetMark(
  symbol: string | undefined,
  assetClass: string,
): { Mark: MarkComponent; brandColor: string | null } {
  const ticker = symbol?.toUpperCase();

  if (ticker !== undefined && ticker in CRYPTO_MARKS) {
    const { Mark, color } = CRYPTO_MARKS[ticker];
    return { Mark, brandColor: color };
  }

  if (ticker !== undefined && ticker in SYMBOL_MARKS) {
    return { Mark: SYMBOL_MARKS[ticker], brandColor: null };
  }

  return { Mark: CLASS_MARKS[assetClass] ?? Shapes, brandColor: null };
}
