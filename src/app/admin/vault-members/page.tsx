'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ChevronRight, Loader2, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { classLabel } from '@/lib/vault/class-presentation';

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

interface Detail {
  vault: Record<string, unknown> & {
    vaultNumber: string;
    memberName: string | null;
    memberEmail: string;
    status: string;
    riskProfile: string;
    allocationMode: string;
    cashBalance: number;
    principal: number;
    accrued: number;
    value: number;
    totalContributed: number;
    totalWithdrawn: number;
  };
  classes: Array<{
    assetClass: string;
    targetPercent: number;
    principal: number;
    accrued: number;
    value: number;
    lastAccruedDate: string | null;
  }>;
  classNames: Record<string, string>;
  holdings: Array<{
    symbol: string;
    name: string;
    assetClass: string;
    units: number;
    costBasis: number;
    currentPrice: number;
  }>;
  contributions: Array<{
    type: string; amount: number; status: string;
    processedAt: string | null; createdAt: string;
  }>;
  withdrawals: Array<{
    amount: number; penaltyAmount: number; netAmount: number;
    status: string; requestedAt: string; processedAt: string | null;
  }>;
  accruals: Array<{
    assetClass: string; accrualDate: string; ratePercent: number;
    amount: number; openingValue: number; closingValue: number;
  }>;
}

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

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

  const open = async (id: string) => {
    setOpenId(id);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const res = await axios.get(`/api/admin/vault-members?id=${id}`);
      setDetail(res.data);
    } catch {
      toast.error('Could not load that vault.');
      setOpenId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

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
                    onClick={() => open(r.id)}
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

      {openId !== null && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">
                {detail?.vault.vaultNumber ?? 'Vault'}
              </h2>
              <button
                onClick={() => { setOpenId(null); setDetail(null); }}
                className="p-1 text-gray-400 hover:text-gray-900 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingDetail || detail === null ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
              </div>
            ) : (
              <div className="p-5 space-y-5">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {detail.vault.memberName ?? '—'}
                  </p>
                  <p className="text-xs text-gray-500">{detail.vault.memberEmail}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label="Principal" value={money(detail.vault.principal)} small />
                  <Stat label="Credited" value={money(detail.vault.accrued)} small />
                  <Stat label="Cash" value={money(detail.vault.cashBalance)} small />
                  <Stat label="Value" value={money(detail.vault.value)} small />
                </div>

                <Block title="Asset classes">
                  <Table head={['Class', 'Target', 'Principal', 'Credited', 'Value']}>
                    {detail.classes.map((c) => (
                      <tr key={c.assetClass} className="border-b border-gray-50">
                        <td className="px-3 py-2">{classLabel(c.assetClass, detail.classNames)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.targetPercent}%</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(c.principal)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(c.accrued)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {money(c.value)}
                        </td>
                      </tr>
                    ))}
                  </Table>
                </Block>

                {detail.holdings.length > 0 && (
                  <Block title="Holdings">
                    <Table head={['Instrument', 'Units', 'Cost basis', 'Last price']}>
                      {detail.holdings.map((h) => (
                        <tr key={h.symbol} className="border-b border-gray-50">
                          <td className="px-3 py-2">
                            <span className="font-medium">{h.symbol}</span>{' '}
                            <span className="text-gray-400 text-xs">{h.name}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {h.units.toFixed(6)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {money(h.costBasis)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {h.currentPrice > 0 ? money(h.currentPrice) : '—'}
                          </td>
                        </tr>
                      ))}
                    </Table>
                  </Block>
                )}

                {detail.accruals.length > 0 && (
                  <Block title="Recent daily credits">
                    <Table head={['Day', 'Class', 'Rate', 'Amount', 'Closing']}>
                      {detail.accruals.map((a, i) => (
                        <tr key={`${a.accrualDate}-${a.assetClass}-${i}`} className="border-b border-gray-50">
                          <td className="px-3 py-2 font-mono text-xs">
                            {String(a.accrualDate).slice(0, 10)}
                          </td>
                          <td className="px-3 py-2">{classLabel(a.assetClass, detail.classNames)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {a.ratePercent >= 0 ? '+' : ''}
                            {a.ratePercent.toFixed(4)}%
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(a.amount)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {money(a.closingValue)}
                          </td>
                        </tr>
                      ))}
                    </Table>
                  </Block>
                )}

                {detail.contributions.length > 0 && (
                  <Block title="Contributions">
                    <Table head={['Date', 'Type', 'Amount', 'Status']}>
                      {detail.contributions.map((c, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="px-3 py-2 font-mono text-xs">
                            {String(c.processedAt ?? c.createdAt).slice(0, 10)}
                          </td>
                          <td className="px-3 py-2">{c.type.replace(/_/g, ' ').toLowerCase()}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(c.amount)}</td>
                          <td className="px-3 py-2">{c.status.toLowerCase()}</td>
                        </tr>
                      ))}
                    </Table>
                  </Block>
                )}

                {detail.withdrawals.length > 0 && (
                  <Block title="Withdrawals">
                    <Table head={['Requested', 'Amount', 'Penalty', 'Net', 'Status']}>
                      {detail.withdrawals.map((w, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="px-3 py-2 font-mono text-xs">
                            {String(w.requestedAt).slice(0, 10)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(w.amount)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {money(w.penaltyAmount)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(w.netAmount)}</td>
                          <td className="px-3 py-2">{w.status.replace(/_/g, ' ').toLowerCase()}</td>
                        </tr>
                      ))}
                    </Table>
                  </Block>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  small = false,
  tone = 'plain',
}: {
  label: string;
  value: string;
  sub?: string;
  small?: boolean;
  tone?: 'plain' | 'amber';
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        tone === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-white'
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">{label}</p>
      <p
        className={`font-semibold tabular-nums mt-1 ${small ? 'text-base' : 'text-xl'} ${
          tone === 'amber' ? 'text-amber-900' : 'text-gray-900'
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
        {title}
      </h3>
      <div className="border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
        {children}
      </div>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100 bg-gray-50/60">
          {head.map((h, i) => (
            <th key={h} className={`font-medium px-3 py-2 ${i === 0 ? 'text-left' : 'text-right'}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}
