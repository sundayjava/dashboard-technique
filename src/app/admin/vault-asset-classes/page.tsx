'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Check, Loader2, Lock, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Row {
  key: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  isSystem: boolean;
  dailyUpliftPercent: number;
  assetCount: number;
  holdingCount: number;
  removalBlockers: string[];
  targets: Record<string, number>;
}

const PROFILE_LABELS: Record<string, string> = {
  CONSERVATIVE: 'Conservative',
  BALANCED: 'Balanced',
  GROWTH: 'Growth',
};

/**
 * Asset classes and their percentages.
 *
 * The matrix is the point: percentages only make sense per profile and must
 * total 100 in each, so they are edited and saved a profile at a time rather
 * than field by field.
 */
export default function AdminAssetClassesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<string[]>([]);
  const [cryptoCap, setCryptoCap] = useState(5);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [uplifts, setUplifts] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/admin/vault-asset-classes');
      setRows(res.data?.rows ?? []);
      setProfiles(res.data?.profiles ?? []);
      setCryptoCap(res.data?.cryptoCapPercent ?? 5);
      setDrafts({});
      setUplifts({});
    } catch {
      toast.error('Could not load the asset classes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const draftFor = (profile: string, key: string) =>
    drafts[profile]?.[key] ?? String(rows.find((r) => r.key === key)?.targets[profile] ?? 0);

  const profileTotal = (profile: string) =>
    rows
      .filter((r) => r.isActive)
      .reduce((sum, r) => sum + (Number(draftFor(profile, r.key)) || 0), 0);

  const profileDirty = (profile: string) =>
    rows.some(
      (r) => Number(draftFor(profile, r.key)) !== (r.targets[profile] ?? 0),
    );

  const saveProfile = async (profile: string) => {
    setSaving(profile);
    try {
      const allocation = Object.fromEntries(
        rows.filter((r) => r.isActive).map((r) => [r.key, Number(draftFor(profile, r.key)) || 0]),
      );
      const res = await axios.put('/api/admin/vault-asset-classes', {
        riskProfile: profile,
        allocation,
      });
      const n = res.data?.vaultsUpdated ?? 0;
      toast.success(
        n > 0
          ? `${PROFILE_LABELS[profile]} saved. ${n} existing vault${n > 1 ? 's' : ''} updated.`
          : `${PROFILE_LABELS[profile]} saved.`,
      );
      await load();
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Could not save.',
      );
    } finally {
      setSaving(null);
    }
  };

  const upliftFor = (key: string) =>
    uplifts[key] ?? String(rows.find((r) => r.key === key)?.dailyUpliftPercent ?? 0);

  const upliftDirty = (row: Row) => {
    const raw = upliftFor(row.key).trim();
    // A blank field is not a change to zero. Treating it as one would let a
    // half-finished edit save an uplift nobody chose.
    if (raw === '') return false;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed !== row.dailyUpliftPercent;
  };

  const saveUplift = async (row: Row) => {
    setSaving(row.key);
    try {
      await axios.put('/api/admin/vault-asset-classes', {
        key: row.key,
        dailyUpliftPercent: Number(upliftFor(row.key)) || 0,
      });
      // Said plainly, because it is the one thing about this field that is not
      // obvious: today's figure has not been paid yet, and yesterday's cannot
      // be changed.
      toast.success(`${row.name} uplift saved. It applies from the next day closed.`);
      await load();
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Could not save the uplift.',
      );
    } finally {
      setSaving(null);
    }
  };

  const addClass = async () => {
    setSaving('new');
    try {
      await axios.post('/api/admin/vault-asset-classes', {
        name: newName,
        description: newDesc || null,
      });
      toast.success('Asset class added at 0%. Set its percentages below.');
      setAdding(false);
      setNewName('');
      setNewDesc('');
      await load();
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Could not add the class.',
      );
    } finally {
      setSaving(null);
    }
  };

  const removeClass = async (row: Row) => {
    if (!confirm(`Remove "${row.name}"? Its percentages are removed with it, and each profile will need rebalancing to 100%.`)) return;
    setSaving(row.key);
    try {
      await axios.delete(`/api/admin/vault-asset-classes?key=${row.key}`);
      toast.success(`${row.name} removed.`);
      await load();
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Could not remove.',
      );
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const active = rows.filter((r) => r.isActive);

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Asset classes</h1>
        <p className="text-sm text-gray-600 mt-1">
          The classes a vault can be allocated across, and what share each takes in every risk
          profile. Saving a profile updates the members already on it.
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Crypto is capped at {cryptoCap}% regardless of what is set here.
        </p>
        <p className="text-xs text-gray-500 mt-1">
          <span className="font-medium text-gray-700">Uplift / day</span> is separate from the
          percentages. Each night a class earns the sum of its own instruments&apos; closing
          moves plus its uplift, and every member&apos;s money in that class grows by the
          result. Change it as often as you like &mdash; a day already closed keeps the figure
          it was credited with.
        </p>
      </div>

      {/* The matrix. One column per profile, one row per class. */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="text-left font-medium px-5 py-3">Asset class</th>
                <th className="text-right font-medium px-5 py-3">Used by</th>
                <th
                  className="text-right font-medium px-5 py-3"
                  title="Percentage points added to this class's own market moves to form the day's rate"
                >
                  Uplift / day
                </th>
                {profiles.map((p) => (
                  <th key={p} className="text-right font-medium px-5 py-3">
                    {PROFILE_LABELS[p] ?? p}
                  </th>
                ))}
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {active.map((row) => (
                <tr key={row.key} className="border-b border-gray-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{row.name}</span>
                      {row.isSystem && (
                        <span
                          title="Shipped with the product"
                          className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex items-center gap-1"
                        >
                          <Lock className="w-2.5 h-2.5" />
                          system
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 font-mono">{row.key}</p>
                  </td>
                  <td className="px-5 py-4 text-right text-xs text-gray-500">
                    {row.assetCount} instrument{row.assetCount === 1 ? '' : 's'}
                    {row.holdingCount > 0 && (
                      <>
                        <br />
                        {row.holdingCount} holding{row.holdingCount === 1 ? '' : 's'}
                      </>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <input
                      type="number"
                      value={upliftFor(row.key)}
                      onChange={(e) =>
                        setUplifts((u) => ({ ...u, [row.key]: e.target.value }))
                      }
                      step={0.01}
                      min={-25}
                      max={25}
                      className={`w-20 px-2 py-1.5 border rounded-lg text-sm text-right tabular-nums ${
                        upliftDirty(row)
                          ? 'border-gray-900 ring-1 ring-gray-900'
                          : 'border-gray-200'
                      }`}
                    />
                    <button
                      onClick={() => saveUplift(row)}
                      disabled={saving === row.key || !upliftDirty(row)}
                      title={
                        upliftDirty(row)
                          ? `Save ${row.name}'s uplift`
                          : 'Change the figure to save it'
                      }
                      className="ml-1.5 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-black text-white text-xs font-medium hover:bg-gray-800 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {saving === row.key ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )}
                      Save
                    </button>
                  </td>
                  {profiles.map((p) => (
                    <td key={p} className="px-5 py-4 text-right">
                      <input
                        type="number"
                        value={draftFor(p, row.key)}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [p]: { ...(d[p] ?? {}), [row.key]: e.target.value },
                          }))
                        }
                        min={0}
                        max={100}
                        className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right tabular-nums"
                      />
                    </td>
                  ))}
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => removeClass(row)}
                      disabled={saving === row.key || row.removalBlockers.length > 0}
                      title={
                        row.removalBlockers.length > 0
                          ? row.removalBlockers.join(' ')
                          : 'Remove this class'
                      }
                      className="p-2 text-gray-400 hover:text-red-600 cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {/* Totals, which must read exactly 100 before a profile can save. */}
              <tr className="bg-gray-50">
                <td className="px-5 py-4 font-semibold text-gray-900">Total</td>
                <td />
                <td />
                {profiles.map((p) => {
                  const total = profileTotal(p);
                  const valid = Math.abs(total - 100) < 0.01;
                  return (
                    <td
                      key={p}
                      className={`px-5 py-4 text-right font-bold tabular-nums ${
                        valid ? 'text-gray-900' : 'text-red-600'
                      }`}
                    >
                      {total.toFixed(1)}%
                    </td>
                  );
                })}
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex flex-wrap items-center gap-2">
          {profiles.map((p) => {
            const total = profileTotal(p);
            const valid = Math.abs(total - 100) < 0.01;
            const dirty = profileDirty(p);
            return (
              <button
                key={p}
                onClick={() => saveProfile(p)}
                disabled={!dirty || !valid || saving === p}
                title={
                  !valid ? `${PROFILE_LABELS[p]} must total 100%` : undefined
                }
                className="flex items-center gap-1 px-4 py-2 rounded-full bg-black text-white text-xs font-medium hover:bg-gray-800 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {saving === p ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                Save {PROFILE_LABELS[p] ?? p}
              </button>
            );
          })}
          <p className="text-xs text-gray-500 ml-auto">
            Each profile must total 100% before it can be saved.
          </p>
        </div>
      </div>

      {/* Adding a class */}
      {adding ? (
        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">New asset class</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Name *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Private Credit"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Description</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="What this class holds"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
              />
            </div>
          </div>
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-900">
              It starts at 0% in every profile. Nothing is taken from the existing classes
              automatically — you decide what each profile gives up, then save it.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={addClass}
              disabled={saving === 'new' || newName.trim().length < 2}
              className="flex items-center gap-1 px-4 py-2 rounded-full bg-black text-white text-xs font-medium hover:bg-gray-800 cursor-pointer disabled:opacity-40"
            >
              {saving === 'new' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
              Add class
            </button>
            <button
              onClick={() => setAdding(false)}
              className="flex items-center gap-1 px-4 py-2 rounded-full border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 cursor-pointer"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-full text-sm font-medium hover:bg-gray-800 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add asset class
        </button>
      )}

      {/* Why a class cannot be removed, where that applies. */}
      {active.some((r) => r.removalBlockers.length > 0) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Classes that cannot be removed yet
          </h2>
          <div className="space-y-2">
            {active
              .filter((r) => r.removalBlockers.length > 0)
              .map((r) => (
                <div key={r.key} className="text-xs">
                  <span className="font-medium text-gray-900">{r.name}</span>
                  <ul className="list-disc list-inside text-gray-500 mt-0.5">
                    {r.removalBlockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
