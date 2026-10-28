import { PriceProvider, VaultAssetRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { BENCHMARK_BLEND } from './asset-registry';
import { isValidAssetClass } from './asset-class-store';
import { invalidatePriceCaches } from './valuation';

/**
 * Creating, editing and retiring the instruments a vault is priced from.
 *
 * Until now the only way to add one was editing scripts/seed_vault_assets.ts
 * and running it, so the market board was stuck at whatever shipped. The rules
 * here exist because an instrument is not a label: members hold units of it,
 * the price sync spends vendor credits on it, and the benchmark blend names
 * two of them by symbol.
 */

export interface AssetWriteResult {
  ok: boolean;
  errors: string[];
  /** Non-blocking notes, e.g. a sleeve that no longer totals 100%. */
  warnings: string[];
  id?: string;
}

const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.\-]{0,15}$/;

export interface AssetInput {
  symbol?: string;
  name?: string;
  assetClass?: string;
  role?: string;
  provider?: string;
  providerSymbol?: string;
  fallbackProvider?: string | null;
  fallbackSymbol?: string | null;
  sleeveWeight?: number;
  displayOrder?: number;
  isActive?: boolean;
}

function readProvider(value: unknown): PriceProvider | undefined {
  return typeof value === 'string' && value in PriceProvider
    ? (value as PriceProvider)
    : undefined;
}

function readRole(value: unknown): VaultAssetRole | undefined {
  return typeof value === 'string' && value in VaultAssetRole
    ? (value as VaultAssetRole)
    : undefined;
}

/**
 * Validate the fields common to create and update.
 *
 * `partial` is true on an update, where an absent field means "leave it" and
 * must not be reported as missing.
 */
async function validate(input: AssetInput, partial: boolean): Promise<string[]> {
  const errors: string[] = [];

  const symbol = input.symbol?.trim().toUpperCase();
  if (symbol !== undefined) {
    if (!SYMBOL_PATTERN.test(symbol)) {
      errors.push('Ticker must be 1–16 characters: capitals, digits, dot or hyphen.');
    }
  } else if (!partial) {
    errors.push('Give the instrument a ticker.');
  }

  const name = input.name?.trim();
  if (name !== undefined) {
    if (name.length < 2) errors.push('Give the instrument a name.');
  } else if (!partial) {
    errors.push('Give the instrument a name.');
  }

  if (input.assetClass !== undefined) {
    if (!(await isValidAssetClass(input.assetClass))) {
      errors.push('Unknown asset class.');
    }
  } else if (!partial) {
    errors.push('Choose an asset class.');
  }

  if (input.provider !== undefined && readProvider(input.provider) === undefined) {
    errors.push('Unknown price provider.');
  } else if (!partial && input.provider === undefined) {
    errors.push('Choose a price provider.');
  }

  if (input.role !== undefined && readRole(input.role) === undefined) {
    errors.push('Unknown role.');
  }

  const providerSymbol = input.providerSymbol?.trim();
  if (providerSymbol !== undefined) {
    if (providerSymbol.length < 1) errors.push("Give the vendor's identifier for this instrument.");
  } else if (!partial) {
    errors.push("Give the vendor's identifier for this instrument.");
  }

  // A fallback is only meaningful as a pair: a provider with no symbol would
  // be silently skipped at sync time, which looks like the fallback working.
  const fallbackProvider = input.fallbackProvider ?? undefined;
  const fallbackSymbol = input.fallbackSymbol?.trim() || undefined;
  if (fallbackProvider && readProvider(fallbackProvider) === undefined) {
    errors.push('Unknown fallback provider.');
  }
  if (fallbackProvider && !fallbackSymbol) {
    errors.push('A fallback provider needs a fallback symbol.');
  }
  if (!fallbackProvider && fallbackSymbol) {
    errors.push('A fallback symbol needs a fallback provider.');
  }

  if (input.sleeveWeight !== undefined) {
    const w = Number(input.sleeveWeight);
    if (!Number.isFinite(w) || w < 0 || w > 1) {
      errors.push('Sleeve weight must be between 0 and 1.');
    }
  }

  return errors;
}

/** Sleeve totals per class, so a drifted split is reported rather than hidden. */
async function sleeveWarnings(assetClass: string): Promise<string[]> {
  const sleeve = await prisma.vaultAsset.findMany({
    where: { assetClass, isActive: true, role: { not: VaultAssetRole.BENCHMARK } },
    select: { sleeveWeight: true },
  });
  if (sleeve.length === 0) return [];

  const total = sleeve.reduce((s, a) => s + a.sleeveWeight, 0);
  if (Math.abs(total - 1) < 1e-9) return [];

  return [
    `Sleeve weights for this class now total ${(total * 100).toFixed(1)}%, not 100%. ` +
      `Fix the split on Vault policy before the next rebalance.`,
  ];
}

export async function createAsset(input: AssetInput): Promise<AssetWriteResult> {
  const errors = await validate(input, false);
  if (errors.length > 0) return { ok: false, errors, warnings: [] };

  const symbol = input.symbol!.trim().toUpperCase();
  const clash = await prisma.vaultAsset.findUnique({ where: { symbol } });
  if (clash !== null) {
    return { ok: false, errors: [`An instrument with the ticker ${symbol} already exists.`], warnings: [] };
  }

  const last = await prisma.vaultAsset.findFirst({
    orderBy: { displayOrder: 'desc' },
    select: { displayOrder: true },
  });

  const created = await prisma.vaultAsset.create({
    data: {
      symbol,
      name: input.name!.trim(),
      assetClass: input.assetClass!,
      role: readRole(input.role) ?? VaultAssetRole.PORTFOLIO,
      provider: readProvider(input.provider)!,
      providerSymbol: input.providerSymbol!.trim(),
      fallbackProvider: readProvider(input.fallbackProvider) ?? null,
      fallbackSymbol: input.fallbackSymbol?.trim() || null,
      sleeveWeight: input.sleeveWeight ?? 0,
      displayOrder: input.displayOrder ?? (last?.displayOrder ?? 0) + 10,
      isActive: input.isActive ?? true,
    },
  });

  invalidatePriceCaches();
  return {
    ok: true,
    errors: [],
    // Starts at weight 0 unless told otherwise, so adding an instrument never
    // silently dilutes the ones a member already holds.
    warnings: await sleeveWarnings(input.assetClass!),
    id: created.id,
  };
}

export async function updateAsset(id: string, input: AssetInput): Promise<AssetWriteResult> {
  const existing = await prisma.vaultAsset.findUnique({ where: { id } });
  if (existing === null) return { ok: false, errors: ['Instrument not found.'], warnings: [] };

  const errors = await validate(input, true);

  const symbol = input.symbol?.trim().toUpperCase();
  if (symbol !== undefined && symbol !== existing.symbol) {
    const clash = await prisma.vaultAsset.findUnique({ where: { symbol } });
    if (clash !== null) errors.push(`An instrument with the ticker ${symbol} already exists.`);

    // The benchmark blend names its legs by symbol, so renaming one would
    // leave the 401k comparison flat with no error anywhere.
    if (BENCHMARK_BLEND.some((leg) => leg.symbol === existing.symbol)) {
      errors.push(
        `${existing.symbol} is a leg of the benchmark blend and cannot be renamed. ` +
          `Change the blend first.`,
      );
    }
  }

  if (input.isActive === false) {
    const blockers = await describeRetirementBlockers(id);
    errors.push(...blockers);
  }

  if (errors.length > 0) return { ok: false, errors, warnings: [] };

  const updated = await prisma.vaultAsset.update({
    where: { id },
    data: {
      ...(symbol !== undefined ? { symbol } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.assetClass !== undefined ? { assetClass: input.assetClass } : {}),
      ...(readRole(input.role) !== undefined ? { role: readRole(input.role)! } : {}),
      ...(readProvider(input.provider) !== undefined
        ? { provider: readProvider(input.provider)! }
        : {}),
      ...(input.providerSymbol !== undefined
        ? { providerSymbol: input.providerSymbol.trim() }
        : {}),
      ...(input.fallbackProvider !== undefined
        ? { fallbackProvider: readProvider(input.fallbackProvider) ?? null }
        : {}),
      ...(input.fallbackSymbol !== undefined
        ? { fallbackSymbol: input.fallbackSymbol?.trim() || null }
        : {}),
      ...(input.sleeveWeight !== undefined ? { sleeveWeight: Number(input.sleeveWeight) } : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  invalidatePriceCaches();
  return { ok: true, errors: [], warnings: await sleeveWarnings(updated.assetClass), id };
}

/**
 * Why an instrument cannot be retired or removed right now.
 *
 * Sentences rather than a boolean, so an admin is told what to fix instead of
 * being refused without explanation.
 */
export async function describeRetirementBlockers(id: string): Promise<string[]> {
  const asset = await prisma.vaultAsset.findUnique({
    where: { id },
    select: { symbol: true },
  });
  if (asset === null) return ['Instrument not found.'];

  const blockers: string[] = [];

  const held = await prisma.vaultHolding.count({ where: { assetId: id, units: { gt: 0 } } });
  if (held > 0) {
    blockers.push(
      `${held} member holding(s) are still in ${asset.symbol}. Members must exit it first.`,
    );
  }

  if (BENCHMARK_BLEND.some((leg) => leg.symbol === asset.symbol)) {
    blockers.push(
      `${asset.symbol} is a leg of the traditional-401k benchmark. Removing it would ` +
        `leave every member's comparison line flat.`,
    );
  }

  return blockers;
}

/**
 * Remove an instrument outright.
 *
 * Price history cascades with it. Refuses while anything still depends on it,
 * and retiring (isActive false) is the gentler option the UI offers first.
 */
export async function deleteAsset(id: string): Promise<AssetWriteResult> {
  const blockers = await describeRetirementBlockers(id);
  if (blockers.length > 0) return { ok: false, errors: blockers, warnings: [] };

  const asset = await prisma.vaultAsset.findUnique({
    where: { id },
    select: { assetClass: true },
  });
  if (asset === null) return { ok: false, errors: ['Instrument not found.'], warnings: [] };

  await prisma.vaultAsset.delete({ where: { id } });
  invalidatePriceCaches();

  return { ok: true, errors: [], warnings: await sleeveWarnings(asset.assetClass) };
}

export interface AssetRow {
  id: string;
  symbol: string;
  name: string;
  assetClass: string;
  role: VaultAssetRole;
  provider: PriceProvider;
  providerSymbol: string;
  fallbackProvider: PriceProvider | null;
  fallbackSymbol: string | null;
  sleeveWeight: number;
  displayOrder: number;
  isActive: boolean;
  currentPrice: number;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
  consecutiveFailures: number;
  /** Members currently holding it. */
  holdingCount: number;
  retirementBlockers: string[];
}

/** Everything the admin screen needs, including why a row cannot be removed. */
export async function listAssets(): Promise<{
  assets: AssetRow[];
  sleeveTotals: Record<string, number>;
}> {
  const [assets, holdings] = await Promise.all([
    prisma.vaultAsset.findMany({ orderBy: [{ assetClass: 'asc' }, { displayOrder: 'asc' }] }),
    prisma.vaultHolding.groupBy({
      by: ['assetId'],
      where: { units: { gt: 0 } },
      _count: { _all: true },
    }),
  ]);

  const heldByAsset = new Map(holdings.map((h) => [h.assetId, h._count._all]));
  const benchmarkSymbols = new Set(BENCHMARK_BLEND.map((leg) => leg.symbol));

  const sleeveTotals: Record<string, number> = {};
  for (const asset of assets) {
    if (!asset.isActive || asset.role === VaultAssetRole.BENCHMARK) continue;
    sleeveTotals[asset.assetClass] = (sleeveTotals[asset.assetClass] ?? 0) + asset.sleeveWeight;
  }

  return {
    sleeveTotals,
    assets: assets.map((asset) => {
      const held = heldByAsset.get(asset.id) ?? 0;
      const retirementBlockers: string[] = [];
      if (held > 0) {
        retirementBlockers.push(
          `${held} member holding(s) are still in ${asset.symbol}. Members must exit it first.`,
        );
      }
      if (benchmarkSymbols.has(asset.symbol)) {
        retirementBlockers.push(
          `${asset.symbol} is a leg of the traditional-401k benchmark.`,
        );
      }

      return {
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        assetClass: asset.assetClass,
        role: asset.role,
        provider: asset.provider,
        providerSymbol: asset.providerSymbol,
        fallbackProvider: asset.fallbackProvider,
        fallbackSymbol: asset.fallbackSymbol,
        sleeveWeight: asset.sleeveWeight,
        displayOrder: asset.displayOrder,
        isActive: asset.isActive,
        currentPrice: asset.currentPrice,
        lastSyncedAt: asset.lastSyncedAt,
        lastSyncError: asset.lastSyncError,
        consecutiveFailures: asset.consecutiveFailures,
        holdingCount: held,
        retirementBlockers,
      };
    }),
  };
}
