'use client';

import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Table2 } from 'lucide-react';
import { classColor, classLabel } from '@/lib/vault/class-presentation';

/**
 * Allocation composition.
 *
 * Palette is the validated six-slot categorical set (blue, orange, aqua,
 * yellow, magenta, green) in fixed order — assigned per asset class, never
 * cycled, so a class keeps its colour whatever else is on screen.
 *
 * Three of those slots sit below 3:1 against a light surface, which obliges
 * the "relief rule": every segment carries a visible direct label in the
 * legend AND a table view is available, so identity is never colour-alone.
 */

const CHART_SURFACE = '#ffffff';

/** Fixed slot order. Index is the asset class's position, never its rank. */
interface Props {
  allocation: Record<string, number>;
  totalValue: number;
  targetAllocation?: Record<string, number>;
  /**
   * Uninvested cash, shown as its own segment.
   *
   * Without it the ring is a share of INVESTED value while the target bars
   * beside it are a share of the vault, so the same asset appeared twice on
   * one page with two different percentages.
   */
  cashBalance?: number;
}

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Slice {
  assetClass: string;
  label: string;
  percent: number;
  value: number;
  color: string;
  target: number | null;
  /** Recharts v3 requires data rows to be index-signature compatible. */
  [key: string]: string | number | null;
}

export default function AllocationDoughnut({
  allocation,
  totalValue,
  targetAllocation,
  cashBalance = 0,
}: Props) {
  const [showTable, setShowTable] = useState(false);

  const vaultTotal = totalValue + cashBalance;

  const slices: Slice[] = Object.entries(allocation)
    .filter(([, percent]) => percent > 0)
    .map(([assetClass, percent]) => {
      const value = (totalValue * percent) / 100;
      return {
        assetClass,
        label: classLabel(assetClass),
        percent: vaultTotal > 0 ? (value / vaultTotal) * 100 : 0,
        value,
        color: classColor(assetClass),
        target: targetAllocation?.[assetClass] ?? null,
      };
    })
    .sort((a, b) => b.percent - a.percent);

  if (cashBalance > 0.004 && vaultTotal > 0) {
    slices.push({
      assetClass: 'CASH',
      label: 'Uninvested cash',
      percent: (cashBalance / vaultTotal) * 100,
      value: cashBalance,
      color: '#9ca3af',
      target: null,
    });
  }

  if (slices.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <p className="text-sm text-gray-500">
          Nothing invested yet. Fund your vault to see your allocation.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Allocation</h2>
        <button
          onClick={() => setShowTable((v) => !v)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 cursor-pointer"
        >
          <Table2 className="w-3 h-3" />
          {showTable ? 'Chart' : 'Table'}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-gray-500">
              <tr>
                <th className="text-left font-medium py-2">Asset class</th>
                <th className="text-right font-medium py-2">Share</th>
                {targetAllocation && <th className="text-right font-medium py-2">Target</th>}
                <th className="text-right font-medium py-2">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {slices.map((s) => (
                <tr key={s.assetClass}>
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: s.color }}
                        aria-hidden
                      />
                      <span className="text-gray-900">{s.label}</span>
                    </span>
                  </td>
                  <td className="py-2 text-right text-gray-900">{s.percent.toFixed(1)}%</td>
                  {targetAllocation && (
                    <td className="py-2 text-right text-gray-500">
                      {s.target === null ? '—' : `${s.target.toFixed(0)}%`}
                    </td>
                  )}
                  <td className="py-2 text-right text-gray-900">{money(s.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative w-[200px] h-[200px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="percent"
                  nameKey="label"
                  innerRadius={62}
                  outerRadius={94}
                  startAngle={90}
                  endAngle={-270}
                  /* 2px surface gap between touching segments, drawn in the
                     surface colour rather than as a border. */
                  paddingAngle={1}
                  stroke={CHART_SURFACE}
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {slices.map((s) => (
                    <Cell key={s.assetClass} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                  formatter={(value) => `${Number(value).toFixed(1)}%`}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Hero figure in the hole: the number the view leads with. */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-gray-500">Vault</span>
              <span className="text-lg font-bold text-gray-900">
                ${Math.round(vaultTotal).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Legend with direct labels — identity is never colour alone. */}
          <div className="flex-1 w-full space-y-2">
            {slices.map((s) => (
              <div key={s.assetClass} className="flex items-center gap-2 text-sm">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
                <span className="text-gray-700 flex-1 truncate">{s.label}</span>
                <span className="text-gray-900 font-medium tabular-nums">
                  {s.percent.toFixed(1)}%
                </span>
                <span className="text-gray-500 tabular-nums w-24 text-right">
                  {money(s.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
