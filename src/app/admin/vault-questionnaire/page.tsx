'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle, ArrowDown, ArrowUp, Check, Loader2, Plus, Trash2, X,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Option {
  value: string;
  label: string;
  score: number;
}

interface Question {
  id: string;
  key: string;
  question: string;
  helpText: string | null;
  measures: string;
  displayOrder: number;
  isActive: boolean;
  options: Option[];
}

interface Scoring {
  activeQuestions: number;
  minScore: number;
  maxScore: number;
  conservativeBand: string;
  balancedBand: string;
  growthBand: string;
}

const MEASURES = [
  { value: 'willingness', label: 'Willingness (how much risk they want)' },
  { value: 'capacity', label: 'Capacity (how much they can afford)' },
  { value: 'experience', label: 'Experience' },
];

const blankQuestion = (): Question => ({
  id: '',
  key: '',
  question: '',
  helpText: '',
  measures: 'willingness',
  displayOrder: 999,
  isActive: true,
  options: [
    { value: 'opt_1', label: '', score: 1 },
    { value: 'opt_2', label: '', score: 2 },
    { value: 'opt_3', label: '', score: 3 },
    { value: 'opt_4', label: '', score: 4 },
  ],
});

export default function AdminQuestionnairePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [scoring, setScoring] = useState<Scoring | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [assessmentCount, setAssessmentCount] = useState(0);
  const [draft, setDraft] = useState<Question | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/admin/vault-questionnaire');
      setQuestions(res.data?.questions ?? []);
      setScoring(res.data?.scoring ?? null);
      setWarnings(res.data?.warnings ?? []);
      setAssessmentCount(res.data?.assessmentCount ?? 0);
    } catch {
      toast.error('Could not load the questionnaire.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (q: Question) => {
    setSaving(q.id || 'new');
    try {
      await axios.put('/api/admin/vault-questionnaire', {
        id: q.id || undefined,
        key: q.key || undefined,
        question: q.question,
        helpText: q.helpText,
        measures: q.measures,
        displayOrder: q.displayOrder,
        isActive: q.isActive,
        options: q.options,
      });
      toast.success('Saved.');
      setDraft(null);
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

  const remove = async (q: Question) => {
    if (!confirm(`Remove "${q.question.slice(0, 50)}…" from the questionnaire?`)) return;
    setSaving(q.id);
    try {
      await axios.delete(`/api/admin/vault-questionnaire?id=${q.id}`);
      toast.success('Question removed.');
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

  const move = async (index: number, direction: -1 | 1) => {
    const active = questions.filter((q) => q.isActive);
    const next = index + direction;
    if (next < 0 || next >= active.length) return;
    const reordered = [...active];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(next, 0, moved!);
    setQuestions([...reordered, ...questions.filter((q) => !q.isActive)]);
    try {
      await axios.put('/api/admin/vault-questionnaire', {
        orderedIds: reordered.map((q) => q.id),
      });
      await load();
    } catch {
      toast.error('Could not reorder.');
      await load();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const active = questions.filter((q) => q.isActive);
  const inactive = questions.filter((q) => !q.isActive);

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Risk questionnaire</h1>
        <p className="text-sm text-gray-600 mt-1">
          The questions a member answers to be assigned a risk profile. Changes apply to new
          assessments; the {assessmentCount} already recorded keep the answers they were scored
          against.
        </p>
      </div>

      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              The stored questionnaire is not being used
            </p>
            <ul className="text-xs text-amber-800 mt-1 list-disc list-inside">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Scoring bands react live to the question set, so an admin can see
          what their edits did before a member is scored against it. */}
      {scoring && (
        <div className="bg-white rounded-lg shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Scoring</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['Active questions', String(scoring.activeQuestions)],
              ['Conservative', scoring.conservativeBand],
              ['Balanced', scoring.balancedBand],
              ['Growth', scoring.growthBand],
            ].map(([label, value]) => (
              <div key={label} className="bg-gray-50 rounded px-3 py-2">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-sm font-semibold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Bands are a fixed proportion of the achievable range ({scoring.minScore}–
            {scoring.maxScore}), so adding or removing a question rescales them rather than
            quietly rebanding everyone.
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => setDraft(blankQuestion())}
          disabled={draft !== null}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 cursor-pointer disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
          Add question
        </button>
      </div>

      {draft && (
        <QuestionEditor
          question={draft}
          onChange={setDraft}
          onSave={() => save(draft)}
          onCancel={() => setDraft(null)}
          saving={saving === 'new'}
          isNew
        />
      )}

      <div className="space-y-4">
        {active.map((q, index) => (
          <QuestionRow
            key={q.id}
            question={q}
            index={index}
            total={active.length}
            saving={saving === q.id}
            onSave={save}
            onRemove={remove}
            onMove={move}
          />
        ))}
      </div>

      {inactive.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Retired questions</h2>
          <p className="text-xs text-gray-500 mb-3">
            Kept rather than deleted, because past assessments were scored against them.
          </p>
          <div className="space-y-2">
            {inactive.map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-600 truncate">{q.question}</span>
                <button
                  onClick={() => save({ ...q, isActive: true })}
                  className="text-xs text-gray-500 hover:text-gray-900 cursor-pointer whitespace-nowrap"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionRow({
  question, index, total, saving, onSave, onRemove, onMove,
}: {
  question: Question;
  index: number;
  total: number;
  saving: boolean;
  onSave: (q: Question) => void;
  onRemove: (q: Question) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(question);

  useEffect(() => {
    setLocal(question);
  }, [question]);

  if (editing) {
    return (
      <QuestionEditor
        question={local}
        onChange={setLocal}
        onSave={() => {
          onSave(local);
          setEditing(false);
        }}
        onCancel={() => {
          setLocal(question);
          setEditing(false);
        }}
        saving={saving}
      />
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">{index + 1}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
              {question.measures}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900 mt-1">{question.question}</p>
          {question.helpText && (
            <p className="text-xs text-gray-500 mt-0.5">{question.helpText}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {question.options.map((o) => (
              <span
                key={o.value}
                className="text-xs px-2 py-1 rounded bg-gray-50 border border-gray-200 text-gray-600"
              >
                {o.label || o.value} <span className="text-gray-400">· {o.score}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            className="p-1.5 text-gray-400 hover:text-gray-900 cursor-pointer disabled:opacity-20"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            className="p-1.5 text-gray-400 hover:text-gray-900 cursor-pointer disabled:opacity-20"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 cursor-pointer"
          >
            Edit
          </button>
          <button
            onClick={() => onRemove(question)}
            disabled={saving}
            className="p-1.5 text-gray-400 hover:text-red-600 cursor-pointer disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function QuestionEditor({
  question, onChange, onSave, onCancel, saving, isNew,
}: {
  question: Question;
  onChange: (q: Question) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew?: boolean;
}) {
  const setOption = (i: number, patch: Partial<Option>) => {
    const options = [...question.options];
    options[i] = { ...options[i]!, ...patch };
    onChange({ ...question, options });
  };

  const scores = question.options.map((o) => o.score);
  const allSame = scores.length > 0 && Math.min(...scores) === Math.max(...scores);

  return (
    <div className="bg-white rounded-lg shadow-sm p-5 border-2 border-gray-900">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        {isNew ? 'New question' : 'Edit question'}
      </h3>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Question *</label>
          <textarea
            value={question.question}
            onChange={(e) => onChange({ ...question, question: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="What would you do if your vault fell 20%?"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Help text (optional)</label>
            <input
              type="text"
              value={question.helpText ?? ''}
              onChange={(e) => onChange({ ...question, helpText: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Measures</label>
            <select
              value={question.measures}
              onChange={(e) => onChange({ ...question, measures: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {MEASURES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs text-gray-600">
              Options — score 1 (most cautious) to 4 (most risk-tolerant)
            </label>
            <button
              onClick={() =>
                onChange({
                  ...question,
                  options: [
                    ...question.options,
                    { value: `opt_${question.options.length + 1}`, label: '', score: 1 },
                  ],
                })
              }
              className="text-xs text-gray-500 hover:text-gray-900 cursor-pointer"
            >
              + Add option
            </button>
          </div>

          <div className="space-y-2">
            {question.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={o.label}
                  onChange={(e) => setOption(i, { label: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Answer shown to the member"
                />
                <select
                  value={o.score}
                  onChange={(e) => setOption(i, { score: Number(e.target.value) })}
                  className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                {question.options.length > 2 && (
                  <button
                    onClick={() =>
                      onChange({
                        ...question,
                        options: question.options.filter((_, idx) => idx !== i),
                      })
                    }
                    className="p-1.5 text-gray-400 hover:text-red-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {allSame && (
            <p className="text-xs text-amber-700 mt-2">
              All options carry the same score, so this question cannot distinguish anything.
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={onSave}
          disabled={saving || question.question.trim().length < 10 || allSame}
          className="flex items-center gap-1 px-4 py-2 rounded-lg bg-black text-white text-xs font-medium hover:bg-gray-800 cursor-pointer disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Save
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
