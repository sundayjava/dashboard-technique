'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { AssetIcon, Panel } from './VaultUI';

interface MarketRow {
  symbol: string;
  name: string;
  assetClass: string;
  price: number;
  performance: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  previousClose: number | null;
  live: boolean;
  asOf: string | null;
}

/**
 * The market board.
 *
 * Shows what the assets we track are doing, and has nothing to do with the
 * member's allocation: an asset appears here whether or not they hold any of
 * it, and adding an asset class in admin does not change this list.
 *
 * Compact by design -- it sits under the allocation on the overview, so it
 * uses 12px type, tight rows and a horizontal scroll on narrow screens
 * rather than a second full-height table.
 */
export default function MarketTable() {
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Flash a row when its price moves, so "live" is visible rather than claimed.
  const [moved, setMoved] = useState<Record<string, 'up' | 'down'>>({});
  const previous = useRef<Record<string, number>>({});

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/retirement-vault/market');
      const next: MarketRow[] = res.data.assets ?? [];

      const changes: Record<string, 'up' | 'down'> = {};
      for (const row of next) {
        const before = previous.current[row.symbol];
        if (before !== undefined && before !== row.price) {
          changes[row.symbol] = row.price > before ? 'up' : 'down';
        }
        previous.current[row.symbol] = row.price;
      }
      setRows(next);
      setFailed(false);
      if (Object.keys(changes).length > 0) {
        setMoved(changes);
        setTimeout(() => setMoved({}), 1200);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    // Stop polling a board nobody is looking at.
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  if (loading) {
    return (
      <Panel title="Market">
        <p className="text-xs text-gray-400">Loading market data…</p>
      </Panel>
    );
  }

  if (failed || rows.length === 0) {
    return (
      <Panel title="Market">
        <p className="text-xs text-gray-400">
          {failed ? 'Market data is unavailable right now.' : 'No assets are being tracked yet.'}
        </p>
      </Panel>
    );
  }

  const anyLive = rows.some((r) => r.live);
  // Only show a column some asset can actually fill. A column of dashes
  // spends width to say nothing.
  const showHighLow = rows.some((r) => r.high !== null || r.low !== null);
  const showVolume = rows.some((r) => r.volume !== null);

  return (
    <Panel
      title="Market"
      padded={false}
      action={
        <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
          {anyLive && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" aria-hidden />
          )}
          {anyLive ? 'Live · 30s' : 'Latest close'}
        </span>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-gray-400">
              <th className="text-left font-medium px-4 py-2">Asset</th>
              <th className="text-right font-medium px-3 py-2">Price</th>
              <th className="text-right font-medium px-3 py-2">Performance</th>
              {showHighLow && (
                <>
                  <th className="text-right font-medium px-3 py-2 hidden sm:table-cell">High</th>
                  <th className="text-right font-medium px-3 py-2 hidden sm:table-cell">Low</th>
                </>
              )}
              {showVolume && (
                <th className="text-right font-medium px-4 py-2 hidden lg:table-cell">Volume</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.symbol}
                className={`border-t border-gray-50 transition-colors duration-500 ${
                  moved[r.symbol] === 'up'
                    ? 'bg-green-50'
                    : moved[r.symbol] === 'down'
                      ? 'bg-red-50'
                      : ''
                }`}
              >
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <AssetIcon symbol={r.symbol} assetClass={r.assetClass} size="sm" />
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 leading-tight">{r.symbol}</p>
                      <p className="text-[10px] text-gray-400 truncate max-w-[9rem]">{r.name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-semibold text-gray-900 tabular-nums">
                  {price(r.price)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.performance === null ? (
                    <span className="text-gray-300">—</span>
                  ) : (
                    <span
                      className={`font-medium ${
                        r.performance >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {r.performance >= 0 ? '+' : ''}
                      {r.performance.toFixed(2)}%
                    </span>
                  )}
                </td>
                {showHighLow && (
                  <>
                    <td className="px-3 py-2 text-right text-gray-500 tabular-nums hidden sm:table-cell">
                      {r.high === null ? <span className="text-gray-300">—</span> : price(r.high)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500 tabular-nums hidden sm:table-cell">
                      {r.low === null ? <span className="text-gray-300">—</span> : price(r.low)}
                    </td>
                  </>
                )}
                {showVolume && (
                  <td className="px-4 py-2 text-right text-gray-500 tabular-nums hidden lg:table-cell">
                    {r.volume === null ? <span className="text-gray-300">—</span> : compact(r.volume)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-gray-400 px-4 py-2 border-t border-gray-50">
        Market prices for the assets this vault tracks. Not your holdings.
        {!anyLive && ' Equity prices are the latest daily close.'}
      </p>
    </Panel>
  );
}

/** A $0.51 coin and a $67,000 coin need different precision to read at all. */
function price(value: number): string {
  const digits = value >= 1000 ? 0 : value >= 1 ? 2 : 4;
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function compact(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}
