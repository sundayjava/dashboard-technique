'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { CLASS_LABELS, PROFILE_LABELS, money, useVault } from './VaultContext';
import PerformanceChart, { SeriesPoint } from './PerformanceChart';

type Period = 'MONTH' | 'QUARTER' | 'YEAR';

interface ClassRow {
  assetClass: string;
  instruments: string;
  allocationPercent: number;
  gain: number;
  closeBalance: number;
  returnPercent: number;
}

interface Statement {
  period: Period;
  periodLabel: string;
  available: boolean;
  unavailableReason: string | null;
  tiles: {
    balance: number;
    balanceChange: number;
    returnPercent: number | null;
    benchmarkReturnPercent: number | null;
    contributions: number;
    contributionCount: number;
    gain: number;
    gainPercentOfContributed: number | null;
    totalContributed: number;
    allTimeGain: number;
  };
  classes: ClassRow[];
  total: {
    allocationPercent: number;
    gain: number;
    closeBalance: number;
    returnPercent: number | null;
  };
  contributionNote: string | null;
  series: SeriesPoint[];
  verdict: string | null;
  outperformancePoints: number | null;
}

const PERIOD_LABELS: Record<Period, string> = {
  MONTH: 'Monthly',
  QUARTER: 'Quarterly',
  YEAR: 'Annual',
};

/**
 * Class hues lifted for a dark panel.
 *
 * The same six identities as the light screens, brightened: the light set is
 * tuned for 3:1 against white, and CRYPTO's #008300 in particular disappears
 * against near-black. Hue is preserved, so a member moving from the overview
 * to this page still reads the same class as the same colour.
 */
const DARK_CLASS_COLORS: Record<string, string> = {
  GLOBAL_EQUITIES: '#4d9bff',
  FIXED_INCOME: '#ff8a5c',
  COMMODITIES: '#2dd4a7',
  REAL_ESTATE: '#f5b73d',
  FUTURES_MACRO: '#f08bb4',
  CRYPTO: '#3ec46d',
};

function classColor(key: string): string {
  return DARK_CLASS_COLORS[key] ?? '#94a3b8';
}

/** Signed percentage, coloured. Zero is neutral, not green. */
function Pct({ value, className = '' }: { value: number | null; className?: string }) {
  if (value === null) return <span className="text-slate-500">—</span>;
  const tone =
    value > 0.0049 ? 'text-emerald-400' : value < -0.0049 ? 'text-red-400' : 'text-slate-300';
  return (
    <span className={`tabular-nums ${tone} ${className}`}>
      {value > 0 ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  );
}

/** Signed money, coloured on the same rule. */
function Amount({ value, className = '' }: { value: number; className?: string }) {
  const tone =
    value > 0.004 ? 'text-emerald-400' : value < -0.004 ? 'text-red-400' : 'text-slate-300';
  return (
    <span className={`tabular-nums ${tone} ${className}`}>
      {value > 0 ? '+' : value < 0 ? '−' : ''}
      {money(Math.abs(value))}
    </span>
  );
}

function Micro({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500 font-medium">{children}</p>
  );
}

/** The gold pill that dates each section, as in the statement design. */
function PeriodBadge({ label }: { label: string }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-300/90 bg-amber-400/10 border border-amber-400/20 rounded px-2 py-1">
      {label}
    </span>
  );
}

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
      <Micro>{label}</Micro>
      <p className="text-xl sm:text-2xl font-semibold tabular-nums mt-1.5 text-slate-50">
        {value}
      </p>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function Section({
  title,
  badge,
  children,
  padded = true,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <section className="rounded-xl border border-white/[0.07] bg-white/[0.03] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06]">
        <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
          {title}
        </h2>
        {badge && <PeriodBadge label={badge} />}
      </div>
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

/**
 * The performance statement.
 *
 * One fetch drives the period switch, the four tiles, the per-class table, the
 * benchmark chart and the allocation summary, so no two figures on the screen
 * can describe different windows or disagree on a total.
 *
 * DARK, ALONE AMONG THE VAULT PAGES. It is a statement rather than a
 * dashboard, so it is drawn as a self-contained dark document sitting inside
 * the light shell. Darkening the sidebar and header for one route would make
 * the rest of the app look broken on the way in and out; one dark surface
 * reads as a deliberate artefact instead.
 */
export default function PerformanceStatement() {
  const { data } = useVault();
  const [period, setPeriod] = useState<Period>('MONTH');
  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (selected: Period) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/retirement-vault/performance?period=${selected}`);
      setStatement(res.data?.statement ?? null);
    } catch {
      setStatement(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(period);
  }, [load, period]);

  const vault = data?.vault;
  const t = statement?.tiles;

  const donut = (statement?.classes ?? []).map((c) => ({
    name: CLASS_LABELS[c.assetClass] ?? c.assetClass,
    value: c.allocationPercent,
    color: classColor(c.assetClass),
  }));

  return (
    <div className="rounded-2xl bg-[#0b1220] border border-white/[0.06] p-4 sm:p-5 space-y-4 shadow-xl">
      {/* Period switch. Governs every figure below, including the chart. */}
      <div className="inline-flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              period === p
                ? 'bg-slate-50 text-slate-900'
                : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
        </div>
      ) : statement === null ? (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-8 text-center">
          <p className="text-sm text-slate-400">Could not load your statement.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Tile
              label="Vault balance"
              value={money(t?.balance ?? 0)}
              sub={
                statement.available ? (
                  <span className="inline-flex items-center gap-1">
                    {(t?.balanceChange ?? 0) >= 0 ? (
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                    <Amount value={t?.balanceChange ?? 0} />
                    <span className="text-slate-500">this {periodWord(period)}</span>
                  </span>
                ) : (
                  <span className="text-slate-500">No movement recorded yet</span>
                )
              }
            />
            <Tile
              label={`${statement.periodLabel} return`}
              value={<Pct value={t?.returnPercent ?? null} />}
              sub={
                t?.benchmarkReturnPercent === null || t?.benchmarkReturnPercent === undefined ? (
                  <span className="text-slate-500">Passive 60/40: —</span>
                ) : (
                  <span className="text-slate-400">
                    Passive 60/40:{' '}
                    <span className="tabular-nums">
                      {t.benchmarkReturnPercent > 0 ? '+' : ''}
                      {t.benchmarkReturnPercent.toFixed(2)}%
                    </span>
                  </span>
                )
              }
            />
            <Tile
              label={
                period === 'MONTH'
                  ? 'Total contributed'
                  : `Contributions (${statement.periodLabel})`
              }
              value={money(
                period === 'MONTH' ? (t?.totalContributed ?? 0) : (t?.contributions ?? 0),
              )}
              sub={
                <span className="text-slate-400">
                  {t?.contributionCount
                    ? `${money(t.contributions)} in ${statement.periodLabel}`
                    : `Nothing added in ${statement.periodLabel}`}
                </span>
              }
            />
            <Tile
              label={period === 'MONTH' ? 'Total gain (all time)' : `${statement.periodLabel} gain`}
              value={
                <Amount value={period === 'MONTH' ? (t?.allTimeGain ?? 0) : (t?.gain ?? 0)} />
              }
              sub={
                period === 'MONTH' ? (
                  <span className="text-slate-400">
                    <Pct value={t?.gainPercentOfContributed ?? null} /> since inception
                  </span>
                ) : (
                  <span className="text-slate-500">Excludes money you paid in</span>
                )
              }
            />
          </div>

          {!statement.available && statement.unavailableReason && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3">
              <p className="text-xs text-amber-200/90">{statement.unavailableReason}</p>
            </div>
          )}

          <Section
            title={
              period === 'MONTH'
                ? 'Asset breakdown'
                : `${PERIOD_LABELS[period]} asset performance`
            }
            badge={statement.periodLabel}
            padded={false}
          >
            {statement.classes.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                Nothing invested yet. Fund your vault and each class will report here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.1em] text-slate-500 border-b border-white/[0.06]">
                      <th className="text-left font-medium px-4 py-2">Asset class</th>
                      <th className="hidden sm:table-cell text-right font-medium px-3 py-2">
                        Allocation
                      </th>
                      <th className="text-right font-medium px-3 py-2">Gain / loss</th>
                      <th className="hidden sm:table-cell text-right font-medium px-3 py-2">
                        Close balance
                      </th>
                      <th className="text-right font-medium px-4 py-2">Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.classes.map((c) => (
                      <tr key={c.assetClass} className="border-b border-white/[0.04]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-1.5 h-8 rounded-full shrink-0"
                              style={{ backgroundColor: classColor(c.assetClass) }}
                              aria-hidden
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-100 leading-tight">
                                {CLASS_LABELS[c.assetClass] ?? c.assetClass}
                              </p>
                              {c.instruments && (
                                <p className="text-[11px] text-slate-500 font-mono leading-tight mt-0.5">
                                  {c.instruments}
                                </p>
                              )}
                              <p className="sm:hidden text-[11px] text-slate-400 tabular-nums mt-0.5">
                                {money(c.closeBalance)} · {c.allocationPercent.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-3 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <span className="block w-16 h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
                              <span
                                className="block h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, c.allocationPercent)}%`,
                                  backgroundColor: classColor(c.assetClass),
                                }}
                              />
                            </span>
                            <span className="tabular-nums text-slate-100 font-medium w-12 text-right">
                              {c.allocationPercent.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-medium">
                          <Amount value={c.gain} />
                        </td>
                        <td className="hidden sm:table-cell px-3 py-3 text-right tabular-nums text-slate-100">
                          {money(c.closeBalance)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          <Pct value={c.returnPercent} />
                        </td>
                      </tr>
                    ))}

                    {statement.contributionNote && (
                      <tr>
                        <td colSpan={5} className="px-4 py-2 text-[11px] text-slate-500 italic">
                          {statement.contributionNote}
                        </td>
                      </tr>
                    )}

                    <tr className="bg-white/[0.04] font-semibold">
                      <td className="px-4 py-3 text-slate-50">Portfolio total</td>
                      <td className="hidden sm:table-cell px-3 py-3 text-right tabular-nums text-slate-50">
                        {statement.total.allocationPercent.toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Amount value={statement.total.gain} />
                      </td>
                      <td className="hidden sm:table-cell px-3 py-3 text-right tabular-nums text-slate-50">
                        {money(statement.total.closeBalance)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Pct value={statement.total.returnPercent} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="vs. passive 60/40" badge={statement.periodLabel}>
            {statement.series.length >= 2 ? (
              <PerformanceChart series={statement.series} dark />
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center text-center px-6">
                <TrendingUp className="w-8 h-8 text-slate-700 mb-2" />
                <p className="text-sm text-slate-200 font-medium">Not enough history yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Your vault is valued once a day. {statement.series.length} valuation
                  {statement.series.length === 1 ? '' : 's'} so far in {statement.periodLabel};
                  the line starts once there are two.
                </p>
              </div>
            )}

            {statement.verdict && (
              <p className="text-xs text-slate-300 mt-3 leading-relaxed">{statement.verdict}</p>
            )}
            <p className="text-[11px] text-slate-500 mt-2">
              The comparison is a buy-and-hold 60/40 stock-bond blend fed the same contributions
              on the same dates as your vault.
            </p>
          </Section>

          {donut.length > 0 && (
            <Section title="Allocation summary">
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <div className="relative w-[150px] h-[150px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donut}
                        dataKey="value"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                        stroke="none"
                        isAnimationActive={false}
                      >
                        {donut.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-semibold text-slate-50 tabular-nums">
                      {donut.length}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
                      classes
                    </span>
                  </div>
                </div>

                <ul className="flex-1 w-full space-y-1.5">
                  {statement.classes.map((c) => (
                    <li key={c.assetClass} className="flex items-center gap-2 text-xs">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: classColor(c.assetClass) }}
                        aria-hidden
                      />
                      <span className="text-slate-300 flex-1 truncate">
                        {CLASS_LABELS[c.assetClass] ?? c.assetClass}
                      </span>
                      <span className="tabular-nums text-slate-50 font-medium">
                        {c.allocationPercent.toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Section>
          )}

          <div className="space-y-3 border-t border-white/[0.06]">
            <p className="text-[11px] text-slate-500 leading-relaxed pt-3">
              This statement is for informational purposes only. Past performance does not
              guarantee future results. The Retirement Vault holds a hard cap on cryptocurrency
              exposure at all times.
            </p>
            <div className="text-[11px] text-slate-600 font-mono leading-relaxed">
              <p>
                Statement ID: ACR-STMT-
                {statement.periodLabel.replace(/\s+/g, '-').toUpperCase()}
              </p>
              <p>Account: {vault?.vaultNumber ?? '—'}</p>
              <p>
                Profile: {PROFILE_LABELS[vault?.riskProfile ?? ''] ?? vault?.riskProfile ?? '—'}
              </p>
              <p>
                Generated:{' '}
                {new Date().toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function periodWord(period: Period): string {
  return period === 'MONTH' ? 'month' : period === 'QUARTER' ? 'quarter' : 'year';
}
