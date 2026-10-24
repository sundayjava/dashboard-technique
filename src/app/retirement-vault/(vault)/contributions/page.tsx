'use client';

import { useState } from 'react';
import { Plus, Wallet } from 'lucide-react';
import { money, useVault } from '@/components/retirement-vault/VaultContext';
import { StatCard } from '@/components/retirement-vault/VaultUI';
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          tone="blue"
          icon={Wallet}
          label="Available in your account"
          value={money(data?.fundingAccount?.balance ?? 0)}
          sub={
            data?.fundingAccount?.accountNumber ? (
              <span className="text-xs text-white/70">
                {data.fundingAccount.accountNumber}
              </span>
            ) : undefined
          }
        />
        <div className="bg-[#c1ff72] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs text-black/60">Add to your vault</p>
            <p className="text-sm text-black/80 mt-1">
              {pendingActivation
                ? 'Your first deposit activates the vault and buys your allocation.'
                : 'Deposits are invested into your target allocation immediately.'}
            </p>
          </div>
          <button
            onClick={() => setDepositOpen(true)}
            className="mt-4 self-start flex items-center gap-2 bg-black text-[#c1ff72] px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-85 transition-opacity cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {pendingActivation ? 'Fund vault' : 'Deposit'}
          </button>
        </div>
      </div>

      <AutoContributionCard onChanged={refresh} />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
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
