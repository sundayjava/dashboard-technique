import { RetirementHorizon, RiskProfile } from '@prisma/client';

/**
 * Retirement Vault risk tolerance questionnaire.
 *
 * Seven questions mapping a member to one of three profiles. The copy is
 * deliberately plain: a member who misreads a question gives a wrong answer,
 * and a wrong answer here misallocates their retirement for years.
 *
 * Two principles shape the scoring:
 *
 *  1. Capacity and willingness are both measured. Willingness is how much
 *     volatility someone says they can stomach; capacity is how much they can
 *     actually afford to lose given their horizon, income stability and
 *     liquidity needs. Questionnaires that measure only willingness routinely
 *     put people in portfolios they cannot afford.
 *
 *  2. Horizon overrides enthusiasm. A member ten years from retirement cannot
 *     be assigned Growth however boldly they answer, because there is no time
 *     to recover from a late drawdown. See `applyHorizonGuardrail`.
 *
 * ADMIN CONFIGURABILITY: thresholds and weights are exported constants so they
 * can move to admin-editable settings later, alongside the allocation
 * percentages. These values become the defaults.
 */

export interface RiskQuestionOption {
  /** Stored against the assessment; keep stable once live. */
  value: string;
  label: string;
  /** 1 (most cautious) to 4 (most risk-tolerant). */
  score: number;
}

export interface RiskQuestion {
  id: string;
  /** What the member reads. */
  question: string;
  /** Optional clarifier shown beneath the question. */
  helpText?: string;
  /** What this question actually measures, for internal review. */
  measures: 'willingness' | 'capacity' | 'experience';
  options: RiskQuestionOption[];
}

export const RISK_QUESTIONS: RiskQuestion[] = [
  {
    id: 'drawdown_reaction',
    question:
      'Your vault falls 20% over three months. Markets are volatile and recovery is uncertain. What would you most likely do?',
    helpText:
      'There is no right answer. Be honest about what you would actually do, not what you think you should do.',
    measures: 'willingness',
    options: [
      {
        value: 'withdraw_all',
        label: 'Withdraw everything — I could not sit through further losses',
        score: 1,
      },
      {
        value: 'reduce_risk',
        label: 'Move to safer holdings and accept lower long-term growth',
        score: 2,
      },
      {
        value: 'hold',
        label: 'Hold and wait for recovery, even if it takes a few years',
        score: 3,
      },
      {
        value: 'buy_more',
        label: 'Contribute more, treating the fall as a chance to buy in cheaper',
        score: 4,
      },
    ],
  },
  {
    id: 'loss_tolerance',
    question:
      'In a bad year, what is the largest fall in your vault value you could accept without changing your plan?',
    helpText:
      'Over a long horizon, higher returns reliably come with larger temporary falls along the way.',
    measures: 'willingness',
    options: [
      { value: 'upto_5', label: 'Up to 5% — I need stability above all', score: 1 },
      { value: 'upto_15', label: 'Up to 15% — some movement is acceptable', score: 2 },
      { value: 'upto_30', label: 'Up to 30% — I expect bad years along the way', score: 3 },
      {
        value: 'over_30',
        label: 'More than 30% — short-term falls do not concern me',
        score: 4,
      },
    ],
  },
  {
    id: 'primary_goal',
    question: 'Which best describes what you want this vault to do?',
    measures: 'willingness',
    options: [
      {
        value: 'preserve',
        label: 'Protect what I put in, ahead of growing it',
        score: 1,
      },
      {
        value: 'beat_inflation',
        label: 'Stay comfortably ahead of inflation with modest growth',
        score: 2,
      },
      {
        value: 'steady_growth',
        label: 'Grow steadily, accepting the ups and downs that come with it',
        score: 3,
      },
      {
        value: 'maximise',
        label: 'Pursue the highest long-term return I can get',
        score: 4,
      },
    ],
  },
  {
    id: 'income_stability',
    question: 'How stable is your income outside this vault?',
    helpText:
      'This affects how much risk you can afford, separately from how much you want.',
    measures: 'capacity',
    options: [
      {
        value: 'unstable',
        label: 'Irregular or uncertain — it varies month to month',
        score: 1,
      },
      { value: 'somewhat_stable', label: 'Mostly steady, with some variation', score: 2 },
      { value: 'stable', label: 'Stable and predictable', score: 3 },
      {
        value: 'very_stable_growing',
        label: 'Stable, and I expect it to grow',
        score: 4,
      },
    ],
  },
  {
    id: 'liquidity_need',
    question:
      'How likely is it that you will need to take money out of this vault before you retire?',
    helpText:
      'Early withdrawals carry a notice period and may incur a penalty, so this matters.',
    measures: 'capacity',
    options: [
      { value: 'very_likely', label: 'Very likely — I may need it sooner', score: 1 },
      { value: 'possible', label: 'Possible, if something unexpected happens', score: 2 },
      { value: 'unlikely', label: 'Unlikely — I have separate savings for emergencies', score: 3 },
      {
        value: 'very_unlikely',
        label: 'Very unlikely — this money is set aside purely for retirement',
        score: 4,
      },
    ],
  },
  {
    id: 'emergency_fund',
    question:
      'If you faced an unexpected major expense tomorrow, could you cover it without touching this vault?',
    measures: 'capacity',
    options: [
      { value: 'no', label: 'No — this vault would be my main option', score: 1 },
      { value: 'partly', label: 'Partly — I could cover some of it', score: 2 },
      { value: 'yes', label: 'Yes — I have enough set aside separately', score: 3 },
      {
        value: 'yes_comfortably',
        label: 'Yes, comfortably, with savings left over',
        score: 4,
      },
    ],
  },
  {
    id: 'experience',
    question: 'How would you describe your experience with investing?',
    measures: 'experience',
    options: [
      { value: 'none', label: 'None — this would be my first investment', score: 1 },
      {
        value: 'some',
        label: 'Some — I have held savings products or funds',
        score: 2,
      },
      {
        value: 'experienced',
        label: 'Experienced — I have invested through a market downturn before',
        score: 3,
      },
      {
        value: 'very_experienced',
        label: 'Very experienced — I actively manage investments',
        score: 4,
      },
    ],
  },
];

/** Lowest and highest achievable scores, derived rather than hardcoded. */
export const MIN_SCORE = RISK_QUESTIONS.reduce(
  (total, q) => total + Math.min(...q.options.map((o) => o.score)),
  0,
);
export const MAX_SCORE = RISK_QUESTIONS.reduce(
  (total, q) => total + Math.max(...q.options.map((o) => o.score)),
  0,
);

/**
 * Score bands. With 7 questions scored 1-4 the range is 7-28.
 *
 * The bands are intentionally not equal thirds: the Conservative band is
 * widest because the cost of placing a cautious member in a volatile portfolio
 * is far higher than the reverse. Someone who is genuinely Growth-suited and
 * lands in Balanced gives up some upside; someone Conservative-suited who
 * lands in Growth may abandon the plan at the worst possible moment.
 */
export const PROFILE_THRESHOLDS = {
  /** score <= this is Conservative */
  conservativeMax: 14,
  /** score <= this is Balanced, above is Growth */
  balancedMax: 21,
} as const;

/**
 * The same bands expressed as a FRACTION of the achievable range.
 *
 * Absolute cut-offs only work for exactly this question set. Once an admin can
 * add or remove questions the range moves, and a hardcoded 14 would quietly
 * reband everyone — adding one question would make the Conservative band
 * narrower for every future member without anyone touching it.
 *
 * These fractions reproduce the shipped bands on the default seven questions
 * (range 7-28): 0.3333 -> 14, 0.6667 -> 21.
 */
export const PROFILE_BAND_FRACTIONS = {
  conservativeMax: (14 - 7) / (28 - 7),
  balancedMax: (21 - 7) / (28 - 7),
} as const;

/**
 * Resolve the absolute cut-offs for a given achievable range.
 *
 * Falls back to the shipped absolutes on a degenerate range, so a
 * misconfigured questionnaire cannot produce bands that classify everyone the
 * same way.
 */
export function resolveThresholds(
  minScore: number,
  maxScore: number,
  fractions: { conservativeMax: number; balancedMax: number } = PROFILE_BAND_FRACTIONS,
): { conservativeMax: number; balancedMax: number } {
  const span = maxScore - minScore;
  if (!Number.isFinite(span) || span <= 0) {
    return { ...PROFILE_THRESHOLDS };
  }
  return {
    conservativeMax: Math.round(minScore + span * fractions.conservativeMax),
    balancedMax: Math.round(minScore + span * fractions.balancedMax),
  };
}

/**
 * Horizon ceilings on the assigned profile.
 *
 * Risk capacity is bounded by time: a drawdown close to retirement cannot be
 * waited out. These caps apply AFTER scoring, so a member's answers can move
 * them down a profile but a short horizon can also hold them back.
 *
 * ADMIN NOTE: a candidate for admin configuration alongside the allocation
 * percentages.
 */
export const HORIZON_PROFILE_CEILING: Record<RetirementHorizon, RiskProfile> = {
  [RetirementHorizon.YEARS_10]: RiskProfile.BALANCED,
  [RetirementHorizon.YEARS_15]: RiskProfile.GROWTH,
  [RetirementHorizon.YEARS_20]: RiskProfile.GROWTH,
  [RetirementHorizon.YEARS_25_PLUS]: RiskProfile.GROWTH,
};

const PROFILE_RANK: Record<RiskProfile, number> = {
  [RiskProfile.CONSERVATIVE]: 0,
  [RiskProfile.BALANCED]: 1,
  [RiskProfile.GROWTH]: 2,
};

/** Map a raw score to a profile, before any horizon guardrail. */
export function profileFromScore(
  score: number,
  thresholds: { conservativeMax: number; balancedMax: number } = PROFILE_THRESHOLDS,
): RiskProfile {
  if (score <= thresholds.conservativeMax) return RiskProfile.CONSERVATIVE;
  if (score <= thresholds.balancedMax) return RiskProfile.BALANCED;
  return RiskProfile.GROWTH;
}

/**
 * Hold a profile down to what the member's horizon can support.
 * Never raises a profile — answers alone decide how far up someone goes.
 */
export function applyHorizonGuardrail(
  profile: RiskProfile,
  horizon: RetirementHorizon,
): { profile: RiskProfile; wasLimited: boolean; ceiling: RiskProfile } {
  const ceiling = HORIZON_PROFILE_CEILING[horizon];
  const limited = PROFILE_RANK[profile] > PROFILE_RANK[ceiling];
  return {
    profile: limited ? ceiling : profile,
    wasLimited: limited,
    ceiling,
  };
}

export interface QuestionnaireAnswer {
  questionId: string;
  optionValue: string;
}

export interface ScoredAnswer extends QuestionnaireAnswer {
  score: number;
  questionText: string;
  optionLabel: string;
  measures: RiskQuestion['measures'];
}

export interface QuestionnaireResult {
  valid: boolean;
  errors: string[];
  score: number;
  minScore: number;
  maxScore: number;
  /** Profile from the score alone. */
  scoredProfile: RiskProfile;
  /** Final profile after the horizon ceiling is applied. */
  assignedProfile: RiskProfile;
  limitedByHorizon: boolean;
  /** Member-facing sentence explaining the outcome. */
  explanation: string;
  answers: ScoredAnswer[];
}

/**
 * Score a completed questionnaire.
 *
 * Pure: no I/O, so it can be exercised directly and reused by both the
 * onboarding API and any later re-assessment flow.
 */
export function scoreQuestionnaire(
  answers: QuestionnaireAnswer[],
  horizon: RetirementHorizon,
  /**
   * The live question set. Defaults to the shipped questions so every existing
   * caller keeps working; an admin-managed set is passed in by the loader.
   */
  questions: RiskQuestion[] = RISK_QUESTIONS,
): QuestionnaireResult {
  const errors: string[] = [];
  const scored: ScoredAnswer[] = [];
  const byId = new Map(answers.map((a) => [a.questionId, a]));

  // Range and bands are derived from the questions actually in play, not from
  // the shipped seven.
  const minScore = questions.reduce(
    (t, q) => t + Math.min(...q.options.map((o) => o.score)),
    0,
  );
  const maxScore = questions.reduce(
    (t, q) => t + Math.max(...q.options.map((o) => o.score)),
    0,
  );
  const thresholds = resolveThresholds(minScore, maxScore);

  for (const question of questions) {
    const answer = byId.get(question.id);

    if (answer === undefined) {
      errors.push(`Unanswered question: ${question.id}`);
      continue;
    }

    const option = question.options.find((o) => o.value === answer.optionValue);
    if (option === undefined) {
      errors.push(
        `Invalid option "${answer.optionValue}" for question ${question.id}.`,
      );
      continue;
    }

    scored.push({
      questionId: question.id,
      optionValue: option.value,
      score: option.score,
      questionText: question.question,
      optionLabel: option.label,
      measures: question.measures,
    });
  }

  // Answers for questions that do not exist are rejected rather than ignored:
  // silently dropping them would hide a client/server mismatch.
  for (const answer of answers) {
    if (!questions.some((q) => q.id === answer.questionId)) {
      errors.push(`Unknown question id: ${answer.questionId}`);
    }
  }

  const score = scored.reduce((total, a) => total + a.score, 0);
  const valid = errors.length === 0;

  // An incomplete questionnaire must not produce a profile — a partial score
  // would understate risk tolerance purely because questions were missing.
  if (!valid) {
    return {
      valid: false,
      errors,
      score,
      minScore,
      maxScore,
      scoredProfile: RiskProfile.CONSERVATIVE,
      assignedProfile: RiskProfile.CONSERVATIVE,
      limitedByHorizon: false,
      explanation: 'The questionnaire is incomplete, so no profile has been assigned.',
      answers: scored,
    };
  }

  const scoredProfile = profileFromScore(score, thresholds);
  const guardrail = applyHorizonGuardrail(scoredProfile, horizon);

  return {
    valid: true,
    errors: [],
    score,
    minScore,
    maxScore,
    scoredProfile,
    assignedProfile: guardrail.profile,
    limitedByHorizon: guardrail.wasLimited,
    explanation: buildExplanation(score, scoredProfile, guardrail.wasLimited, horizon, maxScore),
    answers: scored,
  };
}

const PROFILE_SUMMARY: Record<RiskProfile, string> = {
  [RiskProfile.CONSERVATIVE]:
    'Your answers point to capital preservation: steadier returns, with a larger share in bonds and a smaller one in equities.',
  [RiskProfile.BALANCED]:
    'Your answers point to balanced growth: meaningful equity exposure, with bonds and commodities to cushion the falls.',
  [RiskProfile.GROWTH]:
    'Your answers point to long-term growth: a higher equity and alternatives weighting, accepting larger swings on the way.',
};

const HORIZON_YEARS: Record<RetirementHorizon, string> = {
  [RetirementHorizon.YEARS_10]: '10 years',
  [RetirementHorizon.YEARS_15]: '15 years',
  [RetirementHorizon.YEARS_20]: '20 years',
  [RetirementHorizon.YEARS_25_PLUS]: '25 or more years',
};

function buildExplanation(
  score: number,
  scoredProfile: RiskProfile,
  wasLimited: boolean,
  horizon: RetirementHorizon,
  maxScore: number = MAX_SCORE,
): string {
  const base = `You scored ${score} out of ${maxScore}. ${PROFILE_SUMMARY[scoredProfile]}`;

  if (!wasLimited) return base;

  // Being explicit about the override matters: a member told only their final
  // profile would reasonably wonder why their answers did not produce it.
  return (
    `You scored ${score} out of ${maxScore}, which on answers alone would suggest a ` +
    `higher-risk profile. Because your retirement horizon is ${HORIZON_YEARS[horizon]}, ` +
    `we have held your profile at a level that leaves time to recover from a downturn ` +
    `before you retire. ${PROFILE_SUMMARY[HORIZON_PROFILE_CEILING[horizon]]}`
  );
}

/** Sanity checks on the questionnaire definition itself. */
export function validateQuestionnaire(
  questions: RiskQuestion[] = RISK_QUESTIONS,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  if (questions.length === 0) {
    errors.push('The questionnaire has no active questions.');
    return { valid: false, errors };
  }

  for (const question of questions) {
    if (seenIds.has(question.id)) errors.push(`Duplicate question id: ${question.id}`);
    seenIds.add(question.id);

    if (question.options.length < 2) {
      errors.push(`${question.id} needs at least two options.`);
    }

    const seenValues = new Set<string>();
    for (const option of question.options) {
      if (seenValues.has(option.value)) {
        errors.push(`${question.id} has a duplicate option value: ${option.value}`);
      }
      seenValues.add(option.value);

      if (!Number.isInteger(option.score) || option.score < 1 || option.score > 4) {
        errors.push(`${question.id}/${option.value} has an out-of-range score.`);
      }
    }
  }

  // Every profile must be reachable against THIS set's range, or the bands are
  // misconfigured for the questions actually in use.
  const min = questions.reduce((t, q) => t + Math.min(...q.options.map((o) => o.score)), 0);
  const max = questions.reduce((t, q) => t + Math.max(...q.options.map((o) => o.score)), 0);
  const thresholds = resolveThresholds(min, max);

  if (profileFromScore(min, thresholds) !== RiskProfile.CONSERVATIVE) {
    errors.push('The minimum score does not map to CONSERVATIVE.');
  }
  if (profileFromScore(max, thresholds) !== RiskProfile.GROWTH) {
    errors.push('The maximum score does not map to GROWTH.');
  }
  if (thresholds.conservativeMax >= thresholds.balancedMax) {
    errors.push('Profile thresholds overlap or are inverted.');
  }
  if (thresholds.balancedMax >= max) {
    errors.push('The Balanced band swallows the Growth band — GROWTH is unreachable.');
  }

  return { valid: errors.length === 0, errors };
}
