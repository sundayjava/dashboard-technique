'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { AlertCircle, CalendarClock, Check, Loader2, Pencil, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface HistoryRow {
  id: string;
  amount: number;
  status: string;
  failureReason: string | null;
  processedAt: string | null;
  createdAt: string;
}

interface Props {
  onChanged: () => void;
}

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ordinal = (n: number) => {
  const suffix = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
  return `${n}${suffix}`;
};

/**
 * Monthly auto-contribution: view, change, or stop.
 *
 * The most recent failure is surfaced prominently. A member whose contribution
 * silently stopped working would only find out from their balance, which is
 * exactly the wrong way to learn it.
 */
export default function AutoContributionCard({ onChanged }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('1');
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/retirement-vault/auto-contribution');
      setEnabled(res.data?.enabled ?? false);
      setAmount(res.data?.monthlyContribution ? String(res.data.monthlyContribution) : '');
      setDay(String(res.data?.monthlyContributionDay ?? 1));
      setHistory(res.data?.history ?? []);
    } catch {
      // A failure here should not break the dashboard around it.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (nextEnabled: boolean) => {
    setSaving(true);
    try {
      await axios.put('/api/retirement-vault/auto-contribution', {
        enabled: nextEnabled,
        amount: Number(amount),
        dayOfMonth: Number(day),
      });
      toast.success(nextEnabled ? 'Monthly contribution updated.' : 'Monthly contribution stopped.');
      setEditing(false);
      await load();
      onChanged();
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Could not update.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  const lastFailure = history.find((h) => h.status === 'FAILED');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Monthly contribution</h2>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 cursor-pointer"
          >
            <Pencil className="w-3 h-3" />
            {enabled ? 'Change' : 'Set up'}
          </button>
        )}
      </div>

      {lastFailure && (
        <div className="flex items-start gap-2 mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-900">
            {lastFailure.failureReason ?? 'A contribution could not be taken.'} We retry
            automatically before the month ends.
          </p>
        </div>
      )}

      {!editing ? (
        <div className="mt-3">
          {enabled ? (
            <p className="text-sm text-gray-900">
              <span className="font-semibold">{money(Number(amount))}</span> on the{' '}
              {ordinal(Number(day))} of each month, invested into your target allocation
              automatically.
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              Not set up. Regular contributions are the single biggest driver of a retirement
              outcome over time.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-gray-600 mb-1">Amount (USD)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={1}
                step={50}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                placeholder="500"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-gray-600 mb-1">Day of month</label>
              <select
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={String(d)}>
                    {ordinal(d)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Days are capped at the 28th so a contribution never skips February.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => save(true)}
              disabled={saving || !amount || Number(amount) <= 0}
              className="flex items-center gap-1 px-4 py-2 rounded-full bg-black text-white text-xs font-medium hover:bg-gray-800 cursor-pointer disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </button>
            <button
              onClick={() => {
                setEditing(false);
                load();
              }}
              disabled={saving}
              className="px-4 py-2 rounded-full border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            {enabled && (
              <button
                onClick={() => save(false)}
                disabled={saving}
                className="flex items-center gap-1 ml-auto px-4 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 cursor-pointer"
              >
                <X className="w-3 h-3" />
                Stop contributions
              </button>
            )}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">Recent contributions</p>
          <div className="space-y-1.5">
            {history.slice(0, 5).map((h) => (
              <div key={h.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-600">
                  {new Date(h.processedAt ?? h.createdAt).toLocaleDateString()}
                </span>
                <span className="text-gray-900">{money(h.amount)}</span>
                <span
                  className={`px-2 py-0.5 rounded font-medium ${
                    h.status === 'COMPLETED'
                      ? 'bg-green-50 text-green-700'
                      : h.status === 'FAILED'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {h.status.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
