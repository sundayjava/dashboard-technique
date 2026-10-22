'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Loader2, TrendingUp } from 'lucide-react';

/**
 * Vault value against a traditional 60/40 401k.
 *
 * Two series, ONE axis — both are dollar values of the same cashflows, so they
 * belong on the same scale. A second y-axis would let the lines cross wherever
 * the scales happened to put them and imply a relationship that is not there.
 *
 * Both hues come from the validated categorical set and clear every gate
 * including 3:1 contrast, so they need no relief treatment — but the legend is
 * present regardless, because identity must never rest on colour alone.
 */

const VAULT_COLOR = '#2a78d6';
const BENCHMARK_COLOR = '#eb6834';

interface SeriesPoint {
  date: string;
  vault: number;
  benchmark: number | null;
  contributed: number;
}

interface Summary {
  startValue: number;
  endValue: number;
  changeValue: number;
  changePercent: number;
  benchmarkEnd: number | null;
  outperformanceValue: number | null;
}

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PerformanceChart() {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('ALL');
  const [ranges, setRanges] = useState<string[]>(['1M', '3M', '1Y', 'ALL']);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hasTrend, setHasTrend] = useState(false);
  const [pointCount, setPointCount] = useState(0);

  const load = useCallback(async (selected: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/retirement-vault/performance?range=${selected}`);
      setSeries(res.data?.series ?? []);
      setSummary(res.data?.summary ?? null);
      setHasTrend(res.data?.hasTrend ?? false);
      setPointCount(res.data?.pointCount ?? 0);
      if (Array.isArray(res.data?.ranges)) setRanges(res.data.ranges);
    } catch {
      setSeries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [load, range]);

  const ahead = (summary?.outperformanceValue ?? 0) >= 0;

  return (
    <div className="bg-white rounded-lg shadow-sm p-5">
      {/* Filters in one row above the chart. */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold text-gray-900">
          Performance vs traditional 401k
        </h2>
        <div className="flex gap-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                range === r
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[260px] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : !hasTrend ? (
        /* One point cannot describe a trend, so we say so rather than drawing
           a chart with a single dot on it. */
        <div className="h-[260px] flex flex-col items-center justify-center text-center px-6">
          <TrendingUp className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-600 font-medium">Not enough history yet</p>
          <p className="text-xs text-gray-500 mt-1 max-w-sm">
            Your vault is valued once a day. We have {pointCount} valuation
            {pointCount === 1 ? '' : 's'} so far, and need at least two before a performance
            line means anything. The comparison builds from here.
          </p>
        </div>
      ) : (
        <>
          {summary && (
            <div className="flex flex-wrap gap-6 mb-4">
              <div>
                <p className="text-xs text-gray-500">Vault</p>
                <p className="text-xl font-bold text-gray-900">{money(summary.endValue)}</p>
              </div>
              {summary.benchmarkEnd !== null && (
                <>
                  <div>
                    <p className="text-xs text-gray-500">Traditional 401k</p>
                    <p className="text-xl font-bold text-gray-900">
                      {money(summary.benchmarkEnd)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Difference</p>
                    <p
                      className={`text-xl font-bold ${ahead ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {ahead ? '+' : '−'}
                      {money(Math.abs(summary.outperformanceValue ?? 0))}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                {/* Recessive hairline grid, horizontal only. */}
                <CartesianGrid stroke="#f1f1ef" strokeWidth={1} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  minTickGap={32}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                  cursor={{ stroke: '#d1d5db', strokeWidth: 1 }}
                  formatter={(value) =>
                    value === null ? '—' : money(Number(value))
                  }
                />
                <Legend
                  verticalAlign="bottom"
                  height={28}
                  iconType="plainline"
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="vault"
                  name="Your vault"
                  stroke={VAULT_COLOR}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  name="Traditional 401k"
                  stroke={BENCHMARK_COLOR}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <p className="text-xs text-gray-400 mt-2">
            The comparison is a buy-and-hold 60/40 stock-bond blend fed the same
            contributions on the same dates as your vault.
          </p>
        </>
      )}
    </div>
  );
}
