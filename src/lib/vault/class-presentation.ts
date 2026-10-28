/**
 * How an asset class is named and coloured. NO DATABASE ACCESS.
 *
 * Asset classes are rows an admin can add to, but every screen has been
 * reading a hardcoded six-entry map, so a class created in admin showed up as
 * "PRIVATE_CREDIT" in grey and the name typed in admin never reached a member.
 *
 * The shipped six keep their established labels and hues -- members and
 * screenshots already know them, and the colours clear contrast against both
 * the light pages and the dark statement. Anything else is named by the admin
 * and coloured from a fixed palette, picked by a stable hash of the key so a
 * class keeps the same colour on every screen and across reloads.
 */

/** Labels for the shipped six. Admin-created classes use their stored name. */
export const DEFAULT_CLASS_LABELS: Record<string, string> = {
  GLOBAL_EQUITIES: 'Global Equities',
  FIXED_INCOME: 'Bonds / Fixed Income',
  COMMODITIES: 'Commodities',
  REAL_ESTATE: 'Real Estate / REITs',
  FUTURES_MACRO: 'Futures / Macro',
  CRYPTO: 'Crypto',
};

/** Hues for the shipped six, as used on the light screens. */
export const DEFAULT_CLASS_COLORS: Record<string, string> = {
  GLOBAL_EQUITIES: '#2a78d6',
  FIXED_INCOME: '#eb6834',
  COMMODITIES: '#1baf7a',
  REAL_ESTATE: '#eda100',
  FUTURES_MACRO: '#e87ba4',
  CRYPTO: '#008300',
};

/** The same six lifted for a dark panel, where the light set goes muddy. */
export const DARK_CLASS_COLORS: Record<string, string> = {
  GLOBAL_EQUITIES: '#4d9bff',
  FIXED_INCOME: '#ff8a5c',
  COMMODITIES: '#2dd4a7',
  REAL_ESTATE: '#f5b73d',
  FUTURES_MACRO: '#f08bb4',
  CRYPTO: '#3ec46d',
};

/**
 * Hues for classes the product did not ship with.
 *
 * Deliberately distinct from the six above so a new class never reads as an
 * existing one, and chosen to clear 3:1 on white as well as on the dark
 * statement -- a class should not be legible on one page and invisible on
 * another.
 */
const EXTRA_LIGHT_PALETTE = [
  '#7c5cd6', '#0f9bb5', '#b5562f', '#5c8a2f', '#c43b6e', '#2f6fb5',
];
const EXTRA_DARK_PALETTE = [
  '#a98bff', '#38c7e0', '#f08a5c', '#90c75a', '#f4699a', '#6aa6f0',
];

/**
 * Stable index for a key.
 *
 * A hash rather than the array position, so adding or removing a class never
 * reshuffles the colours of the others -- a member would otherwise open the
 * app and find their commodities sleeve had turned purple overnight.
 */
function paletteIndex(key: string, size: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % size;
}

/** A class's display name: the admin's, else the shipped label, else the key. */
export function classLabel(key: string, names?: Record<string, string>): string {
  const stored = names?.[key]?.trim();
  if (stored) return stored;
  return DEFAULT_CLASS_LABELS[key] ?? humanise(key);
}

/** A class's colour on the light screens. */
export function classColor(key: string): string {
  return (
    DEFAULT_CLASS_COLORS[key] ??
    EXTRA_LIGHT_PALETTE[paletteIndex(key, EXTRA_LIGHT_PALETTE.length)]!
  );
}

/** A class's colour on the dark statement. */
export function classColorDark(key: string): string {
  return (
    DARK_CLASS_COLORS[key] ??
    EXTRA_DARK_PALETTE[paletteIndex(key, EXTRA_DARK_PALETTE.length)]!
  );
}

/** PRIVATE_CREDIT -> "Private Credit", for a class with no name stored. */
export function humanise(key: string): string {
  return key
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
