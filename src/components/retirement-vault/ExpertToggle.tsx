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

  const Switch = (
    <AllocatorSwitch
      on={on}
      locked={locked}
      saving={saving}
      onClick={toggle}
      title={
        locked
          ? `You can change mode again in ${state.daysRemaining} day${state.daysRemaining === 1 ? '' : 's'}`
          : on
            ? 'Turn the Expert Allocator off'
            : 'Turn the Expert Allocator on'
      }
    />
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

/**
 * The switch itself, with no data behind it.
 *
 * Separated so all four states -- off, on, locked and saving -- can be put on
 * screen and looked at together. A control with states you can only reach by
 * arranging the right database is a control nobody checks.
 *
 * GEOMETRY. The track is the flex container and its padding is the inset, so
 * the knob's travel is exactly w-12 less p-1 twice less w-5 = 20px. The
 * previous version positioned the knob `absolute top-1` with no `left`, which
 * resolved to its static position inside a button -- centred -- and
 * translate-x-6 then carried it off the right-hand end.
 */
export function AllocatorSwitch({
  on,
  locked,
  saving,
  onClick,
  title,
}: {
  on: boolean;
  locked: boolean;
  saving: boolean;
  onClick?: () => void;
  title?: string;
}) {
  // The track carries the state. Locked is amber rather than faded, so a
  // member reads "not yet" instead of "broken".
  const track = locked
    ? on
      ? 'bg-[#c1ff72] ring-1 ring-inset ring-amber-400/60'
      : 'bg-amber-100 ring-1 ring-inset ring-amber-300'
    : on
      ? 'bg-[#c1ff72] ring-1 ring-inset ring-black/[0.06] hover:brightness-[0.97]'
      : 'bg-slate-200 ring-1 ring-inset ring-black/[0.06] hover:bg-slate-300';

  return (
    <button
      onClick={onClick}
      disabled={saving || locked}
      role="switch"
      aria-checked={on}
      aria-label="Expert Allocator"
      title={title}
      className={`inline-flex items-center h-7 w-12 shrink-0 rounded-full p-1
        transition-colors duration-200 ease-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900
        focus-visible:ring-offset-2 ${locked ? 'cursor-not-allowed' : 'cursor-pointer'} ${track}`}
    >
      <span
        className={`inline-flex items-center justify-center h-5 w-5 rounded-full bg-white
          shadow-sm ring-1 ring-black/6 transition-transform duration-200 ease-out ${
            on ? 'translate-x-5' : 'translate-x-0'
          }`}
      >
        {/* The state marker rides in the knob, so nothing floats loose on the
            track and the switch reads as one object. */}
        {saving ? (
          <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
        ) : locked ? (
          <Lock className="w-2.5 h-2.5 text-amber-600" />
        ) : null}
      </span>
    </button>
  );
}
