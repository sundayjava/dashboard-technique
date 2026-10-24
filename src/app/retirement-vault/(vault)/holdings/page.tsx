'use client';

import { useState } from 'react';
import { Coins, Wallet } from 'lucide-react';
import { CLASS_LABELS, money, useVault } from '@/components/retirement-vault/VaultContext';
import {
  AssetIcon, Panel, SegmentedControl, StatCard, Trend,
} from '@/components/retirement-vault/VaultUI';

type View = 'all' | 'winners' | 'losers';

/** Every position, with units, price, value and return. */
export default function VaultHoldingsPage() {
  const { data } = useVault();
  const [view, setView] = useState<View>('all');

  const all = data?.valuation?.holdings ?? [];
  const totalValue = data?.valuation?.holdingsValue ?? 0;

  if (all.length === 0) {
    return (
      <Panel>
        <div className="py-12 text-center">
          <Wallet className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            Nothing invested yet. Fund your vault to buy your allocation.
          </p>
        </div>
      </Panel>
    );
  }

  const totalCost = all.reduce((s, h) => s + h.costBasis, 0);
  const totalGain = totalValue - totalCost;
  const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  const holdings =
    view === 'winners'
      ? all.filter((h) => h.gainLoss >= 0)
      : view === 'losers'
        ? all.filter((h) => h.gainLoss < 0)
        : all;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          tone="blue"
          icon={Wallet}
          label="Market value"
          value={money(totalValue)}
          sub={<span className="text-xs text-white/80">{all.length} positions</span>}
        />
        <StatCard tone="plain" icon={Coins} label="Cost basis" value={money(totalCost)} />
        <StatCard
          tone="lime"
          label="Unrealised gain"
          value={`${totalGain >= 0 ? '+' : '−'}${money(Math.abs(totalGain))}`}
          sub={
            <span className="text-xs text-black/60">
              {totalGainPercent >= 0 ? '+' : ''}
              {totalGainPercent.toFixed(2)}% on cost
            </span>
          }
        />
      </div>

      <Panel
        title="Holdings"
        padded={false}
        action={
          <SegmentedControl<View>
            value={view}
            onChange={setView}
            options={[
              { value: 'all', label: 'All' },
              { value: 'winners', label: 'Up' },
              { value: 'losers', label: 'Down' },
            ]}
          />
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-gray-400">
                <th className="text-left font-medium px-5 py-3">Asset</th>
                <th className="text-right font-medium px-5 py-3">Units</th>
                <th className="text-right font-medium px-5 py-3">Price</th>
                <th className="text-right font-medium px-5 py-3">Value</th>
                <th className="text-right font-medium px-5 py-3">Return</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr key={h.symbol} className="border-t border-gray-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <AssetIcon symbol={h.symbol} assetClass={h.assetClass} />
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{h.symbol}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {CLASS_LABELS[h.assetClass] ?? h.assetClass}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right text-gray-500 font-mono text-xs tabular-nums">
                    {h.units.toFixed(6)}
                  </td>
                  <td className="px-5 py-4 text-right text-gray-600 tabular-nums">
                    {money(h.price)}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-gray-900 tabular-nums">
                    {money(h.value)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Trend value={h.gainLossPercent} />
                  </td>
                </tr>
              ))}
              {holdings.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-500">
                    No positions are {view === 'winners' ? 'up' : 'down'} right now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="px-5 py-4 text-xs text-gray-400 border-t border-gray-50">
          Priced at the most recent close. Values update after the nightly sync.
        </p>
      </Panel>
    </div>
  );
}
