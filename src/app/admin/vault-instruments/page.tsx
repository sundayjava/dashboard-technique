'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Check, Loader2, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { classLabel } from '@/lib/vault/class-presentation';

interface Asset {
  id: string;
  symbol: string;
  name: string;
  assetClass: string;
  role: string;
  provider: string;
  providerSymbol: string;
  fallbackProvider: string | null;
  fallbackSymbol: string | null;
  sleeveWeight: number;
  displayOrder: number;
  isActive: boolean;
  currentPrice: number;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  consecutiveFailures: number;
  holdingCount: number;
  retirementBlockers: string[];
}

interface Payload {
  assets: Asset[];
  sleeveTotals: Record<string, number>;
  assetClasses: Array<{ key: string; name: string }>;
  providers: string[];
  roles: string[];
}

const BLANK = {
  symbol: '',
  name: '',
  assetClass: '',
  role: 'PORTFOLIO',
  provider: '',
  providerSymbol: '',
  sleeveWeight: '0',
};

/**
 * The instruments a vault is priced from.
 *
 * Until this screen existed the only way to add one was editing
 * scripts/seed_vault_assets.ts and running it, so the market board was frozen
 * at whatever shipped.
 *
 * A new instrument starts at sleeve weight 0 on purpose: giving it a share
 * immediately would dilute the instruments members already hold, without
 * anyone deciding to. The split is set deliberately on Vault policy, and this
 * screen flags any class whose weights no longer total 100%.
 */
export default function AdminVaultInstrumentsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ ...BLANK });

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/admin/vault-instruments');
      setData(res.data);
    } catch {
      toast.error('Could not load the instruments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const report = (res: { data?: { warnings?: string[] } }) => {
    for (const warning of res.data?.warnings ?? []) toast(warning, { icon: '⚠️' });
  };

  const fail = (error: unknown, fallback: string) =>
    toast.error(
      axios.isAxiosError(error) && error.response?.data?.error
        ? error.response.data.error
        : fallback,
    );

  const addAsset = async () => {
    setSaving('new');
    try {
      const res = await axios.post('/api/admin/vault-instruments', {
        ...draft,
        sleeveWeight: Number(draft.sleeveWeight) || 0,
      });
      toast.success(`${draft.symbol.toUpperCase()} added.`);
      report(res);
      setDraft({ ...BLANK });
      setAdding(false);
      await load();
    } catch (error) {
      fail(error, 'Could not add the instrument.');
    } finally {
      setSaving(null);
    }
  };

  const setActive = async (asset: Asset, isActive: boolean) => {
    setSaving(asset.id);
    try {
      const res = await axios.put('/api/admin/vault-instruments', { id: asset.id, isActive });
      toast.success(`${asset.symbol} ${isActive ? 'is live again' : 'retired'}.`);
      report(res);
      await load();
    } catch (error) {
      fail(error, 'Could not save.');
    } finally {
      setSaving(null);
    }
  };

  const removeAsset = async (asset: Asset) => {
    if (
      !confirm(
        `Remove ${asset.symbol}? Its entire price history goes with it. ` +
          `Retiring it instead keeps the history and stops it being used.`,
      )
    ) {
      return;
    }
    setSaving(asset.id);
    try {
      const res = await axios.delete(`/api/admin/vault-instruments?id=${asset.id}`);
      toast.success(`${asset.symbol} removed.`);
      report(res);
      await load();
    } catch (error) {
      fail(error, 'Could not remove.');
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
  if (data === null) return null;

  const drifted = Object.entries(data.sleeveTotals).filter(
    ([, total]) => Math.abs(total - 1) > 1e-9,
  );

  const byClass = new Map<string, Asset[]>();
  for (const asset of data.assets) {
    byClass.set(asset.assetClass, [...(byClass.get(asset.assetClass) ?? []), asset]);
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Instruments</h1>
        <p className="text-sm text-gray-600 mt-1">
          What each asset class is actually bought as, and where its price comes from. A new
          instrument starts at 0% of its sleeve so it cannot dilute what members already hold
          &mdash; set the split on Vault policy.
        </p>
      </div>

      {drifted.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Sleeve weights do not total 100%</p>
            <ul className="mt-1 space-y-0.5">
              {drifted.map(([cls, total]) => (
                <li key={cls} className="tabular-nums">
                  {classLabel(cls, Object.fromEntries(data.assetClasses.map((c) => [c.key, c.name])))}
                  : {(total * 100).toFixed(1)}%
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs">
              Rebalances divide a class by these weights, so the split must be fixed on Vault
              policy before the next one runs.
            </p>
          </div>
        </div>
      )}

      {/* Add */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        {!adding ? (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-black cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add an instrument
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">New instrument</h2>
              <button
                onClick={() => {
                  setAdding(false);
                  setDraft({ ...BLANK });
                }}
                className="p-1 text-gray-400 hover:text-gray-900 cursor-pointer"
                aria-label="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="Ticker">
                <input
                  value={draft.symbol}
                  onChange={(e) => setDraft({ ...draft, symbol: e.target.value.toUpperCase() })}
                  placeholder="VTI"
                  className={inputClass}
                />
              </Field>
              <Field label="Name">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Vanguard Total Stock Market ETF"
                  className={inputClass}
                />
              </Field>
              <Field label="Asset class">
                <select
                  value={draft.assetClass}
                  onChange={(e) => setDraft({ ...draft, assetClass: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Choose…</option>
                  {data.assetClasses.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Provider">
                <select
                  value={draft.provider}
                  onChange={(e) => setDraft({ ...draft, provider: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Choose…</option>
                  {data.providers.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Vendor identifier" hint="CoinGecko uses ids like 'ripple'">
                <input
                  value={draft.providerSymbol}
                  onChange={(e) => setDraft({ ...draft, providerSymbol: e.target.value })}
                  placeholder="VTI"
                  className={inputClass}
                />
              </Field>
              <Field label="Role">
                <select
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                  className={inputClass}
                >
                  {data.roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <button
              onClick={addAsset}
              disabled={
                saving === 'new' ||
                !draft.symbol ||
                !draft.name ||
                !draft.assetClass ||
                !draft.provider ||
                !draft.providerSymbol
              }
              className="flex items-center gap-1 px-4 py-2 rounded-full bg-black text-white text-xs font-medium hover:bg-gray-800 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {saving === 'new' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Add instrument
            </button>
          </div>
        )}
      </div>

      {/* One table per class, since a sleeve only means something within one. */}
      {[...byClass.entries()].map(([cls, assets]) => {
        const total = data.sleeveTotals[cls];
        const ok = total === undefined || Math.abs(total - 1) < 1e-9;
        return (
          <div
            key={cls}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">
                {classLabel(cls, Object.fromEntries(data.assetClasses.map((c) => [c.key, c.name])))}
              </h2>
              {total !== undefined && (
                <span
                  className={`text-xs tabular-nums font-medium ${
                    ok ? 'text-gray-500' : 'text-amber-700'
                  }`}
                >
                  sleeve {(total * 100).toFixed(1)}%
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="text-left font-medium px-5 py-2">Instrument</th>
                    <th className="text-left font-medium px-3 py-2">Feed</th>
                    <th className="text-right font-medium px-3 py-2">Sleeve</th>
                    <th className="text-right font-medium px-3 py-2">Price</th>
                    <th className="text-left font-medium px-3 py-2">Held by</th>
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr
                      key={a.id}
                      className={`border-b border-gray-50 ${a.isActive ? '' : 'bg-gray-50/60'}`}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{a.symbol}</span>
                          {a.role !== 'PORTFOLIO' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                              {a.role.toLowerCase()}
                            </span>
                          )}
                          {!a.isActive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                              retired
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate max-w-[22rem]">{a.name}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-xs text-gray-600">{a.provider}</p>
                        <p className="text-[11px] text-gray-400 font-mono">{a.providerSymbol}</p>
                        {a.consecutiveFailures > 0 && (
                          <p className="text-[11px] text-red-600">
                            {a.consecutiveFailures} failed sync
                            {a.consecutiveFailures === 1 ? '' : 's'}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-900">
                        {(a.sleeveWeight * 100).toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-900">
                        {a.currentPrice > 0 ? `$${a.currentPrice.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">
                        {a.holdingCount > 0 ? `${a.holdingCount} member(s)` : 'nobody'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setActive(a, !a.isActive)}
                            disabled={
                              saving === a.id ||
                              (a.isActive && a.retirementBlockers.length > 0)
                            }
                            title={
                              a.isActive && a.retirementBlockers.length > 0
                                ? a.retirementBlockers.join(' ')
                                : a.isActive
                                  ? 'Retire this instrument'
                                  : 'Bring it back'
                            }
                            className="px-3 py-1.5 rounded text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            {saving === a.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : a.isActive ? (
                              'Retire'
                            ) : (
                              'Restore'
                            )}
                          </button>
                          <button
                            onClick={() => removeAsset(a)}
                            disabled={saving === a.id || a.retirementBlockers.length > 0}
                            title={
                              a.retirementBlockers.length > 0
                                ? a.retirementBlockers.join(' ')
                                : 'Remove, with its price history'
                            }
                            className="p-2 text-gray-400 hover:text-red-600 cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}
