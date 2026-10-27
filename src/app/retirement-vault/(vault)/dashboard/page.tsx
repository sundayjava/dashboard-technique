'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Banknote, PiggyBank, Target } from 'lucide-react';
import {
  CLASS_LABELS, MODE_LABELS, PROFILE_LABELS, money, moneyShort, sharesOfVault, useVault,
} from '@/components/retirement-vault/VaultContext';
import {
  AssetIcon, Panel, PillButton, StatCard, Trend,
} from '@/components/retirement-vault/VaultUI';
import ExpertToggle from '@/components/retirement-vault/ExpertToggle';

/** Overview: the headline numbers, then routes into the detail pages. */
export default function VaultOverviewPage() {
  const { data, refresh } = useVault();
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

  return (
    <div className="space-y-5">
      {/* Three headline cards: one accent, one plain, one brand. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      </div>

      {/* Uninvested cash is the thing most likely to need action, so it sits
          above the allocation list with the toggle beside it. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Uninvested cash</p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">
                {money(vault.cashBalance)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {vault.cashBalance > 0.01
                  ? 'Waiting for you to invest it.'
                  : 'Everything is invested.'}
              </p>
            </div>
            {vault.cashBalance > 0.01 && (
              <PillButton
                tone="dark"
                onClick={() => router.push('/retirement-vault/allocation')}
              >
                Invest now
              </PillButton>
            )}
          </div>
        </Panel>

        <Panel>
          <ExpertToggle onChanged={refresh} compact />
        </Panel>
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
            <p className="text-sm text-gray-500">
              Nothing invested yet.{' '}
              <Link href="/retirement-vault/contributions" className="underline">
                Fund your vault
              </Link>{' '}
              to buy your allocation.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-400">
                  <th className="text-left font-medium px-5 py-3">Asset class</th>
                  <th className="text-right font-medium px-5 py-3">Share</th>
                  <th className="text-right font-medium px-5 py-3">Target</th>
                  <th className="text-right font-medium px-5 py-3">Value</th>
                </tr>
              </thead>
              <tbody>
                {classes.map(([cls, pct]) => {
                  const t = target[cls] ?? 0;
                  const value = (vaultTotal * pct) / 100;
                  return (
                    <tr key={cls} className="border-t border-gray-50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <AssetIcon assetClass={cls} />
                          <span className="font-medium text-gray-900">
                            {CLASS_LABELS[cls] ?? cls}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-gray-900 tabular-nums">
                        {pct.toFixed(2)}%
                      </td>
                      <td className="px-5 py-4 text-right text-gray-400 tabular-nums">
                        {t.toFixed(0)}%
                      </td>
                      <td className="px-5 py-4 text-right text-gray-900 tabular-nums">
                        {money(value)}
                      </td>
                    </tr>
                  );
                })}
                {cashPercent > 0.004 && (
                  <tr className="border-t border-gray-50 bg-gray-50/50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-[10px] shrink-0 bg-gray-400"
                          aria-hidden
                        >
                          CASH
                        </span>
                        <span className="font-medium text-gray-900">Uninvested cash</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-gray-900 tabular-nums">
                      {cashPercent.toFixed(2)}%
                    </td>
                    <td className="px-5 py-4 text-right text-gray-400 tabular-nums">—</td>
                    <td className="px-5 py-4 text-right text-gray-900 tabular-nums">
                      {money(vault.cashBalance)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Your plan">
          <div className="grid grid-cols-2 gap-5">
            {[
              ['Risk profile', PROFILE_LABELS[vault.riskProfile] ?? vault.riskProfile],
              ['Allocation mode', MODE_LABELS[vault.allocationMode] ?? vault.allocationMode],
              ['Horizon', vault.horizon.replace('YEARS_', '').replace('_PLUS', '+') + ' years'],
              ['Invested', money(valuation?.holdingsValue ?? 0)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{value}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Position">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Return since inception</span>
              <Trend value={valuation?.unrealisedGainLossPercent ?? 0} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Invested</span>
              <span className="text-sm font-semibold text-gray-900 tabular-nums">
                {money(valuation?.holdingsValue ?? 0)}
              </span>
            </div>
            {data?.drift && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Drift from target</span>
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    data.drift.rebalanceRequired ? 'text-amber-600' : 'text-gray-900'
                  }`}
                >
                  {data.drift.maxAbsoluteDrift.toFixed(2)} pts
                </span>
              </div>
            )}
            <Link
              href="/retirement-vault/allocator"
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 pt-1"
            >
              Expert Allocator <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
