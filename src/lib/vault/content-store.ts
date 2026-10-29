import { prisma } from '@/lib/prisma';
import { DEFAULT_COPY, DEFAULT_COPY_MAP, resolveCopy } from './onboarding-copy';

/**
 * Admin overrides for onboarding copy.
 *
 * Only overrides are stored. Everything else falls back to the shipped string,
 * so a database that has never been written to still renders the full page —
 * and a read failure degrades to the shipped copy rather than a blank screen.
 */

const CACHE_TTL_MS = 30_000;
let cache: { overrides: Record<string, string>; expiresAt: number } | null = null;

export function invalidateContentCache(): void {
  cache = null;
}

/** Stored overrides only, keyed by copy key. */
export async function loadContentOverrides(): Promise<Record<string, string>> {
  if (cache !== null && cache.expiresAt > Date.now()) return cache.overrides;

  let rows: Array<{ key: string; value: string }> = [];
  try {
    rows = await prisma.vaultContentString.findMany({ select: { key: true, value: true } });
  } catch (error) {
    console.warn(
      `[Vault Content] Could not read overrides (${
        error instanceof Error ? error.message : 'unknown'
      }); using shipped copy.`,
    );
    return {};
  }

  const overrides: Record<string, string> = {};
  for (const row of rows) {
    // Keys no longer in the registry are ignored rather than served: the page
    // would not read them anyway, and surfacing them would imply they matter.
    if (!(row.key in DEFAULT_COPY_MAP)) continue;
    if (row.value.trim() === '') continue;
    overrides[row.key] = row.value;
  }

  cache = { overrides, expiresAt: Date.now() + CACHE_TTL_MS };
  return overrides;
}

/**
 * The full copy map the page renders from: defaults with overrides applied.
 */
export async function loadCopy(): Promise<Record<string, string>> {
  const overrides = await loadContentOverrides();
  const merged: Record<string, string> = { ...DEFAULT_COPY_MAP };
  for (const [key, value] of Object.entries(overrides)) merged[key] = value;
  return merged;
}

export interface ContentUpdateResult {
  ok: boolean;
  errors: string[];
  updated: number;
}

/** Longest a single string may be. Generous, but not a whole document. */
const MAX_LENGTH = 2000;

/**
 * Apply admin edits.
 *
 * An entry whose value matches the shipped default, or is blank, is DELETED
 * rather than stored. That keeps the table to genuine overrides, and means
 * "reset to default" is just clearing the field.
 */
export async function updateContent(
  entries: Array<{ key: string; value: string }>,
  updatedBy: string,
): Promise<ContentUpdateResult> {
  const errors: string[] = [];
  const valid: Array<{ key: string; value: string }> = [];

  for (const entry of entries) {
    if (!(entry.key in DEFAULT_COPY_MAP)) {
      errors.push(`Unknown copy key: ${entry.key}`);
      continue;
    }
    if (typeof entry.value !== 'string') {
      errors.push(`${entry.key} must be text.`);
      continue;
    }
    if (entry.value.length > MAX_LENGTH) {
      errors.push(`${entry.key} is longer than ${MAX_LENGTH} characters.`);
      continue;
    }
    valid.push({ key: entry.key, value: entry.value });
  }

  if (errors.length > 0) return { ok: false, errors, updated: 0 };

  let updated = 0;
  for (const entry of valid) {
    const trimmed = entry.value.trim();
    const isDefault = trimmed === DEFAULT_COPY_MAP[entry.key];

    if (trimmed === '' || isDefault) {
      await prisma.vaultContentString.deleteMany({ where: { key: entry.key } });
    } else {
      await prisma.vaultContentString.upsert({
        where: { key: entry.key },
        create: { key: entry.key, value: trimmed, updatedBy },
        update: { value: trimmed, updatedBy },
      });
    }
    updated += 1;
  }

  invalidateContentCache();
  return { ok: true, errors: [], updated };
}

/** The registry plus whatever each entry currently resolves to, for admin. */
export async function getContentForAdmin() {
  const overrides = await loadContentOverrides();
  return DEFAULT_COPY.map((entry) => ({
    ...entry,
    current: resolveCopy(overrides, entry.key),
    isOverridden: entry.key in overrides,
  }));
}
