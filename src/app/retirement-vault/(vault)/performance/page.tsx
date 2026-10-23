'use client';

import PerformanceChart from '@/components/retirement-vault/PerformanceChart';

/** Vault value against the traditional 401k comparator. */
export default function VaultPerformancePage() {
  return (
    <div className="space-y-6">
      <PerformanceChart />
    </div>
  );
}
