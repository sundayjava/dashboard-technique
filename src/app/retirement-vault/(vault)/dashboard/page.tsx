'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Banknote, PiggyBank, Target, Wallet } from 'lucide-react';
import {
  MODE_LABELS, PROFILE_LABELS, money, moneyShort, sharesOfVault, useClassLabel, useVault,
} from '@/components/retirement-vault/VaultContext';
import {
  AssetIcon, Panel, PillButton, StatCard, Trend,
} from '@/components/retirement-vault/VaultUI';
import ExpertToggle from '@/components/retirement-vault/ExpertToggle';
import MarketTable from '@/components/retirement-vault/MarketTable';
import ClassPerformance from '@/components/retirement-vault/ClassPerformance';
import RebalanceHistory from '@/components/retirement-vault/RebalanceHistory';

/** Overview: the headline numbers, then routes into the detail pages. */
export default function VaultOverviewPage() {
  const { data, refresh } = useVault();
  const label = useClassLabel();
  const router = useRouter();
  const vault = data?.vault;
  const valuation = data?.valuation;
  if (!vault) return null;

  const gain = valuation?.unrealisedGainLoss ?? 0;
  const benchmark = valuation?.benchmarkValue ?? null;
  const vsBenchmark = benchmark === null ? null : (valuation?.totalValue ?? 0) - benchmark;

  // Shown as a share of the WHOLE vault so it is comparable to the target,
  // which is also a share of the vault.
  const { shares, cashPercent, vaultTotal } = sharesOfVault(
    valuation?.currentAllocation ?? {},
    valuation?.holdingsValue ?? 0,
    vault.cashBalance,
  );
  const classes = Object.entries(shares)
    .filter(([, v]) => v > 0.004)
    .sort((a, b) => b[1] - a[1]);

  const target = data?.targetAllocation ?? {};
  const classValues = valuation?.classValues ?? {};

  /**
   * Profit on a class, as a percentage of what the member put into it.
   *
   * Cumulative, not the day's rate: it opens at +0.00% the moment money lands
   * and grows as days are credited, which is the figure a member means by
   * "how is my crypto doing". The day's own rate lives in the performance
   * panel below, where its workings can be shown beside it.
   *
   * Null when there is no principal to measure against -- a percentage of
   * nothing is not zero, it is undefined, and printing +0.00% there would
   * claim a flat return the member never had.
   */
  const gainPercentFor = (cls: string): number | null => {
    const position = classValues[cls];
    if (position === undefined || position.principal <= 0) return null;
    return (position.accrued / position.principal) * 100;
  };

  return (
    <div className="space-y-4">
      {/*
        The headline cards and uninvested cash share ONE grid.
        Stacked full width, these four filled a phone screen on their own and
        pushed the allocation below the fold, so on mobile they tile two
        across. On desktop the three stat cards keep their own row and cash
        sits beneath with the toggle beside it, exactly as before.
      */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          tone="blue"
          icon={PiggyBank}
          label="Vault value"
          value={money(valuation?.totalValue ?? 0)}
          sub={
            <span className="text-xs text-white/80">
              {gain >= 0 ? '+' : ''}
              {money(gain)} ({valuation?.unrealisedGainLossPercent.toFixed(2) ?? '0.00'}%)
            </span>
          }
          onAction={() => router.push('/retirement-vault/performance')}
          actionLabel="View performance"
        />
        <StatCard
          tone="plain"
          icon={Banknote}
          label="Total contributed"
          value={money(vault.totalContributed)}
          sub={
            <span className="text-xs text-gray-500">
              {vault.monthlyContribution
                ? `${moneyShort(vault.monthlyContribution)}/month`
                : 'No monthly contribution'}
            </span>
          }
          onAction={() => router.push('/retirement-vault/contributions')}
          actionLabel="Manage contributions"
        />
        <StatCard
          tone="lime"
          icon={Target}
          label="vs traditional 401k"
          value={
            vsBenchmark === null
              ? '—'
              : `${vsBenchmark >= 0 ? '+' : '−'}${money(Math.abs(vsBenchmark))}`
          }
          sub={
            <span className="text-xs text-black/60">
              {benchmark === null ? 'Available once funded' : `401k: ${moneyShort(benchmark)}`}
            </span>
          }
          onAction={() => router.push('/retirement-vault/reports')}
          actionLabel="View reports"
        />

        {/* Fourth tile, completing the 2x2 on a phone. */}
        <Panel>
          <div className="flex flex-col h-full sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Uninvested cash</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900 tabular-nums mt-0.5 truncate">
                {money(vault.cashBalance)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {vault.cashBalance > 0.01
                  ? 'Waiting for you to invest it.'
                  : 'Everything is invested.'}
              </p>
            </div>
            {vault.cashBalance > 0.01 && (
              <div className="mt-auto sm:mt-0 shrink-0">
                <PillButton
                  tone="dark"
                  onClick={() => router.push('/retirement-vault/allocation')}
                >
                  Invest now
                </PillButton>
              </div>
            )}
          </div>
        </Panel>

        {/* Full width under the tiles: a switch with a status line needs the
            room, and halving it would wrap the label mid-sentence. */}
        <div className="col-span-2 md:col-span-2">
          <Panel>
            <ExpertToggle onChanged={refresh} compact />
          </Panel>
        </div>
      </div>

      {/* Allocation, as a pool-style list with per-asset colour. */}
      <Panel
        title="Allocation"
        padded={false}
        action={
          <PillButton onClick={() => router.push('/retirement-vault/allocation')}>
            View details
          </PillButton>
        }
      >
        {classes.length === 0 ? (
          <div className="px-5 pb-8 pt-2 text-center">
            <p className="text-xs text-gray-500">
              Nothing invested yet.{' '}
              <Link href="/retirement-vault/contributions" className="underline">
                Fund your vault
              </Link>{' '}
              to buy your allocation.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                  <th className="text-left font-medium px-4 py-2">Asset class</th>
                  <th className="text-right font-medium px-4 py-2">Share</th>
                  <th className="text-right font-medium px-4 py-2">Target</th>
                  <th className="text-right font-medium px-4 py-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {classes.map(([cls, pct]) => {
                  const t = target[cls] ?? 0;
                  const value = (vaultTotal * pct) / 100;
                  return (
                    <tr key={cls} className="border-t border-gray-50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <AssetIcon assetClass={cls} size="sm" />
                          <span className="font-medium text-gray-900">
                            {label(cls)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900 tabular-nums">
                        {pct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-400 tabular-nums">
                        {t.toFixed(0)}%
                      </td>
                      {/* The move sits above the value it is a move in. */}
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {(() => {
                          const gain = gainPercentFor(cls);
                          if (gain === null) return null;
                          const up = gain >= 0;
                          return (
                            <p
                              className={`text-[11px] font-semibold leading-tight ${
                                up ? 'text-lime-700' : 'text-red-600'
                              }`}
                            >
                              {up ? '+' : ''}
                              {gain.toFixed(2)}%
                            </p>
                          );
                        })()}
                        <p className="text-gray-900 leading-tight">{money(value)}</p>
                      </td>
                    </tr>
                  );
                })}
                {cashPercent > 0.004 && (
                  <tr className="border-t border-gray-50 bg-gray-50/50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 bg-gray-400"
                          aria-hidden
                        >
                          <Wallet className="w-3.5 h-3.5" />
                        </span>
                        <span className="font-medium text-gray-900">Uninvested cash</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900 tabular-nums">
                      {cashPercent.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-400 tabular-nums">—</td>
                    <td className="px-4 py-2.5 text-right text-gray-900 tabular-nums">
                      {money(vault.cashBalance)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Market moves. Independent of the allocation above: this is what the
          assets we track are doing, not what the member owns. */}
      {/* The day's rate per class, above the allocated value it applies to. */}
      <ClassPerformance />

      {/* Moved here from its own page, which was mostly empty around it. */}
      <RebalanceHistory />

      <MarketTable />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel title="Your plan">
          <div className="grid grid-cols-2 gap-4">
            {[
              ['Risk profile', PROFILE_LABELS[vault.riskProfile] ?? vault.riskProfile],
              ['Allocation mode', MODE_LABELS[vault.allocationMode] ?? vault.allocationMode],
              ['Horizon', vault.horizon.replace('YEARS_', '').replace('_PLUS', '+') + ' years'],
              ['Invested', money(valuation?.holdingsValue ?? 0)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[10px] text-gray-400">{label}</p>
                <p className="text-xs font-semibold text-gray-900 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Position">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Return since inception</span>
              <Trend value={valuation?.unrealisedGainLossPercent ?? 0} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Invested</span>
              <span className="text-xs font-semibold text-gray-900 tabular-nums">
                {money(valuation?.holdingsValue ?? 0)}
              </span>
            </div>
            {data?.drift && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Drift from target</span>
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    data.drift.rebalanceRequired ? 'text-amber-600' : 'text-gray-900'
                  }`}
                >
                  {data.drift.maxAbsoluteDrift.toFixed(2)} pts
                </span>
              </div>
            )}
            <Link
              href="/retirement-vault/allocation"
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 pt-1"
            >
              Manage allocation <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
