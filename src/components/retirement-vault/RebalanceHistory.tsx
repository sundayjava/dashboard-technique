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
 * RENDERS NOTHING UNTIL THERE IS A HISTORY, with no exceptions. An empty panel
 * on the overview costs every member space for a message that stays true for
 * months and gives them nothing to act on.
 *
 * It used to make an exception for the thin-history notice, which in practice
 * meant a panel headed "Rebalance history" whose entire contents were a
 * disclaimer about price history -- and which read, reasonably, as a broken
 * feature. That sentence now sits on AllocationModeCard, beside the toggle it
 * is actually about.
 *
 * Empty is the correct state for a long time, and that is not a bug to paper
 * over: rebalances are quarterly, or sooner only if drift passes the policy
 * threshold (5 points). A vault opened this week has months to wait, and its
 * live drift is already on the overview's Position panel. scripts/
 * check_rebalance_due.ts prints why any given vault is not due, since "empty
 * because nothing qualified" and "empty because the sweep is not running" look
 * identical here.
 */
export default function RebalanceHistory() {
  const label = useClassLabel();
  const [events, setEvents] = useState<RebalanceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/retirement-vault/rebalances');
      setEvents(res.data?.events ?? []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || events.length === 0) return null;

  return (
    <Panel
      title="Rebalance history"
      action={
        <span className="text-xs text-gray-400">
          {events.length} change{events.length === 1 ? '' : 's'}
        </span>
      }
      padded={false}
    >
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
    </Panel>
  );
}
