import { prisma } from '@/lib/prisma';
import { SYSTEM_CLASS_KEYS } from './asset-classes';

/**
 * Reads the admin-managed asset classes.
 *
 * Separate from asset-classes.ts so the pure rule modules can import the
 * keys without pulling a database client in behind them.
 */

export interface AssetClassDef {
  key: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  isSystem: boolean;
}

const CACHE_TTL_MS = 30_000;
let cache: { classes: AssetClassDef[]; expiresAt: number } | null = null;

export function invalidateAssetClassCache(): void {
  cache = null;
}

/**
 * The active classes, in display order.
 *
 * Falls back to the shipped six if the table cannot be read or is empty:
 * returning nothing would make every allocation total zero and quietly stop
 * members investing at all.
 */
export async function getAssetClasses(): Promise<AssetClassDef[]> {
  if (cache !== null && cache.expiresAt > Date.now()) return cache.classes;

  let rows: AssetClassDef[] = [];
  try {
    rows = await prisma.vaultAssetClassDef.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        key: true,
        name: true,
        description: true,
        displayOrder: true,
        isActive: true,
        isSystem: true,
      },
    });
  } catch (error) {
    console.warn(
      `[Asset Classes] Could not read classes (${
        error instanceof Error ? error.message : 'unknown'
      }); using the shipped set.`,
    );
    rows = [];
  }

  if (rows.length === 0) {
    rows = SYSTEM_CLASS_KEYS.map((key, i) => ({
      key,
      name: key.replace(/_/g, ' ').toLowerCase(),
      description: null,
      displayOrder: (i + 1) * 10,
      isActive: true,
      isSystem: true,
    }));
  }

  cache = { classes: rows, expiresAt: Date.now() + CACHE_TTL_MS };
  return rows;
}

/** Just the keys, in display order. */
export async function getAssetClassKeys(): Promise<string[]> {
  return (await getAssetClasses()).map((c) => c.key);
}

/** Whether a key names a class that currently exists and is active. */
export async function isValidAssetClass(key: unknown): Promise<boolean> {
  if (typeof key !== 'string' || key.trim() === '') return false;
  return (await getAssetClassKeys()).includes(key);
}

/** Display names keyed by class key, for building labels. */
export async function getAssetClassNames(): Promise<Record<string, string>> {
  return Object.fromEntries((await getAssetClasses()).map((c) => [c.key, c.name]));
}
