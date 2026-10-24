'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Clock, Loader2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

interface ModeState {
  allocationMode: string;
  expertAllocatorActive: boolean;
  canSwitch: boolean;
  daysRemaining: number;
  cooldownDays: number;
}

/**
 * Switch the Expert Allocator on or off.
 *
 * Shown on the overview as well as the allocation page, so it is one click
 * from where a member lands.
 *
 * Turning it OFF returns the vault to Diversified, since a vault still needs
 * a mode. The cooldown is shown rather than hidden: a toggle that silently
 * refuses is worse than one that explains it cannot move yet.
 */
export default function ExpertToggle({
  onChanged,
  compact = false,
}: {
  onChanged: () => void;
  compact?: boolean;
}) {
  const [state, setState] = useState<ModeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/retirement-vault/allocation-mode');
      setState(res.data);
    } catch {
      setState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async () => {
    if (!state) return;
    const turningOn = !state.expertAllocatorActive;

    if (
      !turningOn &&
      !confirm('Turn the Expert Allocator off? Your vault returns to Diversified and you place your own investments.')
    ) {
      return;
    }

    setSaving(true);
    try {
      await axios.put('/api/retirement-vault/allocation-mode', {
        allocationMode: turningOn ? 'EXPERT_ALLOCATOR' : 'DIVERSIFIED',
      });
      toast.success(turningOn ? 'Expert Allocator is on.' : 'Expert Allocator is off.');
      await load();
      onChanged();
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Could not change the mode.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading || !state) return null;

  const on = state.expertAllocatorActive;
  const blocked = !state.canSwitch;

  const Switch = (
    <button
      onClick={toggle}
      disabled={saving || blocked}
      role="switch"
      aria-checked={on}
      aria-label="Expert Allocator"
      title={blocked ? `You can change mode again in ${state.daysRemaining} days` : undefined}
      className={`relative w-12 h-7 rounded-full transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? 'bg-[#c1ff72]' : 'bg-gray-200'
      }`}
    >
      <span
        className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
      {saving && (
        <Loader2 className="w-3 h-3 animate-spin absolute inset-0 m-auto text-gray-600" />
      )}
    </button>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">Expert Allocator</p>
          <p className="text-xs text-gray-500">
            {blocked
              ? `Locked for ${state.daysRemaining} more days`
              : on
                ? 'Managing your allocation'
                : 'You place your own investments'}
          </p>
        </div>
        {Switch}
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl p-5 shadow-sm border transition-colors ${
        on ? 'bg-[#c1ff72] border-[#c1ff72]' : 'bg-white border-gray-100'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className={`w-4 h-4 ${on ? 'text-black/70' : 'text-gray-400'}`} />
            <p className={`text-sm font-semibold ${on ? 'text-black' : 'text-gray-900'}`}>
              Expert Allocator
            </p>
          </div>
          <p className={`text-sm mt-1.5 ${on ? 'text-black/70' : 'text-gray-600'}`}>
            {on
              ? 'Hand us a total and we place it across your asset classes, rebalancing as markets move.'
              : 'You decide how much goes into each asset class, within its cap.'}
          </p>
        </div>
        {Switch}
      </div>

      {blocked && (
        <div
          className={`flex items-start gap-2 mt-4 rounded-xl p-3 ${
            on ? 'bg-black/10' : 'bg-gray-50 border border-gray-100'
          }`}
        >
          <Clock className={`w-4 h-4 mt-0.5 shrink-0 ${on ? 'text-black/60' : 'text-gray-400'}`} />
          <p className={`text-xs ${on ? 'text-black/70' : 'text-gray-600'}`}>
            You can change mode again in {state.daysRemaining} days. This{' '}
            {state.cooldownDays}-day cooldown protects your long-term returns from short-term
            switching.
          </p>
        </div>
      )}
    </div>
  );
}
