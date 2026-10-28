'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useClassLabel } from './VaultContext';
import { Panel } from './VaultUI';

interface RebalanceEvent {
  id: string;
  trigger: string;
  explanation: string;
  executedAt: string | null;
  changes: Array<{ assetClass: string; fromPercent: number; toPercent: number }>;
}

/**
 * Every rebalance the vault has been through, and why.
 *
 * Lived on its own Expert Allocator page, which was two-thirds dead weight: a
 * status card that only told you to go elsewhere, and a pinning control beside
 * it. This is the part that was worth keeping, so it moved to the overview
 * rather than keeping a tab alive around it.
 *
 * Renders nothing until there IS a history. An empty "no rebalances yet" panel
 * on the landing page would cost every member space for a message that is true
 * for months and tells them nothing to act on. The exception is the thin-data
 * notice, which explains why an allocator that is switched ON is not tilting --
 * silence there reads as a broken feature.
 */
export default function RebalanceHistory() {
  const label = useClassLabel();
  const [events, setEvents] = useState<RebalanceEvent[]>([]);
  const [expertActive, setExpertActive] = useState(false);
  const [signalsAvailable, setSignalsAvailable] = useState(true);
  const [historyDays, setHistoryDays] = useState(0);
  const [historyRequired, setHistoryRequired] = useState(90);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/retirement-vault/rebalances');
      setEvents(res.data?.events ?? []);
      setExpertActive(res.data?.expertAllocatorActive ?? false);
      setSignalsAvailable(res.data?.signalsAvailable ?? true);
      setHistoryDays(res.data?.historyDays ?? 0);
      setHistoryRequired(res.data?.historyRequired ?? 90);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return null;

  const thinData = expertActive && !signalsAvailable;
  if (events.length === 0 && !thinData) return null;

  return (
    <Panel
      title="Rebalance history"
      action={
        events.length > 0 && (
          <span className="text-xs text-gray-400">
            {events.length} change{events.length === 1 ? '' : 's'}
          </span>
        )
      }
      padded={false}
    >
      {thinData && (
        <div className="mx-4 mb-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
          <p className="text-xs text-amber-900">
            Market signals need {historyRequired} days of price history and we hold{' '}
            {historyDays}. Until then your vault is kept at its plain profile target rather
            than tilted on data too thin to trust.
          </p>
        </div>
      )}

      {events.length > 0 && (
        <div className="divide-y divide-gray-100 border-t border-gray-100">
          {events.map((e) => (
            <div key={e.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="text-xs font-medium text-gray-900 capitalize">
                  {e.trigger.replace(/_/g, ' ').toLowerCase()}
                </span>
                <span className="text-xs text-gray-400">
                  {e.executedAt ? new Date(e.executedAt).toLocaleDateString() : '—'}
                </span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{e.explanation}</p>
              {e.changes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {e.changes.map((c) => {
                    const up = c.toPercent > c.fromPercent;
                    return (
                      <span
                        key={c.assetClass}
                        className={`text-[11px] px-2 py-0.5 rounded font-medium tabular-nums ${
                          up ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {label(c.assetClass)}{' '}
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
    </Panel>
  );
}
