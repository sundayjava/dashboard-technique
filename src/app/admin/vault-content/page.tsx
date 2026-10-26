'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Check, Loader2, RotateCcw, Search } from 'lucide-react';
import toast from 'react-hot-toast';

interface Entry {
  key: string;
  value: string;
  current: string;
  group: string;
  label: string;
  hint?: string;
  kind: string;
  isOverridden: boolean;
}

const KIND_BADGE: Record<string, string> = {
  heading: 'bg-purple-50 text-purple-700',
  text: 'bg-gray-100 text-gray-600',
  label: 'bg-blue-50 text-blue-700',
  placeholder: 'bg-amber-50 text-amber-700',
  button: 'bg-green-50 text-green-700',
  option: 'bg-pink-50 text-pink-700',
};

/**
 * Edit the member-facing onboarding copy.
 *
 * Every field shows the shipped default beneath it, so an admin can always see
 * what they are changing from and restore it in one click. Clearing a field
 * restores the default rather than emptying the page.
 */
export default function AdminVaultContentPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('');
  const [overriddenCount, setOverriddenCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/admin/vault-content');
      setEntries(res.data?.entries ?? []);
      setGroups(res.data?.groups ?? []);
      setOverriddenCount(res.data?.overriddenCount ?? 0);
      setDrafts({});
    } catch {
      toast.error('Could not load the onboarding copy.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changed = useMemo(
    () =>
      Object.entries(drafts).filter(([key, value]) => {
        const entry = entries.find((e) => e.key === key);
        return entry !== undefined && value !== entry.current;
      }),
    [drafts, entries],
  );

  const save = async () => {
    if (changed.length === 0) return;
    setSaving(true);
    try {
      await axios.put('/api/admin/vault-content', {
        entries: changed.map(([key, value]) => ({ key, value })),
      });
      toast.success(`Saved ${changed.length} change${changed.length > 1 ? 's' : ''}.`);
      await load();
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Could not save.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? entries.filter(
        (e) =>
          e.label.toLowerCase().includes(needle) ||
          e.current.toLowerCase().includes(needle) ||
          e.key.toLowerCase().includes(needle),
      )
    : entries;

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Onboarding copy</h1>
        <p className="text-sm text-gray-600 mt-1">
          Every piece of text a member reads while opening a Retirement Vault. Changes apply
          immediately. Clearing a field restores the original wording.
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {entries.length} editable strings · {overriddenCount} currently customised ·
          questions themselves are under <span className="font-medium">Vault Questionnaire</span>
        </p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search the copy…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm"
        />
      </div>

      {groups.map((group) => {
        const groupEntries = visible.filter((e) => e.group === group);
        if (groupEntries.length === 0) return null;

        return (
          <section key={group} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">{group}</h2>

            <div className="space-y-5">
              {groupEntries.map((entry) => {
                const draft = drafts[entry.key] ?? entry.current;
                const isDirty = draft !== entry.current;
                const isLong = entry.current.length > 70;

                return (
                  <div key={entry.key}>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <label className="text-sm font-medium text-gray-900">{entry.label}</label>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          KIND_BADGE[entry.kind] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {entry.kind}
                      </span>
                      {entry.isOverridden && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#c1ff72] text-black">
                          customised
                        </span>
                      )}
                      {isDirty && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          unsaved
                        </span>
                      )}
                    </div>

                    {entry.hint && <p className="text-xs text-gray-500 mb-1.5">{entry.hint}</p>}

                    <div className="flex items-start gap-2">
                      {isLong ? (
                        <textarea
                          value={draft}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [entry.key]: e.target.value }))
                          }
                          rows={3}
                          className={`flex-1 px-3 py-2 border rounded-xl text-sm ${
                            isDirty ? 'border-amber-300' : 'border-gray-200'
                          }`}
                        />
                      ) : (
                        <input
                          type="text"
                          value={draft}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [entry.key]: e.target.value }))
                          }
                          className={`flex-1 px-3 py-2 border rounded-xl text-sm ${
                            isDirty ? 'border-amber-300' : 'border-gray-200'
                          }`}
                        />
                      )}
                      <button
                        onClick={() => setDrafts((d) => ({ ...d, [entry.key]: entry.value }))}
                        disabled={draft === entry.value}
                        title="Restore the original wording"
                        className="p-2 text-gray-400 hover:text-gray-900 cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Always show what the original says, so an admin can see
                        exactly what they are changing away from. */}
                    {draft !== entry.value && (
                      <p className="text-xs text-gray-400 mt-1">
                        Original: &ldquo;{entry.value}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {visible.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
          <p className="text-sm text-gray-500">Nothing matches &ldquo;{filter}&rdquo;.</p>
        </div>
      )}

      {/* Sticky save bar: with 72 fields, a button at the bottom is unreachable. */}
      {changed.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 z-40">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <p className="text-sm text-gray-700">
              {changed.length} unsaved change{changed.length > 1 ? 's' : ''}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDrafts({})}
                disabled={saving}
                className="px-4 py-2 rounded-full border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 cursor-pointer"
              >
                Discard
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-full bg-black text-white text-sm font-medium hover:bg-gray-800 cursor-pointer disabled:opacity-40"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
