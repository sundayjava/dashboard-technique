import { prisma } from '@/lib/prisma';
import { RISK_QUESTIONS, RiskQuestion, validateQuestionnaire } from './risk-questionnaire';

/**
 * Admin-managed risk questionnaire.
 *
 * Mirrors the policy store's rule: stored questions are used only when the set
 * is VALID. An empty or broken questionnaire falls back to the shipped
 * questions rather than being used as-is — an empty set would otherwise score
 * every member zero and assign them all the most cautious profile, silently.
 */

const CACHE_TTL_MS = 30_000;
let cache: { questions: RiskQuestion[]; expiresAt: number } | null = null;

export function invalidateQuestionnaireCache(): void {
  cache = null;
}

export interface QuestionnaireLoadResult {
  questions: RiskQuestion[];
  /** True when the shipped defaults are being used instead of stored ones. */
  usingDefaults: boolean;
  warnings: string[];
}

export async function loadQuestionnaireDetailed(): Promise<QuestionnaireLoadResult> {
  const warnings: string[] = [];

  let rows;
  try {
    rows = await prisma.vaultRiskQuestion.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: { options: { orderBy: { displayOrder: 'asc' } } },
    });
  } catch (error) {
    return {
      questions: RISK_QUESTIONS,
      usingDefaults: true,
      warnings: [
        `Could not read stored questions (${
          error instanceof Error ? error.message : 'unknown error'
        }); using the shipped questionnaire.`,
      ],
    };
  }

  if (rows.length === 0) {
    return {
      questions: RISK_QUESTIONS,
      usingDefaults: true,
      warnings: ['No active questions are stored; using the shipped questionnaire.'],
    };
  }

  const questions: RiskQuestion[] = rows.map((row) => ({
    // The stable key is the id the assessment records, so a question can be
    // reworded without orphaning past answers.
    id: row.key,
    question: row.question,
    helpText: row.helpText ?? undefined,
    measures: (row.measures as RiskQuestion['measures']) ?? 'willingness',
    options: row.options.map((o) => ({ value: o.value, label: o.label, score: o.score })),
  }));

  const validation = validateQuestionnaire(questions);
  if (!validation.valid) {
    return {
      questions: RISK_QUESTIONS,
      usingDefaults: true,
      warnings: [
        `Stored questionnaire is invalid (${validation.errors.join('; ')}); using the shipped questionnaire.`,
        ...warnings,
      ],
    };
  }

  return { questions, usingDefaults: false, warnings };
}

/** Cached load. Use on hot paths. */
export async function loadQuestionnaire(): Promise<RiskQuestion[]> {
  if (cache !== null && cache.expiresAt > Date.now()) return cache.questions;

  const { questions, warnings } = await loadQuestionnaireDetailed();
  for (const warning of warnings) console.warn(`[Vault Questionnaire] ${warning}`);

  cache = { questions, expiresAt: Date.now() + CACHE_TTL_MS };
  return questions;
}

/**
 * Write the shipped questions into the database if none are stored.
 *
 * Existing rows are never touched: re-seeding must not undo an admin's edits.
 */
export async function seedQuestionnaire(): Promise<number> {
  const existing = await prisma.vaultRiskQuestion.count();
  if (existing > 0) return 0;

  let created = 0;
  for (const [index, question] of RISK_QUESTIONS.entries()) {
    await prisma.vaultRiskQuestion.create({
      data: {
        key: question.id,
        question: question.question,
        helpText: question.helpText ?? null,
        measures: question.measures,
        displayOrder: (index + 1) * 10,
        isActive: true,
        options: {
          create: question.options.map((o, i) => ({
            value: o.value,
            label: o.label,
            score: o.score,
            displayOrder: (i + 1) * 10,
          })),
        },
      },
    });
    created += 1;
  }

  invalidateQuestionnaireCache();
  return created;
}

export interface QuestionWriteResult {
  ok: boolean;
  errors: string[];
  questionId?: string;
}

export interface QuestionInput {
  id?: string;
  key?: string;
  question?: string;
  helpText?: string | null;
  measures?: string;
  displayOrder?: number;
  isActive?: boolean;
  options?: Array<{ value?: string; label?: string; score?: number }>;
}

const MEASURES = ['willingness', 'capacity', 'experience'];

/**
 * Create or update a question, validating the WHOLE resulting questionnaire
 * before committing.
 *
 * Validating the result rather than the single question is the point: an edit
 * that is fine in isolation can still leave the overall set unscoreable, and
 * finding that out after it is live means members are being banded wrongly.
 */
export async function upsertQuestion(
  input: QuestionInput,
  updatedBy: string,
): Promise<QuestionWriteResult> {
  const errors: string[] = [];

  const text = (input.question ?? '').trim();
  if (text.length < 10) errors.push('The question text is too short.');

  const measures = input.measures ?? 'willingness';
  if (!MEASURES.includes(measures)) {
    errors.push(`measures must be one of: ${MEASURES.join(', ')}.`);
  }

  const options = input.options ?? [];
  if (options.length < 2) errors.push('A question needs at least two options.');

  const seenValues = new Set<string>();
  for (const option of options) {
    const value = (option.value ?? '').trim();
    const label = (option.label ?? '').trim();
    const score = Number(option.score);

    if (value.length === 0) errors.push('Every option needs a stable value.');
    if (label.length === 0) errors.push('Every option needs a label.');
    if (!Number.isInteger(score) || score < 1 || score > 4) {
      errors.push(`Option "${label || value}" needs a score between 1 and 4.`);
    }
    if (seenValues.has(value)) errors.push(`Duplicate option value: ${value}`);
    seenValues.add(value);
  }

  // At least one low and one high option, or the question cannot discriminate
  // between a cautious and a bold member and is just noise in the score.
  const scores = options.map((o) => Number(o.score)).filter((n) => Number.isFinite(n));
  if (scores.length > 0 && Math.min(...scores) === Math.max(...scores)) {
    errors.push('All options carry the same score, so the question cannot distinguish anything.');
  }

  if (errors.length > 0) return { ok: false, errors };

  const key = (input.key ?? text.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)).trim();

  const existingByKey = await prisma.vaultRiskQuestion.findUnique({ where: { key } });
  if (existingByKey !== null && existingByKey.id !== input.id) {
    return { ok: false, errors: [`A question with the key "${key}" already exists.`] };
  }

  // Build the set as it WOULD be, and refuse the write if it does not score.
  const current = await prisma.vaultRiskQuestion.findMany({
    where: { isActive: true },
    include: { options: true },
  });

  const projected: RiskQuestion[] = current
    .filter((q) => q.id !== input.id)
    .map((q) => ({
      id: q.key,
      question: q.question,
      measures: q.measures as RiskQuestion['measures'],
      options: q.options.map((o) => ({ value: o.value, label: o.label, score: o.score })),
    }));

  if (input.isActive !== false) {
    projected.push({
      id: key,
      question: text,
      measures: measures as RiskQuestion['measures'],
      options: options.map((o) => ({
        value: String(o.value).trim(),
        label: String(o.label).trim(),
        score: Number(o.score),
      })),
    });
  }

  const projectedValidation = validateQuestionnaire(projected);
  if (!projectedValidation.valid) {
    return {
      ok: false,
      errors: [
        'This change would leave the questionnaire unscoreable:',
        ...projectedValidation.errors,
      ],
    };
  }

  const data = {
    key,
    question: text,
    helpText: input.helpText?.trim() || null,
    measures,
    displayOrder: Number.isFinite(Number(input.displayOrder))
      ? Number(input.displayOrder)
      : (projected.length + 1) * 10,
    isActive: input.isActive !== false,
    updatedBy,
  };

  const saved = await prisma.$transaction(async (tx) => {
    const question =
      input.id !== undefined
        ? await tx.vaultRiskQuestion.update({ where: { id: input.id }, data })
        : await tx.vaultRiskQuestion.create({ data });

    // Options are replaced wholesale: a partial update could leave an orphaned
    // option whose value no member can ever select.
    await tx.vaultRiskQuestionOption.deleteMany({ where: { questionId: question.id } });
    await tx.vaultRiskQuestionOption.createMany({
      data: options.map((o, i) => ({
        questionId: question.id,
        value: String(o.value).trim(),
        label: String(o.label).trim(),
        score: Number(o.score),
        displayOrder: (i + 1) * 10,
      })),
    });

    return question;
  });

  invalidateQuestionnaireCache();
  return { ok: true, errors: [], questionId: saved.id };
}

/**
 * Deactivate a question.
 *
 * Never deletes: a stored assessment was scored against this question, and a
 * later suitability review needs to be able to read what was asked.
 */
export async function deactivateQuestion(id: string): Promise<QuestionWriteResult> {
  const remaining = await prisma.vaultRiskQuestion.findMany({
    where: { isActive: true, id: { not: id } },
    include: { options: true },
  });

  if (remaining.length === 0) {
    return {
      ok: false,
      errors: ['At least one question must stay active, or no member can be assessed.'],
    };
  }

  const projected: RiskQuestion[] = remaining.map((q) => ({
    id: q.key,
    question: q.question,
    measures: q.measures as RiskQuestion['measures'],
    options: q.options.map((o) => ({ value: o.value, label: o.label, score: o.score })),
  }));

  const validation = validateQuestionnaire(projected);
  if (!validation.valid) {
    return {
      ok: false,
      errors: ['Removing this question would leave the questionnaire unscoreable:', ...validation.errors],
    };
  }

  await prisma.vaultRiskQuestion.update({ where: { id }, data: { isActive: false } });
  invalidateQuestionnaireCache();
  return { ok: true, errors: [] };
}

/** Reorder the active questions. */
export async function reorderQuestions(orderedIds: string[]): Promise<QuestionWriteResult> {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.vaultRiskQuestion.update({
        where: { id },
        data: { displayOrder: (index + 1) * 10 },
      }),
    ),
  );
  invalidateQuestionnaireCache();
  return { ok: true, errors: [] };
}
