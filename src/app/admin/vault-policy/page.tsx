'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Loader2, RotateCcw, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { classLabel } from '@/lib/vault/class-presentation';

interface PolicySetting {
  key: string;
  label: string;
  description: string;
  min: number;
  max: number;
  unit: 'percent' | 'days';
  group: string;
  defaultValue: number;
  value: number;
}

interface PolicyGroup {
  id: string;
  title: string;
  blurb: string;
}

interface SleeveAsset {
  id: string;
  symbol: string;
  name: string;
  assetClass: string;
  sleeveWeight: number;
  currentPrice: number;
}

interface PolicyData {
  groups?: PolicyGroup[];
  warnings: string[];
  settings: PolicySetting[];
  sleeveAssets: SleeveAsset[];
  vaultCount: number;
}

export default function AdminVaultPolicyPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [data, setData] = useState<PolicyData | null>(null);

  const [settingDrafts, setSettingDrafts] = useState<Record<string, string>>({});
  const [sleeveDrafts, setSleeveDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/admin/vault-policy');
      const payload: PolicyData = res.data;
      setData(payload);

      setSettingDrafts(
        Object.fromEntries(payload.settings.map((s) => [s.key, String(s.value)])),
      );
      setSleeveDrafts(
        Object.fromEntries(payload.sleeveAssets.map((a) => [a.id, String(a.sleeveWeight * 100)])),
      );
    } catch {
      toast.error('Could not load vault policy.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveSetting = async (key: string) => {
    setSaving(key);
    try {
      await axios.put('/api/admin/vault-policy', { setting: key, value: Number(settingDrafts[key]) });
      toast.success('Saved.');
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

  const saveSleeve = async (assetClass: string) => {
    if (!data) return;
    setSaving(assetClass);
    try {
      const sleeveWeights = data.sleeveAssets
        .filter((a) => a.assetClass === assetClass)
        .map((a) => ({ id: a.id, weight: Number(sleeveDrafts[a.id] ?? 0) / 100 }));
      await axios.put('/api/admin/vault-policy', { sleeveWeights });
      toast.success(`${classLabel(assetClass)} split saved.`);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) return null;

  const sleeveClasses = [...new Set(data.sleeveAssets.map((a) => a.assetClass))];

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Retirement Vault policy</h1>
        <p className="text-sm text-gray-600 mt-1">
          These values apply to vaults created or rebalanced from now on. Existing members&apos;
          allocations are not rewritten — they change at their next rebalance, so nothing shifts
          under a member without an event recording why.
        </p>
        <p className="text-xs text-gray-500 mt-1">{data.vaultCount} vault(s) currently exist.</p>
      </div>

      {data.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                Some stored values are being ignored
              </p>
              <ul className="text-xs text-amber-800 mt-1 space-y-0.5 list-disc list-inside">
                {data.warnings.map((w) => (
                  <li key={w} className="break-words">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Scalar settings */}
      {/*
        Grouped, not one flat list.
        
        Every one of these seven is live -- each was traced to the code that
        reads it before this page was touched -- but presented as a single
        column they read as interchangeable knobs. They are not: the crypto cap
        reshapes allocations, the penalties take money off a member at payout,
        and the rate cap bounds the nightly engine. Knowing which machinery a
        number drives is the thing to know before changing it.
      */}
      {(data.groups ?? [{ id: '', title: 'Policy settings', blurb: '' }]).map((group) => {
        const inGroup = data.settings.filter((s) => group.id === '' || s.group === group.id);
        if (inGroup.length === 0) return null;
        return (
      <section key={group.id} className="bg-white rounded-lg shadow-sm p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-gray-900">{group.title}</h2>
        {group.blurb && <p className="text-xs text-gray-500 mt-0.5 mb-4">{group.blurb}</p>}
        <div className="space-y-4">
          {inGroup.map((setting) => {
            const changed = settingDrafts[setting.key] !== String(setting.value);
            return (
              <div
                key={setting.key}
                className="flex flex-col md:flex-row md:items-center gap-3 border-b border-gray-100 pb-4 last:border-0 last:pb-0"
              >
                {/*
                  min-w-0 is load-bearing. A flex child defaults to
                  min-width:auto, so once this row goes horizontal the
                  description refuses to wrap below its longest word and
                  pushes the whole row wider than the card.
                */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{setting.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 break-words">{setting.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Allowed {setting.min}–{setting.max} · default {setting.defaultValue}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <input
                    type="number"
                    value={settingDrafts[setting.key] ?? ''}
                    onChange={(e) =>
                      setSettingDrafts((d) => ({ ...d, [setting.key]: e.target.value }))
                    }
                    min={setting.min}
                    max={setting.max}
                    step="0.5"
                    className="w-20 sm:w-24 px-3 py-2 border border-gray-300 rounded-lg text-base sm:text-sm"
                  />
                  <span className="text-xs text-gray-500 w-8 sm:w-10 shrink-0">
                    {setting.unit === 'percent' ? '%' : 'days'}
                  </span>
                  <button
                    onClick={() => saveSetting(setting.key)}
                    disabled={!changed || saving === setting.key}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-black text-white text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-gray-800"
                  >
                    {saving === setting.key ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    Save
                  </button>
                  <button
                    onClick={() =>
                      setSettingDrafts((d) => ({ ...d, [setting.key]: String(setting.defaultValue) }))
                    }
                    title="Reset to default"
                    className="p-2 text-gray-400 hover:text-gray-700 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
        );
      })}

      {/*
        The per-profile allocation matrix used to live here as well. It has
        moved to Admin -> Asset classes, which is where classes are created and
        removed and which reads the live class list. This copy was built from
        the hardcoded shipped six, so saving a profile here wrote 0% to any
        class an admin had added -- silently, and straight through to every
        member on that profile.
      */}
      {/* Sleeve weights */}
      <section className="bg-white rounded-lg shadow-sm p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">
          Instrument split within each class
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          How a class&apos;s allocation divides across its instruments. This is where the crypto
          sleeve splits across BTC, ETH and XRP — it divides the crypto allocation, it does not
          change it. Each class must total 100%.
        </p>

        <div className="grid md:grid-cols-2 gap-5">
          {sleeveClasses.map((cls) => {
            const assets = data.sleeveAssets.filter((a) => a.assetClass === cls);
            const total = assets.reduce((s, a) => s + (Number(sleeveDrafts[a.id]) || 0), 0);
            const valid = Math.abs(total - 100) < 0.01;
            return (
              <div key={cls} className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-900 mb-3">
                  {classLabel(cls)}
                </p>
                <div className="space-y-2">
                  {assets.map((asset) => (
                    <div key={asset.id} className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {asset.symbol}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{asset.name}</p>
                      </div>
                      <input
                        type="number"
                        value={sleeveDrafts[asset.id] ?? ''}
                        onChange={(e) =>
                          setSleeveDrafts((d) => ({ ...d, [asset.id]: e.target.value }))
                        }
                        min={0}
                        max={100}
                        step="1"
                        className="w-16 sm:w-20 shrink-0 px-2 py-1.5 border border-gray-300 rounded text-base sm:text-sm text-right"
                      />
                      <span className="text-xs text-gray-400 w-4 shrink-0">%</span>
                    </div>
                  ))}
                </div>
                <div
                  className={`flex items-center justify-between mt-3 pt-3 border-t text-sm font-semibold ${
                    valid ? 'border-gray-100 text-gray-900' : 'border-red-200 text-red-600'
                  }`}
                >
                  <span>Total</span>
                  <span>{total.toFixed(1)}%</span>
                </div>
                {assets.length > 1 && (
                  <button
                    onClick={() => saveSleeve(cls)}
                    disabled={!valid || saving === cls}
                    className="w-full mt-3 py-2 rounded-lg bg-black text-white text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-gray-800 flex items-center justify-center gap-1"
                  >
                    {saving === cls ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    Save split
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
