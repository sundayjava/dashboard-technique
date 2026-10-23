'use client';

import Link from 'next/link';
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import {
  CLASS_LABELS, MODE_LABELS, PROFILE_LABELS, money, moneyShort, useVault,
} from '@/components/retirement-vault/VaultContext';

/** Overview: the headline numbers, then routes into the detail pages. */
export default function VaultOverviewPage() {
  const { data } = useVault();
  const vault = data?.vault;
  const valuation = data?.valuation;
  if (!vault) return null;

  const gain = valuation?.unrealisedGainLoss ?? 0;
  const up = gain >= 0;
  const benchmark = valuation?.benchmarkValue ?? null;
  const vsBenchmark = benchmark === null ? null : (valuation?.totalValue ?? 0) - benchmark;

  const topClasses = Object.entries(valuation?.currentAllocation ?? {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Hero figure — the one number the page leads with. */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <p className="text-sm text-gray-500">Vault value</p>
        <p className="text-4xl font-bold text-gray-900 mt-1 tabular-nums">
          {money(valuation?.totalValue ?? 0)}
        </p>
        <div className="flex items-center gap-2 mt-2">
          {up ? (
            <TrendingUp className="w-4 h-4 text-green-600" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-600" />
          )}
          <span className={`text-sm font-medium ${up ? 'text-green-600' : 'text-red-600'}`}>
            {up ? '+' : ''}
            {money(gain)} ({valuation?.unrealisedGainLossPercent.toFixed(2) ?? '0.00'}%)
          </span>
          <span className="text-sm text-gray-400">since inception</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ['Contributed', moneyShort(vault.totalContributed)],
          ['Invested', moneyShort(valuation?.holdingsValue ?? 0)],
          ['Uninvested cash', moneyShort(vault.cashBalance)],
          [
            'vs 401k',
            vsBenchmark === null
              ? '—'
              : `${vsBenchmark >= 0 ? '+' : '−'}${moneyShort(Math.abs(vsBenchmark))}`,
          ],
        ].map(([label, value], i) => (
          <div key={label} className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p
              className={`text-xl font-bold mt-1 tabular-nums ${
                i === 3 && vsBenchmark !== null
                  ? vsBenchmark >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                  : 'text-gray-900'
              }`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Plan at a glance */}
      <div className="bg-white rounded-lg shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Your plan</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ['Risk profile', PROFILE_LABELS[vault.riskProfile] ?? vault.riskProfile],
            ['Allocation mode', MODE_LABELS[vault.allocationMode] ?? vault.allocationMode],
            ['Horizon', vault.horizon.replace('YEARS_', '').replace('_PLUS', '+') + ' years'],
            [
              'Monthly',
              vault.monthlyContribution ? moneyShort(vault.monthlyContribution) : 'Not set',
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Allocation snapshot, with the detail one click away */}
      <div className="bg-white rounded-lg shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Allocation</h2>
          <Link
            href="/retirement-vault/allocation"
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900"
          >
            View detail <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {topClasses.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nothing invested yet.{' '}
            <Link href="/retirement-vault/contributions" className="underline">
              Fund your vault
            </Link>{' '}
            to buy your allocation.
          </p>
        ) : (
          <div className="space-y-2">
            {topClasses.map(([cls, pct]) => (
              <div key={cls}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-700">{CLASS_LABELS[cls] ?? cls}</span>
                  <span className="text-gray-900 font-medium tabular-nums">
                    {pct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#c1ff72] rounded-full"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {data?.drift?.rebalanceRequired && (
        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-amber-400">
          <p className="text-sm font-semibold text-gray-900">Your allocation has drifted</p>
          <p className="text-sm text-gray-600 mt-1">
            The largest class is {data.drift.maxAbsoluteDrift.toFixed(1)} points from its target.
            It will be brought back in line at the next review.
          </p>
          <Link
            href="/retirement-vault/allocator"
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 mt-2"
          >
            See the allocator <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
