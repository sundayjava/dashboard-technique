'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { money, useVault } from '@/components/retirement-vault/VaultContext';
import AutoContributionCard from '@/components/retirement-vault/AutoContributionCard';
import VaultDepositModal from '@/components/retirement-vault/VaultDepositModal';

/** Deposits, the monthly schedule and contribution history. */
export default function VaultContributionsPage() {
  const { data, refresh } = useVault();
  const [depositOpen, setDepositOpen] = useState(false);

  const vault = data?.vault;
  const contributions = data?.contributions ?? [];
  const pendingActivation = vault?.status === 'PENDING_ACTIVATION';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500">Available in your account</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">
            {money(data?.fundingAccount?.balance ?? 0)}
          </p>
          {data?.fundingAccount?.accountNumber && (
            <p className="text-xs text-gray-500 mt-0.5">
              {data.fundingAccount.accountNumber}
            </p>
          )}
        </div>
        <button
          onClick={() => setDepositOpen(true)}
          className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {pendingActivation ? 'Fund vault' : 'Deposit'}
        </button>
      </div>

      <AutoContributionCard onChanged={refresh} />

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Contribution history</h2>
        </div>

        {contributions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500">No contributions yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {contributions.map((c) => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 tabular-nums">
                    {money(c.amount)}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {c.type.replace(/_/g, ' ').toLowerCase()} ·{' '}
                    {new Date(c.processedAt ?? c.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded font-medium whitespace-nowrap ${
                    c.status === 'COMPLETED'
                      ? 'bg-green-50 text-green-700'
                      : c.status === 'FAILED'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {c.status.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <VaultDepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        onSuccess={refresh}
        accountBalance={data?.fundingAccount?.balance ?? 0}
        accountNumber={data?.fundingAccount?.accountNumber ?? null}
        isActivation={pendingActivation}
      />
    </div>
  );
}
