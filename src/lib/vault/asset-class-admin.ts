import { RiskProfile } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { invalidateAssetClassCache } from './asset-class-store';
import { invalidatePolicyCache } from './policy-store';

/**
 * Creating, editing and removing asset classes.
 *
 * The rules here exist because an asset class is not just a label: assets are
 * priced into it, members hold money in it, and every profile's percentages
 * must still total 100 afterwards.
 */

export interface ClassWriteResult {
  ok: boolean;
  errors: string[];
  key?: string;
}

const KEY_PATTERN = /^[A-Z][A-Z0-9_]{2,39}$/;

/** Turn a display name into a stable key. */
export function slugifyClassKey(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

/**
 * Create a class.
 *
 * It starts at 0% in every profile rather than taking a share automatically.
 * Silently shrinking the other classes to make room would change every
 * member's intended allocation without anyone deciding to — the admin
 * redistributes deliberately afterwards.
 */
export async function createAssetClass(
  input: { key?: string; name?: string; description?: string | null },
  updatedBy: string,
): Promise<ClassWriteResult> {
  const errors: string[] = [];

  const name = (input.name ?? '').trim();
  if (name.length < 2) errors.push('Give the asset class a name.');

  const key = (input.key ?? slugifyClassKey(name)).trim();
  if (!KEY_PATTERN.test(key)) {
    errors.push(
      'The key must be 3–40 characters, uppercase letters, digits and underscores only.',
    );
  }

  if (errors.length > 0) return { ok: false, errors };

  const clash = await prisma.vaultAssetClassDef.findUnique({ where: { key } });
  if (clash !== null) {
    return { ok: false, errors: [`An asset class with the key "${key}" already exists.`] };
  }

  const last = await prisma.vaultAssetClassDef.findFirst({
    orderBy: { displayOrder: 'desc' },
    select: { displayOrder: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.vaultAssetClassDef.create({
      data: {
        key,
        name,
        description: input.description?.trim() || null,
        displayOrder: (last?.displayOrder ?? 0) + 10,
        isActive: true,
        isSystem: false,
        updatedBy,
      },
    });

    // Every profile needs a row, or the allocation matrix has a hole in it.
    await tx.vaultProfileAllocation.createMany({
      data: Object.values(RiskProfile).map((riskProfile) => ({
        riskProfile,
        assetClass: key,
        targetPercent: 0,
        updatedBy,
      })),
      skipDuplicates: true,
    });
  });

  invalidateAssetClassCache();
  invalidatePolicyCache();
  return { ok: true, errors: [], key };
}

/** Rename, redescribe or reorder a class. The key never changes. */
export async function updateAssetClass(
  key: string,
  input: { name?: string; description?: string | null; displayOrder?: number; isActive?: boolean },
  updatedBy: string,
): Promise<ClassWriteResult> {
  const existing = await prisma.vaultAssetClassDef.findUnique({ where: { key } });
  if (existing === null) return { ok: false, errors: ['Asset class not found.'] };

  if (input.name !== undefined && input.name.trim().length < 2) {
    return { ok: false, errors: ['Give the asset class a name.'] };
  }

  // Deactivating is as consequential as deleting for anyone holding it, so it
  // goes through the same safety check.
  if (input.isActive === false) {
    const blocked = await describeRemovalBlockers(key);
    if (blocked.length > 0) return { ok: false, errors: blocked };
  }

  await prisma.vaultAssetClassDef.update({
    where: { key },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy,
    },
  });

  invalidateAssetClassCache();
  invalidatePolicyCache();
  return { ok: true, errors: [], key };
}

/**
 * Why a class cannot be removed right now.
 *
 * Returned as sentences rather than a boolean so an admin is told what to fix
 * instead of being refused without explanation.
 */
export async function describeRemovalBlockers(key: string): Promise<string[]> {
  const blockers: string[] = [];

  const [assets, held, activeCount] = await Promise.all([
    prisma.vaultAsset.count({ where: { assetClass: key } }),
    prisma.vaultHolding.count({ where: { asset: { assetClass: key }, units: { gt: 0 } } }),
    prisma.vaultAssetClassDef.count({ where: { isActive: true } }),
  ]);

  if (held > 0) {
    blockers.push(
      `${held} member holding(s) still sit in this class. Members must exit it before it ` +
        `can be removed.`,
    );
  }

  if (assets > 0) {
    blockers.push(
      `${assets} instrument(s) are priced into this class. Move or deactivate them first.`,
    );
  }

  if (activeCount <= 1) {
    blockers.push('At least one asset class must remain, or no vault can be allocated.');
  }

  return blockers;
}

/**
 * Remove a class.
 *
 * Deletes only when nothing references it; otherwise refuses with the reason.
 * The profile allocations cascade with it, and every remaining profile is left
 * short of 100%, which the admin screen then asks them to fix — better than
 * silently redistributing on their behalf.
 */
export async function deleteAssetClass(key: string): Promise<ClassWriteResult> {
  const existing = await prisma.vaultAssetClassDef.findUnique({ where: { key } });
  if (existing === null) return { ok: false, errors: ['Asset class not found.'] };

  const blockers = await describeRemovalBlockers(key);
  if (blockers.length > 0) return { ok: false, errors: blockers };

  await prisma.$transaction([
    // Vault-level rows do not cascade, since they carry no relation.
    prisma.vaultAllocation.deleteMany({ where: { assetClass: key } }),
    prisma.vaultAssetClassDef.delete({ where: { key } }),
  ]);

  invalidateAssetClassCache();
  invalidatePolicyCache();
  return { ok: true, errors: [], key };
}

export interface ProfileMatrixRow {
  key: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  isSystem: boolean;
  /** Instruments priced into this class. */
  assetCount: number;
  /** Members currently holding it. */
  holdingCount: number;
  removalBlockers: string[];
  targets: Record<string, number>;
}

/** Everything the admin screen needs: classes, usage and the profile matrix. */
export async function getClassMatrix(): Promise<{
  profiles: string[];
  rows: ProfileMatrixRow[];
  totals: Record<string, number>;
}> {
  const [classes, allocations, assetCounts, holdingCounts] = await Promise.all([
    prisma.vaultAssetClassDef.findMany({ orderBy: { displayOrder: 'asc' } }),
    prisma.vaultProfileAllocation.findMany(),
    prisma.vaultAsset.groupBy({ by: ['assetClass'], _count: { _all: true } }),
    prisma.vaultHolding.groupBy({
      by: ['assetId'],
      where: { units: { gt: 0 } },
      _count: { _all: true },
    }),
  ]);

  // Holdings are counted per asset, so map them back to their class.
  const assetsById = await prisma.vaultAsset.findMany({
    select: { id: true, assetClass: true },
  });
  const classByAsset = new Map(assetsById.map((a) => [a.id, a.assetClass]));
  const holdingsByClass = new Map<string, number>();
  for (const h of holdingCounts) {
    const key = classByAsset.get(h.assetId);
    if (key === undefined) continue;
    holdingsByClass.set(key, (holdingsByClass.get(key) ?? 0) + h._count._all);
  }

  const profiles = Object.values(RiskProfile);
  const rows: ProfileMatrixRow[] = [];

  for (const c of classes) {
    const targets: Record<string, number> = {};
    for (const profile of profiles) {
      targets[profile] =
        allocations.find((a) => a.assetClass === c.key && a.riskProfile === profile)
          ?.targetPercent ?? 0;
    }

    rows.push({
      key: c.key,
      name: c.name,
      description: c.description,
      displayOrder: c.displayOrder,
      isActive: c.isActive,
      isSystem: c.isSystem,
      assetCount: assetCounts.find((a) => a.assetClass === c.key)?._count._all ?? 0,
      holdingCount: holdingsByClass.get(c.key) ?? 0,
      removalBlockers: await describeRemovalBlockers(c.key),
      targets,
    });
  }

  const totals: Record<string, number> = {};
  for (const profile of profiles) {
    totals[profile] = rows
      .filter((r) => r.isActive)
      .reduce((sum, r) => sum + (r.targets[profile] ?? 0), 0);
  }

  return { profiles, rows, totals };
}
