'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, Pin, PinOff, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { CLASS_LABELS, useVault } from '@/components/retirement-vault/VaultContext';

interface RebalanceEvent {
  id: string;
  trigger: string;
  explanation: string;
  executedAt: string | null;
  changes: Array<{ assetClass: string; fromPercent: number; toPercent: number }>;
}

interface PinnedClass {
  assetClass: string;
  targetPercent: number;
}

/** Rebalance history, signal readiness, and per-class pinning. */
export default function VaultAllocatorPage() {
  const { data, refresh } = useVault();
  const [events, setEvents] = useState<RebalanceEvent[]>([]);
  const [pinned, setPinned] = useState<PinnedClass[]>([]);
  const [signalsAvailable, setSignalsAvailable] = useState(true);
  const [historyDays, setHistoryDays] = useState(0);
  const [historyRequired, setHistoryRequired] = useState(90);
  const [expertActive, setExpertActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/retirement-vault/rebalances');
      setEvents(res.data?.events ?? []);
      setPinned(res.data?.pinnedClasses ?? []);
      setSignalsAvailable(res.data?.signalsAvailable ?? true);
      setHistoryDays(res.data?.historyDays ?? 0);
      setHistoryRequired(res.data?.historyRequired ?? 90);
      setExpertActive(res.data?.expertAllocatorActive ?? false);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setPin = async (assetClass: string, pinnedState: boolean, percent?: number) => {
    setBusy(assetClass);
    try {
      await axios.put('/api/retirement-vault/rebalances', {
        assetClass,
        pinned: pinnedState,
        targetPercent: percent,
      });
      toast.success(pinnedState ? 'Allocation pinned.' : 'Allocation released.');
      await load();
      await refresh();
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Could not update.',
      );
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>
    );
  }

  const target = data?.targetAllocation ?? {};
  const pinnedSet = new Set(pinned.map((p) => p.assetClass));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Expert Allocator</h2>
          <span
            className={`text-xs px-2 py-0.5 rounded font-medium ${
              expertActive ? 'bg-[#e0ff57] text-black' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {expertActive ? 'active' : 'off'}
          </span>
        </div>
        <p className="text-sm text-gray-600">
          {expertActive
            ? 'Your vault is reviewed quarterly, and sooner if your allocation drifts beyond tolerance. Every change is explained below.'
            : 'Turn the Expert Allocator on from the Allocation page to have your vault managed and rebalanced for you.'}
        </p>

        {expertActive && !signalsAvailable && (
          <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-xs text-amber-900">
              Market signals need {historyRequired} days of price history and we hold{' '}
              {historyDays}. Until then your vault is kept at its plain profile target rather
              than tilted on data too thin to trust.
            </p>
          </div>
        )}
      </div>

      {/* Per-class pinning — overriding one allocation without leaving Expert mode. */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Pin an allocation</h2>
        <p className="text-xs text-gray-500 mb-4">
          A pinned class is held exactly where you put it and the allocator works around it.
          At least one class must stay unpinned.
        </p>

        <div className="space-y-2">
          {Object.entries(target)
            .filter(([, t]) => t > 0 || pinnedSet.has('CRYPTO'))
            .map(([cls, t]) => {
              const isPinned = pinnedSet.has(cls);
              return (
                <div key={cls} className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 flex-1 truncate">
                    {CLASS_LABELS[cls] ?? cls}
                  </span>
                  <input
                    type="number"
                    value={draft[cls] ?? t.toFixed(0)}
                    onChange={(e) => setDraft((d) => ({ ...d, [cls]: e.target.value }))}
                    min={0}
                    max={100}
                    className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right tabular-nums"
                  />
                  <span className="text-xs text-gray-400 w-3">%</span>
                  <button
                    onClick={() =>
                      setPin(cls, !isPinned, Number(draft[cls] ?? t))
                    }
                    disabled={busy === cls}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium cursor-pointer disabled:opacity-40 ${
                      isPinned
                        ? 'bg-gray-900 text-white hover:bg-gray-700'
                        : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {busy === cls ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : isPinned ? (
                      <PinOff className="w-3 h-3" />
                    ) : (
                      <Pin className="w-3 h-3" />
                    )}
                    {isPinned ? 'Unpin' : 'Pin'}
                  </button>
                </div>
              );
            })}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Rebalance history</h2>
        </div>

        {events.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500">
              No rebalances yet. Your vault is reviewed quarterly, and sooner if it drifts.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {events.map((e) => (
              <div key={e.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-xs font-medium text-gray-900 capitalize">
                    {e.trigger.replace(/_/g, ' ').toLowerCase()}
                  </span>
                  <span className="text-xs text-gray-400">
                    {e.executedAt ? new Date(e.executedAt).toLocaleDateString() : '—'}
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{e.explanation}</p>
                {e.changes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {e.changes.map((c) => {
                      const up = c.toPercent > c.fromPercent;
                      return (
                        <span
                          key={c.assetClass}
                          className={`text-xs px-2 py-1 rounded font-medium tabular-nums ${
                            up ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {CLASS_LABELS[c.assetClass] ?? c.assetClass}{' '}
                          {c.fromPercent.toFixed(1)}% → {c.toPercent.toFixed(1)}%
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
