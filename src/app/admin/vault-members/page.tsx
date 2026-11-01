'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { ChevronRight, Loader2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { Stat, money } from '@/components/admin/VaultMemberUI';

interface Row {
  id: string;
  vaultNumber: string;
  status: string;
  riskProfile: string;
  allocationMode: string;
  memberName: string | null;
  memberEmail: string;
  cashBalance: number;
  principal: number;
  accrued: number;
  value: number;
  totalContributed: number;
  totalWithdrawn: number;
  createdAt: string;
  lastValuedAt: string | null;
}

interface Totals {
  vaults: number;
  principal: number;
  accrued: number;
  cash: number;
  value: number;
  contributed: number;
  withdrawn: number;
}

/**
 * Member vaults, for an admin.
 *
 * Two jobs. Looking a member up, so a question about a balance can be
 * answered. And the figure nothing else in the product shows: credited
 * performance across the whole book. That is withdrawable cash the platform
 * owes but no member paid in, so it is a liability, and it grows every night
 * the daily engine runs.
 */
export default function AdminVaultMembersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/admin/vault-members');
      setRows(res.data?.rows ?? []);
      setTotals(res.data?.totals ?? null);
    } catch {
      toast.error('Could not load member vaults.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? rows.filter(
        (r) =>
          r.vaultNumber.toLowerCase().includes(needle) ||
          r.memberEmail.toLowerCase().includes(needle) ||
          (r.memberName ?? '').toLowerCase().includes(needle),
      )
    : rows;

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Member vaults</h1>
        <p className="text-sm text-gray-600 mt-1">
          Every vault, what it holds and what has been credited to it.
        </p>
      </div>

      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Vaults" value={String(totals.vaults)} />
          <Stat label="Member principal" value={money(totals.principal)} sub="What members paid in and invested" />
          <Stat
            label="Credited performance"
            value={money(totals.accrued)}
            sub="Owed to members, funded by the platform"
            tone={totals.accrued > 0 ? 'amber' : 'plain'}
          />
          <Stat label="Total vault value" value={money(totals.value)} sub="Principal + credited + cash" />
        </div>
      )}

      {totals && totals.accrued > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-900">
            <span className="font-semibold">{money(totals.accrued)}</span> of credited performance
            is withdrawable cash that no member paid in. It is funded by the platform, and the
            daily engine adds to it every night it runs.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by vault number, name or email"
            className="flex-1 text-sm outline-none"
          />
          <span className="text-xs text-gray-400 tabular-nums">
            {visible.length} of {rows.length}
          </span>
        </div>

        {visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">No vaults match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="text-left font-medium px-5 py-2">Member</th>
                  <th className="text-left font-medium px-3 py-2">Status</th>
                  <th className="text-right font-medium px-3 py-2">Contributed</th>
                  <th className="text-right font-medium px-3 py-2">Credited</th>
                  <th className="text-right font-medium px-3 py-2">Value</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/admin/vault-members/${r.id}`)}
                    onMouseEnter={() => router.prefetch(`/admin/vault-members/${r.id}`)}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{r.memberName ?? r.memberEmail}</p>
                      <p className="text-xs text-gray-400 font-mono">{r.vaultNumber}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        {r.status.replace(/_/g, ' ').toLowerCase()}
                      </span>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {r.riskProfile.toLowerCase()} · {r.allocationMode.replace(/_/g, ' ').toLowerCase()}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-900">
                      {money(r.totalContributed)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right tabular-nums font-medium ${
                        r.accrued > 0.004
                          ? 'text-emerald-700'
                          : r.accrued < -0.004
                            ? 'text-red-600'
                            : 'text-gray-400'
                      }`}
                    >
                      {r.accrued === 0 ? '—' : money(r.accrued)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-gray-900">
                      {money(r.value)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-gray-300 inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
