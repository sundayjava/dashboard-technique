'use client';

import { CLASS_LABELS, useVault } from '@/components/retirement-vault/VaultContext';
import AllocationDoughnut from '@/components/retirement-vault/AllocationDoughnut';
import AllocationModeCard from '@/components/retirement-vault/AllocationModeCard';
import InvestPanel from '@/components/retirement-vault/InvestPanel';
import ExpertToggle from '@/components/retirement-vault/ExpertToggle';

/** Composition, target comparison and the mode toggle. */
export default function VaultAllocationPage() {
  const { data, refresh } = useVault();
  const valuation = data?.valuation;
  const target = data?.targetAllocation ?? {};
  const drift = data?.drift;

  return (
    <div className="space-y-5">
      <ExpertToggle onChanged={refresh} />

      <InvestPanel onInvested={refresh} />

      <AllocationDoughnut
        allocation={valuation?.currentAllocation ?? {}}
        totalValue={valuation?.holdingsValue ?? 0}
        targetAllocation={target}
      />

      {/* Actual against target — the comparison a doughnut cannot make. */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Against your target</h2>
          {drift?.rebalanceRequired && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
              Drifted {drift.maxAbsoluteDrift.toFixed(1)} pts
            </span>
          )}
        </div>

        <div className="space-y-3">
          {Object.entries(target)
            .filter(([, t]) => t > 0)
            .map(([cls, t]) => {
              const current = valuation?.currentAllocation?.[cls] ?? 0;
              return (
                <div key={cls}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-700">{CLASS_LABELS[cls] ?? cls}</span>
                    <span className="text-gray-500 tabular-nums">
                      {current.toFixed(1)}%{' '}
                      <span className="text-gray-400">/ {t.toFixed(0)}% target</span>
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-[#c1ff72] rounded-full"
                      style={{ width: `${Math.min(100, current)}%` }}
                    />
                    <div
                      className="absolute top-0 h-full w-0.5 bg-gray-900"
                      style={{ left: `${Math.min(100, t)}%` }}
                      title={`Target ${t}%`}
                    />
                  </div>
                </div>
              );
            })}
        </div>
        <p className="text-xs text-gray-400 mt-4">
          The dark marker is your target. Crypto is capped at 5% in every mode.
        </p>
      </div>

      <AllocationModeCard onChanged={refresh} />
    </div>
  );
}
