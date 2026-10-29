/**
 * Asset class keys and the shipped constants. NO DATABASE ACCESS.
 *
 * The loader lives in asset-class-store.ts. Keeping them apart matters:
 * allocation-model.ts is deliberately pure so its rules can be tested without
 * a database, and importing Prisma here broke that.
 *
 * These used to be a Prisma enum. They are now rows an admin can add to and
 * remove, so the TYPE is simply a string key — but the six the product
 * shipped with stay available as constants, because a great deal of code
 * refers to CRYPTO by name to enforce the hard cap, and that rule is not
 * something an admin can delete their way out of.
 */

/** A class key as stored on assets, allocations and rebalance records. */
export type VaultAssetClass = string;

/** The six seeded with the product. Admin-created classes are not listed. */
export const VaultAssetClass = {
  GLOBAL_EQUITIES: 'GLOBAL_EQUITIES',
  FIXED_INCOME: 'FIXED_INCOME',
  COMMODITIES: 'COMMODITIES',
  REAL_ESTATE: 'REAL_ESTATE',
  FUTURES_MACRO: 'FUTURES_MACRO',
  CRYPTO: 'CRYPTO',
} as const;

/** The system classes in display order, as a fallback when the DB is unread. */
export const SYSTEM_CLASS_KEYS: string[] = [
  VaultAssetClass.GLOBAL_EQUITIES,
  VaultAssetClass.FIXED_INCOME,
  VaultAssetClass.COMMODITIES,
  VaultAssetClass.REAL_ESTATE,
  VaultAssetClass.FUTURES_MACRO,
  VaultAssetClass.CRYPTO,
];
