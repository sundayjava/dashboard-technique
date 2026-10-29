'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import { money, useClassLabel, useVault } from './VaultContext';
import { AssetIcon, Panel } from './VaultUI';

/**
 * The day's performance, per asset class.
 *
 * Each class earns one rate a day -- the sum of its instruments' closing moves
 * plus the uplift an admin sets for that class -- and the member's money in
 * that class grows by it overnight. See lib/vault/class-performance.ts.
 *
 * The rate sits ABOVE the allocated value, which is what the figure is of, and
 * the arithmetic is shown rather than summarised. A member handed "+5.00%" with
 * no workings has no way to tell a good day from a mistake; shown as
 * "-0.79% market + 5.79% uplift" they can see where it came from, and the
 * instrument moves behind the market half are in the row's tooltip.
 */
export default function ClassPerformance() {
  const { data } = useVault();
  const label = useClassLabel();

  const rates = data?.classPerformance?.rates ?? [];
  const classValues = data?.valuation?.classValues ?? {};
  const date = data?.classPerformance?.date ?? null;

  // Only classes the member actually holds. A rate for a class they have no
  // money in is market trivia, not their performance.
  const rows = rates
    .map((rate) => ({ rate, position: classValues[rate.assetClass] }))
    .filter((row) => (row.position?.value ?? 0) > 0.005)
    .sort((a, b) => (b.position?.value ?? 0) - (a.position?.value ?? 0));

  if (rows.length === 0) return null;

  const totalAccrued = Object.values(classValues).reduce((sum, c) => sum + c.accrued, 0);

  return (
    <Panel
      title="Performance by class"
      action={
        date !== null && (
          <span className="text-xs text-gray-400">
            Closed {new Date(date).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        )
      }
    >
      <div className="space-y-2.5">
        {rows.map(({ rate, position }) => {
          const value = position?.value ?? 0;
          const up = rate.totalPercent >= 0;
          // The day's rate applied to what the class is worth now. Shown so the
          // percentage lands as an amount of the member's own money.
          const dayAmount = (value * rate.totalPercent) / 100;

          return (
            <div
              key={rate.assetClass}
              className="flex items-center gap-3"
              title={
                rate.breakdown.length > 0
                  ? rate.breakdown
                      .map(
                        (b) =>
                          `${b.symbol} ${b.changePercent >= 0 ? '+' : ''}${b.changePercent.toFixed(2)}%`,
                      )
                      .join('   ')
                  : undefined
              }
            >
              <AssetIcon assetClass={rate.assetClass} size="sm" />

              <div className="flex-1 min-w-0">
                {/* The rate sits above the value it moved. */}
                <p
                  className={`text-xs font-semibold tabular-nums leading-tight flex items-center gap-1 ${
                    up ? 'text-lime-700' : 'text-red-600'
                  }`}
                >
                  {up ? (
                    <TrendingUp className="w-3 h-3 shrink-0" />
                  ) : (
                    <TrendingDown className="w-3 h-3 shrink-0" />
                  )}
                  {up ? '+' : ''}
                  {rate.totalPercent.toFixed(2)}%
                </p>
                <p className="text-sm text-gray-900 truncate leading-tight">
                  {money(value)}
                </p>
                <p className="text-[11px] text-gray-400 tabular-nums">
                  {label(rate.assetClass)} &middot;{' '}
                  {rate.assetSumPercent >= 0 ? '+' : ''}
                  {rate.assetSumPercent.toFixed(2)}% market
                  {rate.upliftPercent !== 0 && (
                    <>
                      {' '}
                      {rate.upliftPercent >= 0 ? '+' : '−'}{' '}
                      {Math.abs(rate.upliftPercent).toFixed(2)}% uplift
                    </>
                  )}
                </p>
              </div>

              <div className="text-right shrink-0">
                <p
                  className={`text-sm font-semibold tabular-nums ${
                    dayAmount >= 0 ? 'text-lime-700' : 'text-red-600'
                  }`}
                >
                  {dayAmount >= 0 ? '+' : '−'}
                  {money(Math.abs(dayAmount))}
                </p>
                <p className="text-[11px] text-gray-400">that day</p>
                {/* Cumulative, so it reconciles with the figure above the
                    value on the overview rather than competing with it. A
                    percentage of no principal is undefined, not zero. */}
                {position !== undefined && position.principal > 0 && (
                  <p
                    className={`text-[11px] font-semibold tabular-nums mt-0.5 ${
                      position.accrued >= 0 ? 'text-lime-700' : 'text-red-600'
                    }`}
                  >
                    {position.accrued >= 0 ? '+' : ''}
                    {((position.accrued / position.principal) * 100).toFixed(2)}% total
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
        <span className="text-xs text-gray-600">Credited to date</span>
        <span
          className={`text-sm font-semibold tabular-nums ${
            totalAccrued >= 0 ? 'text-lime-700' : 'text-red-600'
          }`}
        >
          {totalAccrued >= 0 ? '+' : '−'}
          {money(Math.abs(totalAccrued))}
        </span>
      </div>

      <p className="text-[11px] text-gray-400 mt-3">
        Each class earns the sum of its instruments&apos; closing moves plus its managed
        uplift, credited once a day. A class whose markets did not trade that day earns
        nothing &mdash; it is not paid for a day it never had.
      </p>
    </Panel>
  );
}
