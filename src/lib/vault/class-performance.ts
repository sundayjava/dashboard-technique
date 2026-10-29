import { Prisma, VaultAssetRole, VaultStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DEFAULT_VAULT_POLICY, VaultPolicy } from './allocation-model';
import { toUtcDateOnly } from './price-providers';

/**
 * Daily class performance.
 *
 * Each asset class earns one rate per day, and every member's money in that
 * class grows by it overnight:
 *
 *   rate(class, day) = SUM( each instrument's close-of-day change )
 *                    + the admin's uplift for that class
 *
 * The sum is a sum, not an average. That is deliberate and was specified: the
 * figure therefore scales with how many instruments a class holds, so adding
 * a fourth coin to CRYPTO moves the rate even on a flat day. The uplift is
 * what the admin tunes against it.
 *
 * TWO PROPERTIES THIS MODULE EXISTS TO GUARANTEE.
 *
 * 1. A day is computed once and then frozen. The uplift is a live field an
 *    admin may change several times a day, so the rate is READ at the moment
 *    the day is closed and stored. Recomputing last Tuesday after the admin
 *    moved the number would silently rewrite balances members have already
 *    seen.
 *
 * 2. A day is credited at most once per vault per class, enforced by a unique
 *    key in the database rather than by the job being careful. The nightly
 *    cron can be retried, run twice, or overlap itself without paying a
 *    member twice.
 *
 * A CLASS EARNS ONCE PER TRADING DAY, NOT ONCE PER CALENDAR DAY.
 *
 * Asset classes keep different calendars, and the vendors date their closes
 * accordingly. Crypto trades round the clock and is stamped with today. US
 * equities close at 21:00 UTC, so on any given date the newest equity close
 * carries YESTERDAY's date. Requiring the snapshot date to equal the run date
 * therefore credited crypto every day and everything else never -- the bug
 * this comment exists to stop coming back.
 *
 * So each class finds its own most recent trading day on or before the run
 * date and earns for THAT day. The accrual is keyed on the trading day, so the
 * unique key still guarantees one credit per day: over a weekend, equities
 * resolve to Friday again and are recognised as already paid.
 *
 * A class with no close in the lookback window earns NO rate at all -- not the
 * uplift alone. Paying an uplift on a market that has not traded would invent
 * performance out of the calendar.
 */

/** The arithmetic behind one class's day, kept whole so it can be shown. */
export interface ClassRate {
  assetClass: string;
  /**
   * The trading day this rate belongs to: the class's own latest close on or
   * before the run date. Not necessarily the run date itself.
   */
  performanceDate: Date;
  /** Sum of every priced instrument's close-of-day change, in percent. */
  assetSumPercent: number;
  /** The admin's uplift as it stood when the day was computed. */
  upliftPercent: number;
  /** assetSumPercent + upliftPercent, after the cap. */
  totalPercent: number;
  /** True when the cap bit, so a limited rate is visible rather than silent. */
  wasClamped: boolean;
  assetCount: number;
  breakdown: Array<{ symbol: string; changePercent: number }>;
}

export interface AccrualSummary {
  date: Date;
  rates: ClassRate[];
  /** Vaults the engine looked at. */
  vaultsConsidered: number;
  /** Vaults that received at least one credit. */
  vaultsCredited: number;
  /** Credits written, one per vault per class. */
  creditsWritten: number;
  /** Credits skipped because that day was already paid. */
  alreadyCredited: number;
  netAmount: number;
  failures: Array<{ vaultId: string; reason: string }>;
}

/**
 * How far back a class may reach for its latest trading day.
 *
 * Long enough to carry a long holiday weekend, short enough that a class whose
 * feed has been broken for a month stops earning rather than being credited
 * from stale data nobody noticed.
 */
const TRADING_DAY_LOOKBACK_DAYS = 10;

/**
 * Compute each class's rate for its latest trading day, storing nothing.
 *
 * Only closes dated ON that trading day count towards the sum. A forward-fill
 * would reuse an absent instrument's last known change every day until the
 * class moved on, quietly paying for the same move more than once.
 */
export async function computeClassRates(
  asOf: Date = new Date(),
  policy: VaultPolicy = DEFAULT_VAULT_POLICY,
): Promise<ClassRate[]> {
  const date = toUtcDateOnly(asOf);

  const [classes, snapshots] = await Promise.all([
    prisma.vaultAssetClassDef.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: { key: true, dailyUpliftPercent: true },
    }),
    prisma.assetPriceSnapshot.findMany({
      where: {
        priceDate: {
          lte: date,
          gte: new Date(date.getTime() - TRADING_DAY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
        },
        changePercent: { not: null },
        asset: {
          isActive: true,
          // A benchmark-only instrument is not held by anyone and exists to
          // draw the 401k comparison line. Letting SPY into the equities rate
          // would pay members for a basket their vault never owned.
          role: { in: [VaultAssetRole.PORTFOLIO, VaultAssetRole.BOTH] },
        },
      },
      select: {
        changePercent: true,
        priceDate: true,
        asset: { select: { symbol: true, assetClass: true } },
      },
    }),
  ]);

  // Each class's own trading day: the newest close it has on or before the run
  // date. Equities land on yesterday, crypto on today, and both are right.
  const tradingDay = new Map<string, number>();
  for (const snapshot of snapshots) {
    const key = snapshot.asset.assetClass;
    const stamp = snapshot.priceDate.getTime();
    if (stamp > (tradingDay.get(key) ?? 0)) tradingDay.set(key, stamp);
  }

  const byClass = new Map<string, Array<{ symbol: string; changePercent: number }>>();
  for (const snapshot of snapshots) {
    if (snapshot.changePercent === null) continue;
    const key = snapshot.asset.assetClass;
    // Only the trading day itself. An instrument that missed that day does not
    // get its previous move counted a second time.
    if (snapshot.priceDate.getTime() !== tradingDay.get(key)) continue;
    const list = byClass.get(key) ?? [];
    list.push({ symbol: snapshot.asset.symbol, changePercent: snapshot.changePercent });
    byClass.set(key, list);
  }

  const cap = Math.abs(policy.dailyRateCapPercent);
  const rates: ClassRate[] = [];

  for (const definition of classes) {
    const breakdown = byClass.get(definition.key) ?? [];
    const stamp = tradingDay.get(definition.key);

    // No close in the window means this class has not traded. Skipped
    // entirely, so no row is written and no member is credited.
    if (breakdown.length === 0 || stamp === undefined) continue;

    const assetSumPercent = breakdown.reduce((sum, a) => sum + a.changePercent, 0);
    const raw = assetSumPercent + definition.dailyUpliftPercent;
    const totalPercent = Math.max(-cap, Math.min(cap, raw));

    rates.push({
      assetClass: definition.key,
      performanceDate: new Date(stamp),
      assetSumPercent,
      upliftPercent: definition.dailyUpliftPercent,
      totalPercent,
      wasClamped: totalPercent !== raw,
      assetCount: breakdown.length,
      breakdown,
    });
  }

  return rates;
}

/**
 * Store the day's rates.
 *
 * Idempotent on (class, day): re-running a day corrects it rather than
 * duplicating it, matching how price snapshots behave. Note that correcting a
 * rate does NOT re-credit members -- the accrual guard is separate and has
 * already been spent.
 */
export async function persistClassRates(rates: ClassRate[]): Promise<void> {
  // In series: this database multiplexes through a proxy and does not execute
  // queries concurrently, so a Promise.all here measures slower, not faster.
  for (const rate of rates) {
    const performanceDate = rate.performanceDate;
    const data = {
      assetSumPercent: rate.assetSumPercent,
      upliftPercent: rate.upliftPercent,
      totalPercent: rate.totalPercent,
      wasClamped: rate.wasClamped,
      assetCount: rate.assetCount,
      breakdown: JSON.stringify(rate.breakdown),
    };

    /*
     * A RATE IS IMMUTABLE ONCE SOMEONE HAS BEEN PAID ON IT.
     *
     * This used to update unconditionally, which was fine while the chain ran
     * once a day and wrong the moment it ran twice. The credit is frozen after
     * the first write -- one per vault, per class, per trading day -- so a
     * later run that revised the rate left the member's statement showing a
     * figure they were never paid. It happened: crypto was credited at
     * +0.9969% at 00:51 and the stored rate was rewritten to -6.6793% at
     * 10:28, a divergence of 7.68 points on a live statement.
     *
     * Before anyone is credited there is nothing to contradict, so the rate is
     * still refreshed -- that covers a first run against half-synced prices
     * being improved by a later one.
     */
    const alreadyCredited = await prisma.vaultClassAccrual.count({
      where: { assetClass: rate.assetClass, accrualDate: performanceDate },
    });

    await prisma.vaultClassPerformanceDay.upsert({
      where: {
        assetClass_performanceDate: { assetClass: rate.assetClass, performanceDate },
      },
      create: { assetClass: rate.assetClass, performanceDate, ...data },
      update: alreadyCredited > 0 ? {} : data,
    });
  }
}

/** A class's allocated value for one vault, and the rows behind it. */
interface ClassPosition {
  assetClass: string;
  /** Cash the member put into this class, from the holdings' cost basis. */
  principal: number;
  /** Performance credited so far. */
  accrued: number;
  /** principal + accrued: what the day's rate is applied to. */
  value: number;
  lastAccruedDate: Date | null;
  /** False when the class has no allocation row to write the total back to. */
  hasAllocationRow: boolean;
}

/**
 * What each class is worth for one vault.
 *
 * Principal comes from cost basis, not units x price. The day's rate is now
 * what moves a member's balance, so valuing the same market movement a second
 * time through the share price would pay for it twice.
 */
export function buildClassPositions(vault: {
  holdings: Array<{ costBasis: number; units: number; asset: { assetClass: string } }>;
  allocations: Array<{
    assetClass: string;
    accruedPerformance: number;
    lastAccruedDate: Date | null;
  }>;
}): Map<string, ClassPosition> {
  const positions = new Map<string, ClassPosition>();

  function slot(assetClass: string): ClassPosition {
    const existing = positions.get(assetClass);
    if (existing !== undefined) return existing;
    const created: ClassPosition = {
      assetClass,
      principal: 0,
      accrued: 0,
      value: 0,
      lastAccruedDate: null,
      hasAllocationRow: false,
    };
    positions.set(assetClass, created);
    return created;
  }

  for (const holding of vault.holdings) {
    // A closed position has no principal left to grow.
    if (holding.units === 0) continue;
    slot(holding.asset.assetClass).principal += holding.costBasis;
  }

  for (const allocation of vault.allocations) {
    const position = slot(allocation.assetClass);
    position.accrued = allocation.accruedPerformance;
    position.lastAccruedDate = allocation.lastAccruedDate;
    position.hasAllocationRow = true;
  }

  for (const position of positions.values()) {
    position.value = position.principal + position.accrued;
  }

  return positions;
}

/**
 * Credit one day to every open vault.
 *
 * Writes the accrual row and the running total in a single transaction per
 * vault, so a crash can never leave a member's total disagreeing with the
 * ledger that explains it.
 */
export async function accrueVaults(
  rates: ClassRate[],
): Promise<Omit<AccrualSummary, 'date' | 'rates'>> {
  const rateByClass = new Map(rates.map((r) => [r.assetClass, r]));

  const vaults = await prisma.retirementVault.findMany({
    where: { status: { in: [VaultStatus.ACTIVE, VaultStatus.CLOSING] } },
    select: {
      id: true,
      holdings: {
        select: { costBasis: true, units: true, asset: { select: { assetClass: true } } },
      },
      allocations: {
        select: { assetClass: true, accruedPerformance: true, lastAccruedDate: true },
      },
    },
  });

  const failures: Array<{ vaultId: string; reason: string }> = [];
  let vaultsCredited = 0;
  let creditsWritten = 0;
  let alreadyCredited = 0;
  let netAmount = 0;

  for (const vault of vaults) {
    const positions = buildClassPositions(vault);
    let creditedThisVault = 0;

    for (const position of positions.values()) {
      const rate = rateByClass.get(position.assetClass);
      if (rate === undefined) continue;

      // Keyed on the class's trading day. Over a weekend equities resolve to
      // Friday again, and this is what recognises Friday as already paid.
      const accrualDate = rate.performanceDate;

      // Nothing allocated means nothing to grow. A negative value would be a
      // bug upstream; growing it would compound the bug rather than show it.
      if (position.value <= 0) continue;

      // The cheap guard. The unique key below is the one that is binding, but
      // checking the running total first avoids a doomed write per vault.
      if (
        position.lastAccruedDate !== null &&
        position.lastAccruedDate.getTime() >= accrualDate.getTime()
      ) {
        alreadyCredited += 1;
        continue;
      }

      if (!position.hasAllocationRow) {
        // Holdings in a class the vault has no allocation row for. There is
        // nowhere to keep the running total, so crediting it would produce a
        // ledger entry that never reaches a balance.
        failures.push({
          vaultId: vault.id,
          reason: `No allocation row for ${position.assetClass}; skipped.`,
        });
        continue;
      }

      // A rate below -100% would take the class past zero. Clamped so a
      // member's holding can be wiped out but never turned into a debt.
      const amount = Math.max(
        -position.value,
        (position.value * rate.totalPercent) / 100,
      );
      const closingValue = position.value + amount;

      try {
        await prisma.$transaction([
          prisma.vaultClassAccrual.create({
            data: {
              vaultId: vault.id,
              assetClass: position.assetClass,
              accrualDate,
              openingValue: position.value,
              ratePercent: rate.totalPercent,
              amount,
              closingValue,
            },
          }),
          prisma.vaultAllocation.update({
            where: {
              vaultId_assetClass: { vaultId: vault.id, assetClass: position.assetClass },
            },
            data: {
              accruedPerformance: position.accrued + amount,
              lastAccruedDate: accrualDate,
            },
          }),
        ]);

        creditsWritten += 1;
        creditedThisVault += 1;
        netAmount += amount;
      } catch (error) {
        // The unique key rejecting a duplicate is the guard working, not a
        // failure: another run already paid this day.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          alreadyCredited += 1;
          continue;
        }
        failures.push({
          vaultId: vault.id,
          reason: `${position.assetClass}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    }

    if (creditedThisVault > 0) vaultsCredited += 1;
  }

  return {
    vaultsConsidered: vaults.length,
    vaultsCredited,
    creditsWritten,
    alreadyCredited,
    netAmount,
    failures,
  };
}

/**
 * Close a day: compute the rates, store them, credit every vault.
 *
 * Runs after the price sync and before the valuations, which is the only
 * order that works -- the rates need the day's closes, and the valuations
 * need the credits.
 */
export async function runDailyClassPerformance(
  asOf: Date = new Date(),
  policy: VaultPolicy = DEFAULT_VAULT_POLICY,
): Promise<AccrualSummary> {
  const date = toUtcDateOnly(asOf);

  const rates = await computeClassRates(date, policy);

  if (rates.length === 0) {
    return {
      date,
      rates,
      vaultsConsidered: 0,
      vaultsCredited: 0,
      creditsWritten: 0,
      alreadyCredited: 0,
      netAmount: 0,
      failures: [],
    };
  }

  await persistClassRates(rates);
  const accrual = await accrueVaults(rates);

  // Nothing to invalidate: the valuation cache holds market prices and the
  // benchmark index, and an accrual moves neither. Balances are read fresh on
  // every valuation precisely so a credit is visible immediately.
  return { date, rates, ...accrual };
}

/**
 * The stored rates for a day, for showing a member or an admin the workings.
 *
 * Falls back to the most recent day that has rates, so a member looking on a
 * Sunday sees Friday's figures rather than an empty panel.
 */
export async function getLatestClassRates(
  asOf: Date = new Date(),
): Promise<{ date: Date | null; rates: ClassRate[] }> {
  // One row per class, each at ITS OWN latest trading day. Filtering to a
  // single shared date would drop every class whose market closed earlier --
  // which, on any weekday, is all of them except crypto.
  const rows = await prisma.vaultClassPerformanceDay.findMany({
    where: { performanceDate: { lte: toUtcDateOnly(asOf) } },
    orderBy: [{ assetClass: 'asc' }, { performanceDate: 'desc' }],
    distinct: ['assetClass'],
  });

  if (rows.length === 0) return { date: null, rates: [] };

  // The newest trading day any class reached, for the panel's "closed" label.
  const newest = rows.reduce(
    (max, row) => (row.performanceDate > max ? row.performanceDate : max),
    rows[0]!.performanceDate,
  );

  return {
    date: newest,
    rates: rows.map((row) => ({
      assetClass: row.assetClass,
      performanceDate: row.performanceDate,
      assetSumPercent: row.assetSumPercent,
      upliftPercent: row.upliftPercent,
      totalPercent: row.totalPercent,
      wasClamped: row.wasClamped,
      assetCount: row.assetCount,
      breakdown: parseBreakdown(row.breakdown),
    })),
  };
}

function parseBreakdown(raw: string | null): Array<{ symbol: string; changePercent: number }> {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is { symbol: string; changePercent: number } =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { symbol?: unknown }).symbol === 'string' &&
        typeof (entry as { changePercent?: unknown }).changePercent === 'number',
    );
  } catch {
    // Stored JSON we cannot read is worth nothing but must not break a page.
    return [];
  }
}

/** What one vault has been credited per class, newest day first. */
export async function getVaultAccruals(
  vaultId: string,
  limit = 60,
): Promise<
  Array<{
    assetClass: string;
    accrualDate: Date;
    ratePercent: number;
    amount: number;
    openingValue: number;
    closingValue: number;
  }>
> {
  return prisma.vaultClassAccrual.findMany({
    where: { vaultId },
    orderBy: [{ accrualDate: 'desc' }, { assetClass: 'asc' }],
    take: limit,
    select: {
      assetClass: true,
      accrualDate: true,
      ratePercent: true,
      amount: true,
      openingValue: true,
      closingValue: true,
    },
  });
}
