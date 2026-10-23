'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, Minus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { money, useVault } from '@/components/retirement-vault/VaultContext';
import VaultWithdrawModal from '@/components/retirement-vault/VaultWithdrawModal';

interface WithdrawalRow {
  id: string;
  amount: number;
  penaltyAmount: number;
  netAmount: number;
  isEarlyWithdrawal: boolean;
  status: string;
  requestedAt: string;
  noticeEndsAt: string;
  canCancel: boolean;
}

/** Request, track and cancel withdrawals. */
export default function VaultWithdrawalsPage() {
  const { data, refresh } = useVault();
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [available, setAvailable] = useState(0);
  const [committed, setCommitted] = useState(0);
  const [noticeDays, setNoticeDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/retirement-vault/withdraw');
      setRows(res.data?.requests ?? []);
      setAvailable(res.data?.availableToWithdraw ?? 0);
      setCommitted(res.data?.committedToOpenRequests ?? 0);
      setNoticeDays(res.data?.noticePeriodDays ?? 14);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = async (id: string) => {
    try {
      await axios.delete(`/api/retirement-vault/withdraw?id=${id}`);
      toast.success('Request cancelled.');
      await load();
      await refresh();
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Could not cancel.',
      );
    }
  };

  const active = data?.vault?.status === 'ACTIVE';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500">Available to withdraw</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{money(available)}</p>
          {committed > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              {money(committed)} committed to open requests
            </p>
          )}
        </div>
        <button
          onClick={() => setOpen(true)}
          disabled={!active || available <= 0}
          title={active ? undefined : 'Your vault must be active to withdraw'}
          className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Minus className="w-4 h-4" />
          Request withdrawal
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-xs text-amber-900">
          Withdrawals serve a {noticeDays}-day notice period before funds are released, and
          withdrawing before your retirement horizon carries a penalty. You can cancel at any
          point before release.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Your requests</h2>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500">No withdrawal requests.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((w) => (
              <div key={w.id} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 tabular-nums">
                      {money(w.amount)}
                    </span>
                    {w.penaltyAmount > 0 && (
                      <span className="text-xs text-red-600 tabular-nums">
                        −{money(w.penaltyAmount)} penalty
                      </span>
                    )}
                    <span className="text-xs text-gray-500 tabular-nums">
                      you receive {money(w.netAmount)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {w.status === 'PENDING_NOTICE'
                      ? `Released after ${new Date(w.noticeEndsAt).toLocaleDateString()}`
                      : `Requested ${new Date(w.requestedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded font-medium whitespace-nowrap ${
                    w.status === 'PAID'
                      ? 'bg-green-50 text-green-700'
                      : w.status === 'CANCELLED' || w.status === 'REJECTED'
                        ? 'bg-gray-100 text-gray-500'
                        : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {w.status.replace(/_/g, ' ').toLowerCase()}
                </span>
                {w.canCancel && (
                  <button
                    onClick={() => cancel(w.id)}
                    title="Cancel this request"
                    className="text-gray-400 hover:text-red-600 cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <VaultWithdrawModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={async () => {
          await load();
          await refresh();
        }}
        availableToWithdraw={available}
      />
    </div>
  );
}
