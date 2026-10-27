'use client';

import { ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react';
import { resolveAssetMark } from './AssetMarks';

/**
 * Shared visual language for the vault.
 *
 * Soft rounded surfaces, one accent card per view, and per-asset colour
 * coding. Kept light rather than dark, so it sits with the rest of the app.
 *
 * Asset colours are the SAME validated categorical set the allocation chart
 * uses, so an asset reads the same colour in its icon, its row and its slice.
 * A different palette per surface would make colour meaningless as identity.
 */

export const CLASS_COLORS: Record<string, string> = {
  GLOBAL_EQUITIES: '#2a78d6',
  FIXED_INCOME: '#eb6834',
  COMMODITIES: '#1baf7a',
  REAL_ESTATE: '#eda100',
  FUTURES_MACRO: '#e87ba4',
  CRYPTO: '#008300',
};

/** Brand lime, used for the single highlighted figure on a view. */
export const LIME = '#c1ff72';

export type StatTone = 'lime' | 'blue' | 'plain';

const TONES: Record<StatTone, { card: string; label: string; value: string; badge: string; action: string }> = {
  lime: {
    card: 'bg-[#c1ff72]',
    label: 'text-black/60',
    value: 'text-black',
    badge: 'bg-black/10 text-black',
    action: 'bg-black text-[#c1ff72]',
  },
  blue: {
    card: 'bg-[#2563eb]',
    label: 'text-white/70',
    value: 'text-white',
    badge: 'bg-white/15 text-white',
    action: 'bg-white text-[#2563eb]',
  },
  plain: {
    card: 'bg-white border border-gray-100',
    label: 'text-gray-500',
    value: 'text-gray-900',
    badge: 'bg-gray-100 text-gray-700',
    action: 'bg-gray-900 text-white',
  },
};

export function StatCard({
  label,
  value,
  sub,
  tone = 'plain',
  icon: Icon,
  onAction,
  actionLabel,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone?: StatTone;
  icon?: React.ComponentType<{ className?: string }>;
  onAction?: () => void;
  actionLabel?: string;
}) {
  const t = TONES[tone];
  return (
    <div className={`${t.card} rounded-2xl p-5 shadow-sm relative overflow-hidden`}>
      {Icon && (
        <div className={`${t.badge} w-11 h-11 rounded-xl flex items-center justify-center mb-6`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <p className={`text-xs ${t.label}`}>{label}</p>
      <div className="flex items-end justify-between gap-3 mt-1">
        <div className="min-w-0">
          <p className={`text-2xl font-bold ${t.value} tabular-nums truncate`}>{value}</p>
          {sub && <div className="mt-1">{sub}</div>}
        </div>
        {onAction && (
          <button
            onClick={onAction}
            aria-label={actionLabel ?? label}
            className={`${t.action} w-10 h-10 rounded-full flex items-center justify-center shrink-0 hover:opacity-85 transition-opacity cursor-pointer`}
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/** A rounded surface with an optional header row. */
export function Panel({
  title,
  action,
  children,
  padded = true,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
          {title && <h2 className="text-base font-semibold text-gray-900">{title}</h2>}
          {action}
        </div>
      )}
      <div className={padded ? 'px-5 pb-5' : ''}>{children}</div>
    </section>
  );
}

/** Coloured round badge carrying an asset's ticker. */
export function AssetIcon({
  symbol,
  assetClass,
  size = 'md',
}: {
  /** Ticker, where the row is one asset. Omitted on a class-level row. */
  symbol?: string;
  assetClass: string;
  size?: 'sm' | 'md';
}) {
  // A coin carries its own brand colour; everything else keeps the class
  // colour so the icon, the row and the doughnut slice agree.
  const { Mark, brandColor } = resolveAssetMark(symbol, assetClass);
  const color = brandColor ?? CLASS_COLORS[assetClass] ?? '#6b7280';
  const dim = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  const glyph = size === 'sm' ? 'w-3.5 h-3.5' : 'w-[18px] h-[18px]';
  return (
    <span
      className={`${dim} rounded-full flex items-center justify-center text-white shrink-0`}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      <Mark className={glyph} />
    </span>
  );
}

/** Up/down figure with an arrow, green or red. */
export function Trend({
  value,
  suffix = '%',
  showSign = true,
}: {
  value: number;
  suffix?: string;
  showSign?: boolean;
}) {
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-medium tabular-nums ${
        up ? 'text-green-600' : 'text-red-600'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {showSign && up ? '+' : ''}
      {value.toFixed(2)}
      {suffix}
    </span>
  );
}

/** Pill button, as used for row-level actions. */
export function PillButton({
  children,
  onClick,
  disabled,
  tone = 'plain',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'plain' | 'dark' | 'lime';
}) {
  const styles =
    tone === 'dark'
      ? 'bg-gray-900 text-white hover:bg-gray-700'
      : tone === 'lime'
        ? 'bg-[#c1ff72] text-black hover:brightness-95'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${styles} px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap`}
    >
      {children}
    </button>
  );
}

/** Segmented control, as used for the live/closed toggle. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex bg-gray-100 rounded-full p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
            value === o.value ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
