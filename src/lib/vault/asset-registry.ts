import { VaultAssetClass } from './asset-classes';
import { PriceProvider, VaultAssetRole } from '@prisma/client';

/**
 * The canonical Retirement Vault instrument universe.
 *
 * This is the single source of truth for which instruments exist, which feed
 * prices them, and how each asset class is split across its instruments. The
 * seed script writes these rows; the sync engine validates against them.
 *
 * Two hard constraints govern this list, both measured against the live free
 * tiers rather than assumed:
 *
 *  1. At most 8 TWELVE_DATA symbols. That vendor charges one credit per symbol
 *     with an 8-credit/minute ceiling, so the whole universe must price in a
 *     single request — a second batch would have to wait a full minute and
 *     would outlive the Vercel function. Currently 7, leaving one credit spare.
 *
 *  2. Crypto never exceeds 5% of a vault. That cap is enforced at allocation
 *     time, not here; this file only decides how the 5% divides across coins.
 */

export interface VaultAssetDefinition {
  symbol: string;
  name: string;
  assetClass: VaultAssetClass;
  role: VaultAssetRole;
  provider: PriceProvider;
  providerSymbol: string;
  fallbackProvider: PriceProvider | null;
  fallbackSymbol: string | null;
  /** Share of this asset's own class sleeve. Must total 1 per class. */
  sleeveWeight: number;
  displayOrder: number;
  /** Why this instrument represents its asset class. */
  rationale: string;
}

export const VAULT_ASSETS: VaultAssetDefinition[] = [
  // ---------------------------------------------------------------- equities
  {
    symbol: 'VT',
    name: 'Vanguard Total World Stock ETF',
    assetClass: VaultAssetClass.GLOBAL_EQUITIES,
    role: VaultAssetRole.PORTFOLIO,
    provider: PriceProvider.TWELVE_DATA,
    providerSymbol: 'VT',
    fallbackProvider: null,
    fallbackSymbol: null,
    sleeveWeight: 1,
    displayOrder: 10,
    rationale:
      'Single-ticker global equity exposure (US + developed + emerging), which is ' +
      'genuinely "Global Equities" rather than a US index wearing the label.',
  },

  // ------------------------------------------------------------ fixed income
  {
    symbol: 'BND',
    name: 'Vanguard Total Bond Market ETF',
    assetClass: VaultAssetClass.FIXED_INCOME,
    // BOTH: serves as the portfolio's bond holding AND the 40% bond leg of the
    // traditional-401k benchmark. Fetching it once instead of twice is what
    // keeps the universe at 7 symbols inside the 8-credit window.
    role: VaultAssetRole.BOTH,
    provider: PriceProvider.TWELVE_DATA,
    providerSymbol: 'BND',
    fallbackProvider: null,
    fallbackSymbol: null,
    sleeveWeight: 1,
    displayOrder: 20,
    rationale:
      'Broad investment-grade US bond exposure; the standard fixed-income leg ' +
      'in both our portfolio and the 60/40 benchmark.',
  },

  // ------------------------------------------------------------- commodities
  {
    symbol: 'GLD',
    name: 'SPDR Gold Shares',
    assetClass: VaultAssetClass.COMMODITIES,
    role: VaultAssetRole.PORTFOLIO,
    provider: PriceProvider.TWELVE_DATA,
    providerSymbol: 'GLD',
    fallbackProvider: null,
    fallbackSymbol: null,
    sleeveWeight: 0.6,
    displayOrder: 30,
    rationale:
      'Gold is the larger share of the commodities sleeve: it is the inflation ' +
      'hedge the Expert Allocator reasons about, and far less volatile than silver.',
  },
  {
    symbol: 'SLV',
    name: 'iShares Silver Trust',
    assetClass: VaultAssetClass.COMMODITIES,
    role: VaultAssetRole.PORTFOLIO,
    provider: PriceProvider.TWELVE_DATA,
    providerSymbol: 'SLV',
    fallbackProvider: null,
    fallbackSymbol: null,
    sleeveWeight: 0.4,
    displayOrder: 31,
    rationale: 'Silver completes the precious-metals pairing named in the product spec.',
  },

  // ------------------------------------------------------------- real estate
  {
    symbol: 'VNQ',
    name: 'Vanguard Real Estate ETF',
    assetClass: VaultAssetClass.REAL_ESTATE,
    role: VaultAssetRole.PORTFOLIO,
    provider: PriceProvider.TWELVE_DATA,
    providerSymbol: 'VNQ',
    fallbackProvider: null,
    fallbackSymbol: null,
    sleeveWeight: 1,
    displayOrder: 40,
    rationale:
      'Liquid REIT exposure — the practical way to hold real estate in a vault ' +
      'that must be priced daily and redeemed on notice.',
  },

  // ----------------------------------------------------------- futures/macro
  {
    symbol: 'DBC',
    name: 'Invesco DB Commodity Index Tracking Fund',
    assetClass: VaultAssetClass.FUTURES_MACRO,
    role: VaultAssetRole.PORTFOLIO,
    provider: PriceProvider.TWELVE_DATA,
    providerSymbol: 'DBC',
    fallbackProvider: null,
    fallbackSymbol: null,
    sleeveWeight: 1,
    displayOrder: 50,
    rationale:
      'A futures-based broad commodity index — the closest liquid, daily-priced ' +
      'proxy for the "Futures / Macro" sleeve. Flagged as a proxy, not true ' +
      'managed-futures exposure; revisit if that sleeve becomes a selling point.',
  },

  // ------------------------------------------------------------------ crypto
  // Owner-specified: BTC, ETH and XRP only. These weights divide the 5% cap,
  // they do not set it — 0.50/0.30/0.20 of 5% is 2.5%/1.5%/1.0% of the vault.
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    assetClass: VaultAssetClass.CRYPTO,
    role: VaultAssetRole.PORTFOLIO,
    provider: PriceProvider.COINGECKO,
    providerSymbol: 'bitcoin',
    fallbackProvider: PriceProvider.BINANCE,
    fallbackSymbol: 'BTCUSDT',
    sleeveWeight: 0.5,
    displayOrder: 60,
    rationale: 'Largest, most liquid crypto asset; majority of the sleeve.',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    assetClass: VaultAssetClass.CRYPTO,
    role: VaultAssetRole.PORTFOLIO,
    provider: PriceProvider.COINGECKO,
    providerSymbol: 'ethereum',
    fallbackProvider: PriceProvider.BINANCE,
    fallbackSymbol: 'ETHUSDT',
    sleeveWeight: 0.3,
    displayOrder: 61,
    rationale: 'Second-largest crypto asset by market capitalisation and liquidity.',
  },
  {
    symbol: 'XRP',
    name: 'XRP',
    assetClass: VaultAssetClass.CRYPTO,
    role: VaultAssetRole.PORTFOLIO,
    provider: PriceProvider.COINGECKO,
    providerSymbol: 'ripple',
    fallbackProvider: PriceProvider.BINANCE,
    fallbackSymbol: 'XRPUSDT',
    sleeveWeight: 0.2,
    displayOrder: 62,
    rationale: 'Owner-specified third holding; smallest share of the sleeve.',
  },

  // --------------------------------------------------------------- benchmark
  {
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    assetClass: VaultAssetClass.GLOBAL_EQUITIES,
    // BENCHMARK only — never held in a member vault. It exists solely to build
    // the "vs traditional 401k" comparison line.
    role: VaultAssetRole.BENCHMARK,
    provider: PriceProvider.TWELVE_DATA,
    providerSymbol: 'SPY',
    fallbackProvider: null,
    fallbackSymbol: null,
    sleeveWeight: 1,
    displayOrder: 90,
    rationale:
      'The S&P-equivalent leg of the traditional 401k benchmark the product ' +
      'measures itself against.',
  },
];

/**
 * The traditional-401k benchmark: a classic 60/40 stock-bond blend, which is
 * the fair comparator for a retirement product and the shape most target-date
 * funds converge toward.
 *
 * Expressed as symbols so the benchmark is computed from the same snapshot
 * history as everything else — there is no separate benchmark data path that
 * could drift out of sync.
 */
export const BENCHMARK_BLEND: ReadonlyArray<{ symbol: string; weight: number }> = [
  { symbol: 'SPY', weight: 0.6 },
  { symbol: 'BND', weight: 0.4 },
];

/** Crypto may never exceed this share of a vault, in any mode. */
export const CRYPTO_HARD_CAP = 0.05;

/** Twelve Data free tier: credits per minute, and therefore symbols per sync. */
export const TWELVE_DATA_CREDIT_CEILING = 8;

export interface RegistryValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate the registry's internal consistency.
 *
 * Run by the seed before writing and by the sync before fetching, so a bad
 * edit to this file fails immediately and loudly rather than silently skewing
 * every allocation that depends on it.
 */
export function validateRegistry(
  assets: VaultAssetDefinition[] = VAULT_ASSETS,
): RegistryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Symbols must be unique — VaultAsset.symbol is a unique column.
  const seen = new Set<string>();
  for (const asset of assets) {
    if (seen.has(asset.symbol)) errors.push(`Duplicate symbol: ${asset.symbol}`);
    seen.add(asset.symbol);
  }

  // Sleeve weights must total 1 per asset class, counting only assets actually
  // held in vaults. A benchmark-only instrument shares an asset class with
  // portfolio holdings (SPY and VT are both equities) but must not dilute it.
  const sleeves = new Map<VaultAssetClass, number>();
  for (const asset of assets) {
    if (asset.role === VaultAssetRole.BENCHMARK) continue;
    sleeves.set(asset.assetClass, (sleeves.get(asset.assetClass) ?? 0) + asset.sleeveWeight);
  }
  for (const [assetClass, total] of sleeves) {
    // Tolerance absorbs float representation, not genuine mistakes.
    if (Math.abs(total - 1) > 1e-9) {
      errors.push(
        `Sleeve weights for ${assetClass} total ${total}, expected 1. ` +
          `Holdings in a class must divide it exactly.`,
      );
    }
  }

  // A benchmark blend that references a missing symbol would silently produce
  // a flat comparison line.
  for (const leg of BENCHMARK_BLEND) {
    if (!assets.some((a) => a.symbol === leg.symbol)) {
      errors.push(`Benchmark blend references unknown symbol: ${leg.symbol}`);
    }
  }
  const blendTotal = BENCHMARK_BLEND.reduce((sum, leg) => sum + leg.weight, 0);
  if (Math.abs(blendTotal - 1) > 1e-9) {
    errors.push(`Benchmark blend weights total ${blendTotal}, expected 1.`);
  }

  // The credit ceiling that decides whether a sync fits in one request.
  const twelveDataCount = assets.filter(
    (a) => a.provider === PriceProvider.TWELVE_DATA,
  ).length;
  if (twelveDataCount > TWELVE_DATA_CREDIT_CEILING) {
    errors.push(
      `${twelveDataCount} TWELVE_DATA symbols exceeds the ${TWELVE_DATA_CREDIT_CEILING}-credit ` +
        `per-minute free tier. The sync could not complete in one request.`,
    );
  } else if (twelveDataCount === TWELVE_DATA_CREDIT_CEILING) {
    warnings.push(
      `${twelveDataCount} TWELVE_DATA symbols uses the entire per-minute credit ` +
        `window, leaving no headroom for an on-demand refresh in the same minute.`,
    );
  }

  for (const asset of assets) {
    if (asset.sleeveWeight <= 0 || asset.sleeveWeight > 1) {
      errors.push(`${asset.symbol} has an out-of-range sleeveWeight: ${asset.sleeveWeight}`);
    }
    if (asset.fallbackProvider !== null && asset.fallbackSymbol === null) {
      errors.push(`${asset.symbol} names a fallback provider but no fallback symbol.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/** Assets actually held in member vaults (excludes benchmark-only instruments). */
export function getPortfolioAssets(
  assets: VaultAssetDefinition[] = VAULT_ASSETS,
): VaultAssetDefinition[] {
  return assets.filter((a) => a.role !== VaultAssetRole.BENCHMARK);
}
