import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';
import { VAULT_ASSETS, validateRegistry } from '../src/lib/vault/asset-registry';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('prisma.io')
    ? { rejectUnauthorized: false }
    : undefined,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter, log: ['error', 'warn'] });

/**
 * Seed the Retirement Vault instrument universe.
 *
 * Idempotent: safe to re-run after editing the registry. Prices are
 * deliberately NOT touched on update — they belong to the sync engine, and
 * re-seeding must never roll a live price back to a placeholder.
 */
async function seedVaultAssets() {
  console.log('Seeding vault assets...\n');

  const validation = validateRegistry();

  for (const warning of validation.warnings) {
    console.warn(`  WARNING: ${warning}`);
  }

  if (!validation.valid) {
    console.error('Registry is invalid — refusing to seed:\n');
    for (const error of validation.errors) console.error(`  ERROR: ${error}`);
    throw new Error('Registry validation failed');
  }
  console.log('  Registry validated: sleeve weights, benchmark blend and credit budget OK.\n');

  let created = 0;
  let updated = 0;

  for (const asset of VAULT_ASSETS) {
    const data = {
      name: asset.name,
      assetClass: asset.assetClass,
      role: asset.role,
      provider: asset.provider,
      providerSymbol: asset.providerSymbol,
      fallbackProvider: asset.fallbackProvider,
      fallbackSymbol: asset.fallbackSymbol,
      sleeveWeight: asset.sleeveWeight,
      displayOrder: asset.displayOrder,
      isActive: true,
    };

    const existing = await prisma.vaultAsset.findUnique({
      where: { symbol: asset.symbol },
    });

    if (existing) {
      await prisma.vaultAsset.update({ where: { symbol: asset.symbol }, data });
      updated += 1;
      console.log(`  updated  ${asset.symbol.padEnd(5)} ${asset.name}`);
    } else {
      await prisma.vaultAsset.create({ data: { ...data, symbol: asset.symbol } });
      created += 1;
      console.log(`  created  ${asset.symbol.padEnd(5)} ${asset.name}`);
    }
  }

  // Anything in the table but no longer in the registry is deactivated rather
  // than deleted: its price history is still referenced by past valuations and
  // must survive.
  const registrySymbols = VAULT_ASSETS.map((a) => a.symbol);
  const retired = await prisma.vaultAsset.updateMany({
    where: { symbol: { notIn: registrySymbols }, isActive: true },
    data: { isActive: false },
  });

  console.log(`\nSeed complete: ${created} created, ${updated} updated, ${retired.count} retired.`);
}

seedVaultAssets()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
