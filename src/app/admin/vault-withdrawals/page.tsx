'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Check, Clock, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface WithdrawalRow {
  id: string;
  vaultNumber: string;
  memberName: string | null;
  memberEmail: string;
  amount: number;
  penaltyPercent: number;
  penaltyAmount: number;
  penaltyWaived: boolean;
  netAmount: number;
  isEarlyWithdrawal: boolean;
  status: string;
  reason: string | null;
  requestedAt: string;
  noticeEndsAt: string;
  noticeElapsed: boolean;
  adminNotes: string | null;
}

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_STYLES: Record<string, string> = {
  PENDING_NOTICE: 'bg-amber-50 text-amber-700',
  NOTICE_SERVED: 'bg-blue-50 text-blue-700',
  PENDING_ADMIN: 'bg-blue-50 text-blue-700',
  APPROVED: 'bg-blue-50 text-blue-700',
  PAID: 'bg-green-50 text-green-700',
  REJECTED: 'bg-red-50 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export default function AdminVaultWithdrawalsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/admin/vault-withdrawals');
      setRows(res.data?.requests ?? []);
      if (res.data?.promotedFromNotice > 0) {
        toast.success(`${res.data.promotedFromNotice} request(s) completed their notice period.`);
      }
    } catch {
      toast.error('Could not load withdrawals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, action: 'pay' | 'reject' | 'waive-penalty') => {
    if (action === 'pay' && !confirm('Pay this withdrawal? Units will be sold and the member credited.')) {
      return;
    }
    setActing(id);
    try {
      const res = await axios.put('/api/admin/vault-withdrawals', {
        id,
        action,
        adminNotes: notes[id]?.trim() || undefined,
      });
      toast.success(
        action === 'pay'
          ? `Paid ${money(res.data.netPaid)}.`
          : action === 'reject'
            ? 'Request rejected.'
            : 'Penalty waived.',
      );
      await load();
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Action failed.',
      );
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const open = rows.filter((r) =>
    ['PENDING_NOTICE', 'NOTICE_SERVED', 'PENDING_ADMIN', 'APPROVED'].includes(r.status),
  );
  const closed = rows.filter((r) => !open.includes(r));

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Vault withdrawals</h1>
        <p className="text-sm text-gray-600 mt-1">
          Requests serve a notice period before they can be paid. Paying sells units
          proportionally across the member&apos;s holdings, so their allocation is unchanged.
        </p>
      </div>

      {open.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-10 text-center">
          <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No open withdrawal requests.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {open.map((r) => {
            const payable = r.noticeElapsed && r.status !== 'PENDING_NOTICE';
            return (
              <div key={r.id} className="bg-white rounded-lg shadow-sm p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-bold text-gray-900">{money(r.amount)}</span>
                      <span className={`text-xs px-2 py-1 rounded font-medium ${STATUS_STYLES[r.status] ?? 'bg-gray-100'}`}>
                        {r.status.replace(/_/g, ' ').toLowerCase()}
                      </span>
                      {r.isEarlyWithdrawal && (
                        <span className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          early
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-1">
                      {r.memberName ?? r.memberEmail} · {r.vaultNumber}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Requested {new Date(r.requestedAt).toLocaleDateString()} · notice
                      {r.noticeElapsed ? ' elapsed ' : ' ends '}
                      {new Date(r.noticeEndsAt).toLocaleDateString()}
                    </p>
                    {r.reason && (
                      <p className="text-xs text-gray-600 mt-2 italic">&ldquo;{r.reason}&rdquo;</p>
                    )}
                  </div>

                  <div className="text-right text-sm">
                    <p className="text-gray-500 text-xs">Penalty</p>
                    <p className={r.penaltyWaived ? 'text-gray-400 line-through' : 'text-red-600 font-medium'}>
                      {money(r.penaltyAmount)} ({r.penaltyPercent}%)
                    </p>
                    <p className="text-gray-500 text-xs mt-2">Member receives</p>
                    <p className="font-bold text-gray-900">{money(r.netAmount)}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={notes[r.id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    placeholder="Notes (shown to the member on rejection)"
                    className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  {!r.penaltyWaived && r.penaltyAmount > 0 && (
                    <button
                      onClick={() => act(r.id, 'waive-penalty')}
                      disabled={acting === r.id}
                      className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 cursor-pointer disabled:opacity-40"
                    >
                      Waive penalty
                    </button>
                  )}
                  <button
                    onClick={() => act(r.id, 'reject')}
                    disabled={acting === r.id}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 cursor-pointer disabled:opacity-40"
                  >
                    <X className="w-3 h-3" />
                    Reject
                  </button>
                  <button
                    onClick={() => act(r.id, 'pay')}
                    disabled={acting === r.id || !payable}
                    title={payable ? undefined : 'The notice period has not elapsed yet'}
                    className="flex items-center gap-1 px-4 py-2 rounded-lg bg-black text-white text-xs font-medium hover:bg-gray-800 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {acting === r.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    Pay {money(r.netAmount)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {closed.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">History</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {closed.map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900">
                    {money(r.amount)} · {r.memberName ?? r.memberEmail}
                  </p>
                  <p className="text-xs text-gray-500">
                    {r.vaultNumber} · {new Date(r.requestedAt).toLocaleDateString()}
                    {r.adminNotes ? ` · ${r.adminNotes}` : ''}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded font-medium whitespace-nowrap ${STATUS_STYLES[r.status] ?? 'bg-gray-100'}`}>
                  {r.status.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
