'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Check, Clock, Loader2, PieChart, Sparkles, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';

interface ModeState {
  allocationMode: string;
  focusedAssetClass: string | null;
  expertAllocatorActive: boolean;
  cooldownDays: number;
  canSwitch: boolean;
  daysRemaining: number;
}

const MODES = [
  {
    value: 'DIVERSIFIED',
    title: 'Diversified',
    icon: PieChart,
    description: 'Spread across every asset class according to your risk profile.',
  },
  {
    value: 'FOCUSED',
    title: 'Focused',
    icon: Wallet,
    description: 'Concentrated in one asset class you choose, with the rest diversified.',
  },
  {
    value: 'EXPERT_ALLOCATOR',
    title: 'Expert Allocator',
    icon: Sparkles,
    description: 'Acredis-managed and rebalanced as market conditions change.',
  },
];

const ASSET_CLASSES = [
  { value: 'GLOBAL_EQUITIES', label: 'Global Equities' },
  { value: 'FIXED_INCOME', label: 'Bonds / Fixed Income' },
  { value: 'COMMODITIES', label: 'Commodities' },
  { value: 'REAL_ESTATE', label: 'Real Estate / REITs' },
  { value: 'FUTURES_MACRO', label: 'Futures / Macro' },
  { value: 'CRYPTO', label: 'Crypto (capped at 5%)' },
];

/**
 * Allocation mode, including the Expert Allocator toggle.
 *
 * The cooldown is shown rather than hidden: a member who cannot switch should
 * know why and when they can, not find a button that silently does nothing.
 */
export default function AllocationModeCard({ onChanged }: { onChanged: () => void }) {
  const [state, setState] = useState<ModeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pick, setPick] = useState('');
  const [focus, setFocus] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/retirement-vault/allocation-mode');
      setState(res.data);
      setPick(res.data?.allocationMode ?? '');
      setFocus(res.data?.focusedAssetClass ?? '');
    } catch {
      // Keep the rest of the dashboard usable if this one call fails.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await axios.put('/api/retirement-vault/allocation-mode', {
        allocationMode: pick,
        focusedAssetClass: pick === 'FOCUSED' ? focus : null,
      });
      toast.success(
        res.data?.rebalanced
          ? 'Mode changed and your holdings were realigned.'
          : 'Allocation mode changed.',
      );
      setEditing(false);
      await load();
      onChanged();
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Could not change your allocation mode.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading || !state) return null;

  const current = MODES.find((m) => m.value === state.allocationMode);
  const CurrentIcon = current?.icon ?? PieChart;
  const changed =
    pick !== state.allocationMode ||
    (pick === 'FOCUSED' && focus !== (state.focusedAssetClass ?? ''));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <CurrentIcon className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Allocation mode</h2>
          {state.expertAllocatorActive && (
            <span className="text-xs bg-[#e0ff57] text-black px-2 py-0.5 rounded font-medium">
              Expert on
            </span>
          )}
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            disabled={!state.canSwitch}
            title={
              state.canSwitch
                ? undefined
                : `You can change mode again in ${state.daysRemaining} days`
            }
            className="text-xs text-gray-500 hover:text-gray-900 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Change
          </button>
        )}
      </div>

      {!editing ? (
        <div className="mt-3">
          <p className="text-sm text-gray-900 font-medium">{current?.title}</p>
          <p className="text-sm text-gray-600 mt-0.5">{current?.description}</p>
          {state.focusedAssetClass && (
            <p className="text-xs text-gray-500 mt-1">
              Focused on{' '}
              {ASSET_CLASSES.find((c) => c.value === state.focusedAssetClass)?.label ??
                state.focusedAssetClass}
            </p>
          )}

          {!state.canSwitch && (
            <div className="flex items-start gap-2 mt-3 bg-gray-50 border border-gray-100 rounded-xl p-3">
              <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-600">
                You can change mode again in{' '}
                <span className="font-medium">{state.daysRemaining} days</span>. This{' '}
                {state.cooldownDays}-day cooldown protects your long-term returns from
                short-term switching.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {MODES.map((mode) => {
            const Icon = mode.icon;
            const selected = pick === mode.value;
            return (
              <button
                key={mode.value}
                onClick={() => setPick(mode.value)}
                className={`w-full text-left p-4 rounded-lg border transition-colors cursor-pointer ${
                  selected ? 'border-black bg-gray-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      selected ? 'bg-[#e0ff57] text-black' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{mode.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{mode.description}</p>
                  </div>
                </div>
              </button>
            );
          })}

          {pick === 'FOCUSED' && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">Focus on</label>
              <select
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
              >
                <option value="">Choose an asset class</option>
                {ASSET_CLASSES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-xs text-amber-900">
              Changing mode re-targets your vault and rebalances your holdings straight away.
              Your targets are replaced by the new mode&apos;s. You will not be able to change again
              for {state.cooldownDays} days.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || !changed || (pick === 'FOCUSED' && !focus)}
              className="flex items-center gap-1 px-4 py-2 rounded-full bg-black text-white text-xs font-medium hover:bg-gray-800 cursor-pointer disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Confirm change
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setPick(state.allocationMode);
                setFocus(state.focusedAssetClass ?? '');
              }}
              disabled={saving}
              className="px-4 py-2 rounded-full border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
