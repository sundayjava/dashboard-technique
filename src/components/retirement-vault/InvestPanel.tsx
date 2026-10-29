'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Check, Loader2, Sparkles, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { money, useClassLabel } from './VaultContext';
import { AssetIcon, Panel } from './VaultUI';

interface ClassCapacity {
  assetClass: string;
  targetPercent: number;
  capValue: number;
  currentValue: number;
  headroom: number;
  atCap: boolean;
  /** False when the vault's mode forbids funding this class. */
  investable: boolean;
}

/**
 * Where the member actually places their money.
 *
 * Two shapes, matching the two modes. With the Expert Allocator off the
 * member sets each class themselves and every field shows the ceiling for
 * that class, so the limit is visible BEFORE they type a number rather than
 * arriving as a rejection afterwards. With Expert on they give one total and
 * the system places it.
 */
export default function InvestPanel({ onInvested }: { onInvested: () => void }) {
  const label = useClassLabel();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expert, setExpert] = useState(false);
  const [mode, setMode] = useState<string>('DIVERSIFIED');
  const [cash, setCash] = useState(0);
  const [classes, setClasses] = useState<ClassCapacity[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/retirement-vault/invest');
      setExpert(res.data?.expertAllocatorActive ?? false);
      setMode(res.data?.allocationMode ?? 'DIVERSIFIED');
      setCash(res.data?.investableCash ?? 0);
      setClasses(res.data?.classes ?? []);
      setAmounts({});
    } catch {
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const manualTotal = Object.values(amounts).reduce((s, v) => s + (Number(v) || 0), 0);
  const overCash = manualTotal > cash + 0.01;

  const anyOverCap = classes.some(
    (c) => (Number(amounts[c.assetClass]) || 0) > c.headroom + 0.01,
  );

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload = expert
        ? { amount: cash }
        : {
            allocations: Object.entries(amounts)
              .filter(([, v]) => Number(v) > 0)
              .map(([assetClass, v]) => ({ assetClass, amount: Number(v) })),
          };
      const res = await axios.post('/api/retirement-vault/invest', payload);
      toast.success(`${money(res.data?.invested ?? 0)} invested.`);
      await load();
      onInvested();
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Could not invest.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Panel title="Invest">
        <div className="py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      </Panel>
    );
  }

  if (cash <= 0.01) {
    return (
      <Panel title="Invest">
        <div className="py-6 text-center">
          <Wallet className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            No uninvested cash. Make a deposit and it will appear here for you to invest.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Invest your cash"
      action={
        <span className="text-sm font-semibold text-gray-900 tabular-nums">
          {money(cash)} available
        </span>
      }
    >
      {expert ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2 bg-[#c1ff72]/25 border border-[#c1ff72] rounded-xl p-3">
            <Sparkles className="w-4 h-4 text-black/70 mt-0.5 shrink-0" />
            <p className="text-xs text-black/70">
              The Expert Allocator places your whole balance across your asset classes,
              filling whichever are furthest below target first. New deposits are invested
              automatically as they arrive.
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500">To be invested</p>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">{money(cash)}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            {mode === 'FOCUSED'
              ? 'Your vault is focused on a single asset class, so only that one can be funded. It is capped at its share of your vault.'
              : 'Set how much goes into each asset class. Each is capped at its share of your vault, which is why crypto cannot exceed 5%.'}
          </p>

          {classes
            .filter((c) => c.investable && c.targetPercent > 0)
            .map((c) => {
              const entered = Number(amounts[c.assetClass]) || 0;
              const over = entered > c.headroom + 0.01;
              return (
                <div key={c.assetClass} className="flex items-center gap-3">
                  <AssetIcon assetClass={c.assetClass} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 leading-tight">
                      {label(c.assetClass)}
                    </p>
                    <p className="text-[11px] text-gray-400 tabular-nums">
                      {c.atCap
                        ? `At its ${c.targetPercent}% ceiling`
                        : `Up to ${money(c.headroom)} · ${c.targetPercent}% cap`}
                    </p>
                  </div>
                  <input
                    type="number"
                    value={amounts[c.assetClass] ?? ''}
                    onChange={(e) =>
                      setAmounts((a) => ({ ...a, [c.assetClass]: e.target.value }))
                    }
                    disabled={c.atCap}
                    min={0}
                    max={c.headroom}
                    step={50}
                    placeholder="0"
                    className={`w-28 px-3 py-2 border rounded-xl text-sm text-right tabular-nums disabled:bg-gray-50 disabled:text-gray-300 ${
                      over ? 'border-red-300 text-red-600' : 'border-gray-200'
                    }`}
                  />
                  <button
                    onClick={() =>
                      setAmounts((a) => ({
                        ...a,
                        [c.assetClass]: String(
                          Math.floor(Math.min(c.headroom, cash) * 100) / 100,
                        ),
                      }))
                    }
                    disabled={c.atCap}
                    className="text-[11px] text-gray-400 hover:text-gray-900 cursor-pointer disabled:opacity-30 w-8 text-left"
                  >
                    Max
                  </button>
                </div>
              );
            })}

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <span className="text-sm text-gray-600">Total</span>
            <span
              className={`text-sm font-semibold tabular-nums ${
                overCash ? 'text-red-600' : 'text-gray-900'
              }`}
            >
              {money(manualTotal)}
            </span>
          </div>
          {overCash && (
            <p className="text-xs text-red-600">
              That is more than your {money(cash)} of uninvested cash.
            </p>
          )}
        </div>
      )}

      <button
        onClick={submit}
        disabled={
          submitting || (expert ? cash <= 0.01 : manualTotal <= 0 || overCash || anyOverCap)
        }
        className="w-full mt-5 flex items-center justify-center gap-2 bg-black text-white py-3 rounded-full text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Check className="w-4 h-4" />
        )}
        {expert
          ? `Invest all ${money(cash)}`
          : `Invest ${manualTotal > 0 ? money(manualTotal) : ''}`.trim()}
      </button>
    </Panel>
  );
}
