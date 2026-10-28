'use client';

import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

/**
 * Vault value against a passive 60/40 blend.
 *
 * Two series, ONE axis — both are dollar values of the same cashflows, so they
 * belong on the same scale. A second y-axis would let the lines cross wherever
 * the scales happened to put them and imply a relationship that is not there.
 *
 * Both hues come from the validated categorical set and clear every gate
 * including 3:1 contrast, so they need no relief treatment — but the legend is
 * present regardless, because identity must never rest on colour alone.
 *
 * Presentational. The statement fetches once and hands the window down, so the
 * chart and the figures above it can never describe different periods.
 */

const VAULT_COLOR = '#2a78d6';
const BENCHMARK_COLOR = '#eb6834';

export interface SeriesPoint {
  date: string;
  vault: number;
  benchmark: number | null;
  contributed: number;
}

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PerformanceChart({ series }: { series: SeriesPoint[] }) {
  /**
   * Y bounds fitted to the data rather than anchored at zero.
   *
   * A zero baseline put $10,168 and $10,723 inside a $0–$12,000 range and
   * flattened a 5.5% gap into two parallel lines. The shared starting point is
   * what makes a fitted axis honest here: both lines begin from the same
   * contributions, so the eye compares their separation rather than their
   * height above an arbitrary floor.
   */
  const bounds = (() => {
    const values = series.flatMap((p) =>
      [p.vault, p.benchmark].filter((v): v is number => typeof v === 'number'),
    );
    if (values.length === 0) return undefined;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = max - min < 1e-9 ? Math.max(1, max * 0.05) : (max - min) * 0.08;
    return [Math.max(0, min - pad), max + pad] as [number, number];
  })();

  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
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
            domain={bounds ?? ['auto', 'auto']}
            allowDecimals={false}
            tickFormatter={(v) =>
              `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
            }
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              fontSize: 12,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
            cursor={{ stroke: '#d1d5db', strokeWidth: 1 }}
            formatter={(value) => (value === null ? '—' : money(Number(value)))}
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
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="benchmark"
            name="Passive 60/40"
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
  );
}
