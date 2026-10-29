import 'dotenv/config';
import { PriceProvider, VaultAssetRole } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import {
  createAsset,
  deleteAsset,
  describeRetirementBlockers,
  listAssets,
  updateAsset,
} from '../src/lib/vault/asset-admin';
import { BENCHMARK_BLEND } from '../src/lib/vault/asset-registry';

/**
 * The admin instrument screen.
 *
 * The properties worth paying for are the ones that cost real money when they
 * break: an instrument members hold being retired under them, a benchmark leg
 * being renamed or removed so every comparison line goes flat, a half-
 * configured fallback that looks like redundancy and is not, and a new
 * instrument quietly taking a share of a sleeve members already hold.
 */

let passed = 0, failed = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label} ${detail}`); }
}

const STAMP = Date.now();
const SYMBOL = `TST${String(STAMP).slice(-6)}`;
let createdId: string | null = null;

async function main() {
  console.log('=== 0. A class to hang instruments off ===');
  const cls = await prisma.vaultAssetClassDef.findFirstOrThrow({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
    select: { key: true },
  });
  console.log(`  using ${cls.key}`);

  console.log('\n=== 1. Validation refuses a half-built instrument ===');
  const noTicker = await createAsset({ name: 'No ticker', assetClass: cls.key, provider: 'TWELVE_DATA', providerSymbol: 'X' });
  check('a missing ticker is refused', !noTicker.ok, noTicker.errors.join(' '));

  const badTicker = await createAsset({
    symbol: 'bad ticker!', name: 'Bad', assetClass: cls.key,
    provider: 'TWELVE_DATA', providerSymbol: 'X',
  });
  check('a malformed ticker is refused', !badTicker.ok, badTicker.errors.join(' '));

  const badClass = await createAsset({
    symbol: SYMBOL, name: 'Bad class', assetClass: 'NOT_A_CLASS',
    provider: 'TWELVE_DATA', providerSymbol: 'X',
  });
  check('an unknown asset class is refused', !badClass.ok, badClass.errors.join(' '));

  const badProvider = await createAsset({
    symbol: SYMBOL, name: 'Bad provider', assetClass: cls.key,
    provider: 'NOT_A_PROVIDER', providerSymbol: 'X',
  });
  check('an unknown provider is refused', !badProvider.ok, badProvider.errors.join(' '));

  // A provider with no symbol is worse than no fallback: it reads as
  // redundancy on the screen and is skipped silently at sync time.
  const halfFallback = await createAsset({
    symbol: SYMBOL, name: 'Half fallback', assetClass: cls.key,
    provider: 'TWELVE_DATA', providerSymbol: 'X', fallbackProvider: 'COINGECKO',
  });
  check('a fallback provider with no symbol is refused', !halfFallback.ok,
    halfFallback.errors.join(' '));

  const orphanSymbol = await createAsset({
    symbol: SYMBOL, name: 'Orphan symbol', assetClass: cls.key,
    provider: 'TWELVE_DATA', providerSymbol: 'X', fallbackSymbol: 'xrp',
  });
  check('a fallback symbol with no provider is refused', !orphanSymbol.ok,
    orphanSymbol.errors.join(' '));

  console.log('\n=== 2. A good instrument is created ===');
  const created = await createAsset({
    symbol: SYMBOL.toLowerCase(), name: 'Test Instrument', assetClass: cls.key,
    provider: 'TWELVE_DATA', providerSymbol: 'TSTX', role: 'PORTFOLIO',
  });
  check('created', created.ok, created.errors.join(' '));
  createdId = created.id ?? null;

  const row = await prisma.vaultAsset.findUniqueOrThrow({ where: { id: createdId! } });
  check('the ticker is upper-cased', row.symbol === SYMBOL, row.symbol);
  check('it starts at sleeve weight 0, diluting nobody', row.sleeveWeight === 0,
    String(row.sleeveWeight));
  check('it is active', row.isActive === true);

  console.log('\n=== 3. Tickers are unique ===');
  const dup = await createAsset({
    symbol: SYMBOL, name: 'Duplicate', assetClass: cls.key,
    provider: 'TWELVE_DATA', providerSymbol: 'TSTX',
  });
  check('a duplicate ticker is refused', !dup.ok, dup.errors.join(' '));

  console.log('\n=== 4. Editing ===');
  const renamed = await updateAsset(createdId!, { name: 'Renamed Instrument' });
  check('name updated', renamed.ok, renamed.errors.join(' '));
  const after = await prisma.vaultAsset.findUniqueOrThrow({ where: { id: createdId! } });
  check('the new name stuck', after.name === 'Renamed Instrument', after.name);

  const badWeight = await updateAsset(createdId!, { sleeveWeight: 1.5 });
  check('a sleeve weight above 1 is refused', !badWeight.ok, badWeight.errors.join(' '));

  console.log('\n=== 5. A held instrument cannot be retired ===');
  const vault = await prisma.retirementVault.findFirst({ select: { id: true } });
  if (vault === null) {
    console.log('  (no vault present; holding guard exercised via the blocker list only)');
    const blockers = await describeRetirementBlockers(createdId!);
    check('an unheld instrument has no blockers', blockers.length === 0, blockers.join(' '));
  } else {
    await prisma.vaultHolding.create({
      data: { vaultId: vault.id, assetId: createdId!, units: 1, costBasis: 1 },
    });
    const blockers = await describeRetirementBlockers(createdId!);
    check('a held instrument reports a blocker', blockers.length > 0, blockers.join(' '));
    const retire = await updateAsset(createdId!, { isActive: false });
    check('retiring it is refused', !retire.ok, retire.errors.join(' '));
    const removal = await deleteAsset(createdId!);
    check('removing it is refused', !removal.ok, removal.errors.join(' '));

    await prisma.vaultHolding.deleteMany({ where: { assetId: createdId! } });
    const cleared = await describeRetirementBlockers(createdId!);
    check('the blocker clears once the holding is gone', cleared.length === 0, cleared.join(' '));
  }

  console.log('\n=== 6. Benchmark legs are protected ===');
  const legSymbol = BENCHMARK_BLEND[0]!.symbol;
  const leg = await prisma.vaultAsset.findUnique({ where: { symbol: legSymbol } });
  if (leg === null) {
    check(`benchmark leg ${legSymbol} exists`, false, 'not in the registry');
  } else {
    const legBlockers = await describeRetirementBlockers(leg.id);
    check(`${legSymbol} reports a blocker`, legBlockers.length > 0, legBlockers.join(' '));
    const removeLeg = await deleteAsset(leg.id);
    check(`${legSymbol} cannot be removed`, !removeLeg.ok, removeLeg.errors.join(' '));
    // Renaming is the subtler hazard: the blend names its legs by SYMBOL, so a
    // rename leaves every member's comparison line flat with no error anywhere.
    const renameLeg = await updateAsset(leg.id, { symbol: 'NOTSPY' });
    check(`${legSymbol} cannot be renamed`, !renameLeg.ok, renameLeg.errors.join(' '));
    const stillThere = await prisma.vaultAsset.findUnique({ where: { id: leg.id } });
    check(`${legSymbol} is untouched`, stillThere?.symbol === legSymbol, stillThere?.symbol);
  }

  console.log('\n=== 7. Retiring and restoring ===');
  const retired = await updateAsset(createdId!, { isActive: false });
  check('an unheld instrument retires', retired.ok, retired.errors.join(' '));
  const restored = await updateAsset(createdId!, { isActive: true });
  check('and comes back', restored.ok, restored.errors.join(' '));

  console.log('\n=== 8. The listing reports sleeve drift ===');
  const listing = await listAssets();
  check('the new instrument is listed',
    listing.assets.some((a) => a.id === createdId), String(listing.assets.length));
  const total = listing.sleeveTotals[cls.key];
  check('its class still totals 100% (weight 0 changed nothing)',
    total === undefined || Math.abs(total - 1) < 1e-9, String(total));
  // GLOBAL_EQUITIES holds VT (weight 1) and SPY (weight 1, BENCHMARK). The
  // total is 1 only if the benchmark leg is left out; counting it would give 2
  // and halve the real sleeve at the next rebalance.
  const equities = listing.assets.filter(
    (a) => a.assetClass === 'GLOBAL_EQUITIES' && a.isActive,
  );
  const benchLegs = equities.filter((a) => a.role === VaultAssetRole.BENCHMARK);
  const rawSum = equities.reduce((s, a) => s + a.sleeveWeight, 0);
  check('the class does contain a benchmark leg to exclude', benchLegs.length > 0,
    String(benchLegs.length));
  check('the sleeve total excludes it',
    Math.abs((listing.sleeveTotals.GLOBAL_EQUITIES ?? 0) - (rawSum - benchLegs.reduce((s, a) => s + a.sleeveWeight, 0))) < 1e-9,
    `total ${listing.sleeveTotals.GLOBAL_EQUITIES} vs raw ${rawSum}`);

  console.log('\n=== 9. Removal ===');
  const removed = await deleteAsset(createdId!);
  check('an unheld, non-benchmark instrument is removed', removed.ok, removed.errors.join(' '));
  const gone = await prisma.vaultAsset.findUnique({ where: { id: createdId! } });
  check('it is really gone', gone === null);
  createdId = null;

  console.log('\n=== 10. Providers and roles are the real enums ===');
  check('every provider is a PriceProvider',
    Object.values(PriceProvider).length > 0 && Object.values(PriceProvider).includes('COINGECKO'));
  check('every role is a VaultAssetRole',
    Object.values(VaultAssetRole).includes('BENCHMARK'));
}

async function cleanup() {
  console.log('\n=== Cleanup ===');
  if (createdId !== null) {
    await prisma.vaultHolding.deleteMany({ where: { assetId: createdId } }).catch(() => undefined);
    await prisma.vaultAsset.delete({ where: { id: createdId } }).catch(() => undefined);
  }
  await prisma.vaultAsset.deleteMany({ where: { symbol: { startsWith: 'TST' } } })
    .catch(() => undefined);
  console.log(`  instruments remaining: ${await prisma.vaultAsset.count()}`);
}

main()
  .catch((e) => { console.error('FATAL', e); failed++; })
  .finally(async () => {
    await cleanup();
    console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
    await prisma.$disconnect();
    process.exit(failed === 0 ? 0 : 1);
  });
