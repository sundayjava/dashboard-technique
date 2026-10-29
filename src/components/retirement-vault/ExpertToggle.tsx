'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, Lock, Sparkles } from 'lucide-react';
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
 * Three states, each given its own colour, because they mean different things
 * and a member has to tell them apart at a glance:
 *
 *   ON      lime, the product accent -- the allocator is working
 *   OFF     slate, full strength -- a live control the member can press
 *   LOCKED  amber with a padlock -- the cooldown is running, pressing it
 *           will not help, and this is NOT the same as "off"
 *
 * The earlier version rendered OFF and LOCKED as the same washed-out grey
 * (`disabled:opacity-50`), which made a working toggle look broken.
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
  const locked = !state.canSwitch;

  // The track carries the state. Locked is amber rather than faded, so a
  // member reads "not yet" instead of "broken".
  const track = locked
    ? on
      ? 'bg-[#c1ff72] ring-2 ring-amber-300'
      : 'bg-amber-200 ring-1 ring-amber-300'
    : on
      ? 'bg-[#c1ff72] hover:brightness-95'
      : 'bg-slate-300 hover:bg-slate-400';

  const Switch = (
    <button
      onClick={toggle}
      disabled={saving || locked}
      role="switch"
      aria-checked={on}
      aria-label="Expert Allocator"
      title={
        locked
          ? `You can change mode again in ${state.daysRemaining} day${state.daysRemaining === 1 ? '' : 's'}`
          : on
            ? 'Turn the Expert Allocator off'
            : 'Turn the Expert Allocator on'
      }
      className={`relative w-12 h-7 rounded-full transition-all shrink-0 ${
        locked ? 'cursor-not-allowed' : 'cursor-pointer'
      } ${track}`}
    >
      <span
        className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
      {saving && (
        <Loader2 className="w-3 h-3 animate-spin absolute inset-0 m-auto text-gray-700" />
      )}
      {locked && !saving && (
        <Lock className="w-2.5 h-2.5 absolute top-1/2 -translate-y-1/2 text-amber-700/80 left-2" />
      )}
    </button>
  );

  /** One short line naming the state, coloured to match the track. */
  const StatusLine = (
    <p className="text-xs mt-0.5 flex items-center gap-1.5">
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
          locked ? 'bg-amber-500' : on ? 'bg-lime-500' : 'bg-slate-400'
        }`}
      />
      <span className={locked ? 'text-amber-700' : on ? 'text-lime-700' : 'text-slate-600'}>
        {locked
          ? `Locked for ${state.daysRemaining} more day${state.daysRemaining === 1 ? '' : 's'}`
          : on
            ? 'On — managing your allocation'
            : 'Off — you place your own investments'}
      </span>
    </p>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">Expert Allocator</p>
          {StatusLine}
        </div>
        {Switch}
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl p-5 shadow-sm border transition-colors ${
        on
          ? 'bg-[#c1ff72] border-[#c1ff72]'
          : locked
            ? 'bg-amber-50 border-amber-200'
            : 'bg-white border-gray-100'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles
              className={`w-4 h-4 ${
                on ? 'text-black/70' : locked ? 'text-amber-500' : 'text-slate-400'
              }`}
            />
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

      {locked && (
        <div
          className={`flex items-start gap-2 mt-4 rounded-xl p-3 ${
            on ? 'bg-black/10' : 'bg-amber-100/60 border border-amber-200'
          }`}
        >
          <Lock
            className={`w-4 h-4 mt-0.5 shrink-0 ${on ? 'text-black/60' : 'text-amber-600'}`}
          />
          <p className={`text-xs ${on ? 'text-black/70' : 'text-amber-800'}`}>
            You can change mode again in {state.daysRemaining} day
            {state.daysRemaining === 1 ? '' : 's'}. This {state.cooldownDays}-day cooldown protects
            your long-term returns from short-term switching.
          </p>
        </div>
      )}
    </div>
  );
}
