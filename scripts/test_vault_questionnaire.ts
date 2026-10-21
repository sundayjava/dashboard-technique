import { RetirementHorizon, RiskProfile } from '@prisma/client';
import {
  MAX_SCORE,
  MIN_SCORE,
  PROFILE_THRESHOLDS,
  RISK_QUESTIONS,
  QuestionnaireAnswer,
  applyHorizonGuardrail,
  profileFromScore,
  scoreQuestionnaire,
  validateQuestionnaire,
} from '../src/lib/vault/risk-questionnaire';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label} ${detail}`);
  }
}

/** Answer every question picking the option with the given score rank. */
function answerAll(pick: 'lowest' | 'highest' | 'second'): QuestionnaireAnswer[] {
  return RISK_QUESTIONS.map((q) => {
    const sorted = [...q.options].sort((a, b) => a.score - b.score);
    const option =
      pick === 'lowest' ? sorted[0] : pick === 'highest' ? sorted[sorted.length - 1] : sorted[1];
    return { questionId: q.id, optionValue: option!.value };
  });
}

console.log('=== 1. Questionnaire definition is sound ===');
const def = validateQuestionnaire();
check('definition validates', def.valid, def.errors.join('; '));
check('7 questions', RISK_QUESTIONS.length === 7, `got ${RISK_QUESTIONS.length}`);
check('score range is 7-28', MIN_SCORE === 7 && MAX_SCORE === 28, `${MIN_SCORE}-${MAX_SCORE}`);
console.log(`  questions measure: ${RISK_QUESTIONS.map((q) => q.measures).join(', ')}`);
const capacityCount = RISK_QUESTIONS.filter((q) => q.measures === 'capacity').length;
check('capacity is measured, not just willingness', capacityCount >= 3, `got ${capacityCount}`);

console.log('\n=== 2. Band boundaries ===');
check(`score ${MIN_SCORE} -> CONSERVATIVE`, profileFromScore(MIN_SCORE) === RiskProfile.CONSERVATIVE);
check('score 14 -> CONSERVATIVE', profileFromScore(14) === RiskProfile.CONSERVATIVE);
check('score 15 -> BALANCED', profileFromScore(15) === RiskProfile.BALANCED);
check('score 21 -> BALANCED', profileFromScore(21) === RiskProfile.BALANCED);
check('score 22 -> GROWTH', profileFromScore(22) === RiskProfile.GROWTH);
check(`score ${MAX_SCORE} -> GROWTH`, profileFromScore(MAX_SCORE) === RiskProfile.GROWTH);
console.log(
  `  bands: CONSERVATIVE ${MIN_SCORE}-${PROFILE_THRESHOLDS.conservativeMax}, ` +
    `BALANCED ${PROFILE_THRESHOLDS.conservativeMax + 1}-${PROFILE_THRESHOLDS.balancedMax}, ` +
    `GROWTH ${PROFILE_THRESHOLDS.balancedMax + 1}-${MAX_SCORE}`,
);

console.log('\n=== 3. End-to-end scoring ===');
const cautious = scoreQuestionnaire(answerAll('lowest'), RetirementHorizon.YEARS_25_PLUS);
check('all-cautious is valid', cautious.valid, cautious.errors.join('; '));
check('all-cautious scores the minimum', cautious.score === MIN_SCORE, `got ${cautious.score}`);
check('all-cautious -> CONSERVATIVE', cautious.assignedProfile === RiskProfile.CONSERVATIVE);

const bold = scoreQuestionnaire(answerAll('highest'), RetirementHorizon.YEARS_25_PLUS);
check('all-bold scores the maximum', bold.score === MAX_SCORE, `got ${bold.score}`);
check('all-bold -> GROWTH', bold.assignedProfile === RiskProfile.GROWTH);
check('all-bold not limited on a long horizon', !bold.limitedByHorizon);

const middling = scoreQuestionnaire(answerAll('second'), RetirementHorizon.YEARS_20);
check('second-lowest throughout -> CONSERVATIVE', middling.assignedProfile === RiskProfile.CONSERVATIVE, `score ${middling.score}`);
console.log(`  cautious=${cautious.score}  middling=${middling.score}  bold=${bold.score}`);

console.log('\n=== 4. Horizon guardrail ===');
const boldShortHorizon = scoreQuestionnaire(answerAll('highest'), RetirementHorizon.YEARS_10);
check(
  'max score + 10yr horizon is held at BALANCED',
  boldShortHorizon.assignedProfile === RiskProfile.BALANCED,
  `got ${boldShortHorizon.assignedProfile}`,
);
check('guardrail is flagged', boldShortHorizon.limitedByHorizon);
check(
  'scored profile still recorded as GROWTH',
  boldShortHorizon.scoredProfile === RiskProfile.GROWTH,
);
check(
  'explanation tells the member why',
  boldShortHorizon.explanation.includes('10 years') &&
    boldShortHorizon.explanation.toLowerCase().includes('recover'),
  boldShortHorizon.explanation,
);
console.log(`  "${boldShortHorizon.explanation}"`);

const guard = applyHorizonGuardrail(RiskProfile.CONSERVATIVE, RetirementHorizon.YEARS_10);
check('guardrail never RAISES a profile', guard.profile === RiskProfile.CONSERVATIVE && !guard.wasLimited);

console.log('\n=== 5. Bad input is rejected, not silently scored ===');
const incomplete = scoreQuestionnaire(
  answerAll('highest').slice(0, 4),
  RetirementHorizon.YEARS_20,
);
check('incomplete is invalid', !incomplete.valid);
check('incomplete assigns no real profile', incomplete.explanation.includes('incomplete'));
check('incomplete reports each missing question', incomplete.errors.length === 3, `got ${incomplete.errors.length}`);

const badOption = scoreQuestionnaire(
  [...answerAll('highest').slice(1), { questionId: RISK_QUESTIONS[0]!.id, optionValue: 'nonsense' }],
  RetirementHorizon.YEARS_20,
);
check('invalid option value is rejected', !badOption.valid, badOption.errors.join('; '));

const unknownQuestion = scoreQuestionnaire(
  [...answerAll('highest'), { questionId: 'does_not_exist', optionValue: 'x' }],
  RetirementHorizon.YEARS_20,
);
check('unknown question id is rejected', !unknownQuestion.valid, unknownQuestion.errors.join('; '));

console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
process.exit(failed === 0 ? 0 : 1);
