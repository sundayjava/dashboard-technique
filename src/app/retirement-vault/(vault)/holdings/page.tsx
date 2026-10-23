'use client';

import { Wallet } from 'lucide-react';
import { CLASS_LABELS, money, useVault } from '@/components/retirement-vault/VaultContext';

/** Every position, with units, price, value and return. */
export default function VaultHoldingsPage() {
  const { data } = useVault();
  const holdings = data?.valuation?.holdings ?? [];
  const totalValue = data?.valuation?.holdingsValue ?? 0;

  if (holdings.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">
          Nothing invested yet. Fund your vault to buy your allocation.
        </p>
      </div>
    );
  }

  const totalCost = holdings.reduce((s, h) => s + h.costBasis, 0);
  const totalGain = totalValue - totalCost;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          ['Positions', String(holdings.length)],
          ['Market value', money(totalValue)],
          ['Cost basis', money(totalCost)],
        ].map(([label, value]) => (
          <div key={label} className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-lg font-bold text-gray-900 mt-1 tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Holdings</h2>
          <span
            className={`text-sm font-medium ${totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {totalGain >= 0 ? '+' : ''}
            {money(totalGain)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left font-medium px-5 py-3">Asset</th>
                <th className="text-right font-medium px-5 py-3">Units</th>
                <th className="text-right font-medium px-5 py-3">Price</th>
                <th className="text-right font-medium px-5 py-3">Cost</th>
                <th className="text-right font-medium px-5 py-3">Value</th>
                <th className="text-right font-medium px-5 py-3">Return</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {holdings.map((h) => (
                <tr key={h.symbol}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{h.symbol}</p>
                    <p className="text-xs text-gray-500">
                      {CLASS_LABELS[h.assetClass] ?? h.assetClass}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600 font-mono text-xs tabular-nums">
                    {h.units.toFixed(6)}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600 tabular-nums">
                    {money(h.price)}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-500 tabular-nums">
                    {money(h.costBasis)}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900 tabular-nums">
                    {money(h.value)}
                  </td>
                  <td
                    className={`px-5 py-3 text-right font-medium tabular-nums ${
                      h.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {h.gainLoss >= 0 ? '+' : ''}
                    {h.gainLossPercent.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100">
          Priced at the most recent close. Values update after the nightly sync.
        </p>
      </div>
    </div>
  );
}
