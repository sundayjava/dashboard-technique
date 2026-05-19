'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  Label,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Period = '1D' | '1W' | '1M' | '3M' | 'ALL';

interface ChartPoint {
  date: string;
  value: number;
}

interface Summary {
  totalInvestment: number;
  currentValue: number;
  totalProfit: number;
  profitPercentage: number;
  allTimeHigh: number;
  annualizedReturns: number;
}

interface PortfolioData {
  hasData: boolean;
  chartData: ChartPoint[];
  period: string;
  summary: Summary;
  initialDeposit: { date: string; amount: number } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);

const fmtDate = (d: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...opts,
  });

const yFormatter = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
};

/**
 * For DAILY data (all periods except 1D):
 * Returns the first YYYY-MM-DD date key for each month in the dataset,
 * so X-axis shows "Feb 2026", "Mar 2026", etc. at month boundaries.
 */
function computeMonthTicks(data: ChartPoint[]): string[] {
  const seen = new Set<string>();
  const ticks: string[] = [];
  for (const pt of data) {
    const monthKey = pt.date.substring(0, 7); // "YYYY-MM"
    if (!seen.has(monthKey)) {
      seen.add(monthKey);
      ticks.push(pt.date);
    }
  }
  return ticks;
}

/**
 * For 1D HOURLY data:
 * Returns ticks every 6 hours.
 */
function computeHourTicks(data: ChartPoint[]): string[] {
  return data.filter((_, i) => i % 6 === 0).map((pt) => pt.date);
}

/** Format a YYYY-MM-DD key into "Feb 2026" */
function formatMonthTick(dateStr: string): string {
  // Parse as UTC to avoid date-shift across timezones
  const [y, m] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Format an ISO hourly datetime into "10am", "2pm", etc. */
function formatHourTick(isoStr: string): string {
  const d = new Date(isoStr);
  const h = d.getUTCHours();
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h > 12 ? `${h - 12}pm` : `${h}am`;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({
  active,
  payload,
  is1D,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
  is1D?: boolean;
}) => {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload;
  const dateLabel = is1D
    ? new Date(pt.date).toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : (() => {
        const [y, m, day] = pt.date.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
          timeZone: 'UTC',
        });
      })();

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-left">
      <p className="text-[11px] text-gray-400 mb-0.5">{dateLabel}</p>
      <p className="text-sm font-bold text-gray-900">{fmt(pt.value)}</p>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function PortfolioPerformance({ userId }: { userId: string }) {
  const [period, setPeriod] = useState<Period>('ALL');
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(
    async (p: Period) => {
      try {
        setLoading(true);
        const res = await axios.get(
          `/api/investments/portfolio-performance?userId=${encodeURIComponent(userId)}&period=${p}`,
        );
        if (res.data.success) setData(res.data);
      } catch (e) {
        console.error('Portfolio performance fetch error:', e);
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    if (userId) fetchData(period);
  }, [fetchData, period, userId]);

  const periods: Period[] = ['1D', '1W', '1M', '3M', 'ALL'];
  const s = data?.summary;
  const chartData = data?.chartData ?? [];
  const initDep = data?.initialDeposit;
  const is1D = period === '1D';
  const isPos = (s?.totalProfit ?? 0) >= 0;
  const firstPt = chartData[0];
  const lastPt = chartData[chartData.length - 1];

  const sinceDate = initDep ? fmtDate(initDep.date) : '';

  // X-axis ticks
  const xTicks = is1D ? computeHourTicks(chartData) : computeMonthTicks(chartData);
  const xTickFmt = is1D ? formatHourTick : formatMonthTick;

  return (
    <div className="grid md:grid-cols-3 grid-cols-1 gap-3">
      {/* ── Portfolio Performance Chart ─────────────────────────────────── */}
      <div className="md:col-span-2 bg-white rounded-lg shadow p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">Portfolio Performance</h2>
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {periods.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                  period === p
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : !data?.hasData ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-64">
            <TrendingUp className="w-12 h-12 mb-3 text-gray-200" />
            <p className="text-sm font-medium text-gray-500">No portfolio data yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Start investing to track your performance
            </p>
          </div>
        ) : (
          <>
            {/* Current value + change */}
            <div className="mb-4">
              <p className="text-2xl font-bold text-gray-900">
                {fmt(s?.currentValue ?? 0)}
              </p>
              {s && s.totalProfit !== 0 && (
                <div
                  className={`flex items-center flex-wrap gap-1 mt-0.5 text-sm ${
                    isPos ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {isPos ? (
                    <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="font-medium">
                    {isPos ? '+' : ''}
                    {s.profitPercentage.toFixed(2)}%{' '}
                    ({isPos ? '+' : ''}
                    {fmt(s.totalProfit)})
                  </span>
                  {sinceDate && !is1D && (
                    <span className="text-gray-400 text-xs">since {sinceDate}</span>
                  )}
                </div>
              )}
            </div>

            {/* Recharts AreaChart */}
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 14, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="ppGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f1f5f9"
                  />

                  {/* X-axis: show month labels for daily, hour labels for 1D */}
                  <XAxis
                    dataKey="date"
                    ticks={xTicks}
                    tickFormatter={xTickFmt}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />

                  <YAxis
                    tickFormatter={yFormatter}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                  />

                  <Tooltip
                    content={<CustomTooltip is1D={is1D} />}
                    cursor={{
                      stroke: '#3b82f6',
                      strokeWidth: 1,
                      strokeDasharray: '4 3',
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#ppGradient)"
                    dot={false}
                    activeDot={{
                      r: 4,
                      fill: '#3b82f6',
                      stroke: 'white',
                      strokeWidth: 2,
                    }}
                  />

                  {/* ── Initial deposit annotation (bottom-left) ──────── */}
                  {firstPt && initDep && !is1D && (
                    <ReferenceDot
                      x={firstPt.date}
                      y={firstPt.value}
                      r={4}
                      fill="#3b82f6"
                      stroke="white"
                      strokeWidth={2}
                    >
                      <Label
                        content={(props) => {
                          const vb = (props as { viewBox?: { x: number; y: number } }).viewBox;
                          if (!vb) return null;
                          const bw = 118;
                          const bh = 56;
                          const bx = vb.x + 12;
                          const by = vb.y + 8;
                          const depDate = fmtDate(initDep.date, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          });
                          return (
                            <g>
                              <rect
                                x={bx}
                                y={by}
                                width={bw}
                                height={bh}
                                rx={6}
                                fill="white"
                                stroke="#e2e8f0"
                                strokeWidth={1}
                              />
                              <text x={bx + 9} y={by + 17} fontSize={9} fill="#94a3b8">
                                {depDate}
                              </text>
                              <text x={bx + 9} y={by + 31} fontSize={9} fill="#64748b">
                                Invested
                              </text>
                              <text
                                x={bx + 9}
                                y={by + 48}
                                fontSize={11}
                                fontWeight="bold"
                                fill="#0f172a"
                              >
                                {fmt(initDep.amount)}
                              </text>
                            </g>
                          );
                        }}
                      />
                    </ReferenceDot>
                  )}

                  {/* ── Latest value annotation (top-right) ──────────── */}
                  {lastPt && (
                    <ReferenceDot
                      x={lastPt.date}
                      y={lastPt.value}
                      r={4}
                      fill="#3b82f6"
                      stroke="white"
                      strokeWidth={2}
                    >
                      <Label
                        content={(props) => {
                          const vb = (props as { viewBox?: { x: number; y: number } }).viewBox;
                          if (!vb) return null;
                          const bw = 126;
                          const bh = 46;
                          const bx = vb.x - bw - 10;
                          const by = vb.y - bh - 10;
                          const latestDate = is1D
                            ? new Date(lastPt.date).toLocaleString('en-US', {
                                month: 'short',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : (() => {
                                const [y, m, d] = lastPt.date.split('-').map(Number);
                                return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(
                                  'en-US',
                                  { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' },
                                );
                              })();
                          return (
                            <g>
                              <rect
                                x={bx}
                                y={by}
                                width={bw}
                                height={bh}
                                rx={6}
                                fill="white"
                                stroke="#e2e8f0"
                                strokeWidth={1}
                              />
                              <text x={bx + 9} y={by + 17} fontSize={9} fill="#94a3b8">
                                {latestDate}
                              </text>
                              <text
                                x={bx + 9}
                                y={by + 36}
                                fontSize={11}
                                fontWeight="bold"
                                fill="#0f172a"
                              >
                                {fmt(lastPt.value)}
                              </text>
                            </g>
                          );
                        }}
                      />
                    </ReferenceDot>
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* ── Portfolio Summary ───────────────────────────────────────────── */}
      <div className="md:col-span-1 bg-white rounded-lg shadow p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Portfolio Summary</h2>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse flex justify-between items-center">
                <div className="h-3.5 bg-gray-200 rounded w-2/5" />
                <div className="h-3.5 bg-gray-200 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {[
              {
                label: 'Total Investment',
                value: fmt(s?.totalInvestment ?? 0),
                color: 'text-gray-900',
              },
              {
                label: 'Current Portfolio Value',
                value: fmt(s?.currentValue ?? 0),
                color: 'text-green-600',
              },
              {
                label: 'Total Profit',
                value: fmt(s?.totalProfit ?? 0),
                color: (s?.totalProfit ?? 0) >= 0 ? 'text-green-600' : 'text-red-500',
              },
              {
                label: 'Profit Percentage',
                value: `${(s?.profitPercentage ?? 0).toFixed(2)}%`,
                color: (s?.profitPercentage ?? 0) >= 0 ? 'text-green-600' : 'text-red-500',
              },
              {
                label: 'All Time High (ATH)',
                value: fmt(s?.allTimeHigh ?? 0),
                color: 'text-gray-900',
              },
              {
                label: 'Returns (Ann.)',
                value: `${(s?.annualizedReturns ?? 0).toFixed(2)}%`,
                color: (s?.annualizedReturns ?? 0) >= 0 ? 'text-green-600' : 'text-red-500',
              },
            ].map((row, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-500">{row.label}</span>
                <span className={`text-sm font-semibold ${row.color}`}>{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
