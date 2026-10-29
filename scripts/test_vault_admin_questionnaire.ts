import 'dotenv/config';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { RetirementHorizon } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { createSessionToken } from '../src/lib/session';
import {
  GET as qGET, PUT as qPUT, DELETE as qDELETE,
} from '../src/app/api/admin/vault-questionnaire/route';
import { GET as memberGET } from '../src/app/api/retirement-vault/questionnaire/route';
import {
  invalidateQuestionnaireCache, loadQuestionnaire, seedQuestionnaire,
} from '../src/lib/vault/questionnaire-store';
import { RISK_QUESTIONS, scoreQuestionnaire } from '../src/lib/vault/risk-questionnaire';
import { throwawayPassword } from './fixtures';

let passed = 0, failed = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label} ${detail}`); }
}

const STAMP = Date.now();
let adminId: string | null = null, memberId: string | null = null;
let adminToken = '', memberToken = '';
const createdQuestionIds: string[] = [];

function req(path: string, method: string, body?: unknown, token = adminToken) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function main() {
  console.log('=== 0. Setup ===');
  const admin = await prisma.user.create({
    data: {
      email: `qadmin-${STAMP}@internal.test`, name: 'Q Admin', role: 'ADMIN', password: throwawayPassword(),
      transactionPin: await bcrypt.hash('1234', 10), phoneNumber: '0', countryCode: 'NG',
      currency: 'USD', authorizationCode: `QA-${STAMP}`,
    },
  });
  adminId = admin.id;
  adminToken = createSessionToken(admin.id, admin.email, 'ADMIN');

  const member = await prisma.user.create({
    data: {
      email: `qmember-${STAMP}@internal.test`, name: 'Q Member', password: throwawayPassword(),
      transactionPin: await bcrypt.hash('1234', 10), phoneNumber: '0', countryCode: 'NG',
      currency: 'USD', authorizationCode: `QM-${STAMP}`,
    },
  });
  memberId = member.id;
  memberToken = createSessionToken(member.id, member.email, 'USER');

  console.log('\n=== 1. Only admins can manage it ===');
  const asMember = await qGET(req('/api/admin/vault-questionnaire', 'GET', undefined, memberToken));
  check('member blocked -> 403', asMember.status === 403, `got ${asMember.status}`);

  console.log('\n=== 2. Seeds the shipped questions on first view ===');
  const first = await qGET(req('/api/admin/vault-questionnaire', 'GET'));
  const firstBody = await first.json();
  check('admin can load', first.status === 200);
  check('7 questions present', firstBody.questions?.length >= 7, `got ${firstBody.questions?.length}`);
  check('scoring bands reported', typeof firstBody.scoring?.conservativeBand === 'string');
  console.log(`  bands: C ${firstBody.scoring.conservativeBand} · B ${firstBody.scoring.balancedBand} · G ${firstBody.scoring.growthBand}`);

  const reseed = await seedQuestionnaire();
  check('re-seeding adds nothing', reseed === 0, `got ${reseed}`);

  console.log('\n=== 3. Admin adds a question ===');
  const added = await qPUT(req('/api/admin/vault-questionnaire', 'PUT', {
    key: `test_q_${STAMP}`,
    question: 'How would you feel if your vault lost a third of its value in one year?',
    helpText: 'Be honest.',
    measures: 'willingness',
    options: [
      { value: 'panic', label: 'I would sell everything', score: 1 },
      { value: 'worry', label: 'I would be very worried', score: 2 },
      { value: 'accept', label: 'I would accept it', score: 3 },
      { value: 'buy', label: 'I would buy more', score: 4 },
    ],
  }));
  const addedBody = await added.json();
  check('question added', added.status === 200, JSON.stringify(addedBody));
  if (addedBody.questionId) createdQuestionIds.push(addedBody.questionId);

  invalidateQuestionnaireCache();
  const live = await loadQuestionnaire();
  check('live set now has 8 questions', live.length === 8, `got ${live.length}`);

  console.log('\n=== 4. Bands RESCALE instead of silently rebanding ===');
  const after = await qGET(req('/api/admin/vault-questionnaire', 'GET'));
  const afterBody = await after.json();
  check('max score rose to 32', afterBody.scoring?.maxScore === 32, `got ${afterBody.scoring?.maxScore}`);
  check('bands moved with it', afterBody.scoring?.conservativeBand !== firstBody.scoring?.conservativeBand,
    `${firstBody.scoring?.conservativeBand} -> ${afterBody.scoring?.conservativeBand}`);
  console.log(`  bands now: C ${afterBody.scoring.conservativeBand} · B ${afterBody.scoring.balancedBand} · G ${afterBody.scoring.growthBand}`);

  // All-lowest must still be CONSERVATIVE and all-highest still GROWTH.
  const lowest = live.map((q) => ({
    questionId: q.id,
    optionValue: [...q.options].sort((a, b) => a.score - b.score)[0]!.value,
  }));
  const highest = live.map((q) => ({
    questionId: q.id,
    optionValue: [...q.options].sort((a, b) => b.score - a.score)[0]!.value,
  }));
  const low = scoreQuestionnaire(lowest, RetirementHorizon.YEARS_25_PLUS, live);
  const high = scoreQuestionnaire(highest, RetirementHorizon.YEARS_25_PLUS, live);
  check('all-cautious is still CONSERVATIVE with 8 questions', low.assignedProfile === 'CONSERVATIVE', low.assignedProfile);
  check('all-bold is still GROWTH with 8 questions', high.assignedProfile === 'GROWTH', high.assignedProfile);
  check('score range reported as 8-32', low.score === 8 && high.score === 32, `${low.score}/${high.score}`);

  console.log('\n=== 5. Members are served the admin set, without scores ===');
  const served = await memberGET(req('/api/retirement-vault/questionnaire', 'GET', undefined, memberToken));
  const servedBody = await served.json();
  check('member sees 8 questions', servedBody.questions?.length === 8, `got ${servedBody.questions?.length}`);
  check('the new question is included',
    JSON.stringify(servedBody).includes('lost a third of its value'));
  check('scores still withheld from the client', !JSON.stringify(servedBody).includes('"score"'));

  console.log('\n=== 6. Bad edits are refused ===');
  const tooShort = await qPUT(req('/api/admin/vault-questionnaire', 'PUT', {
    question: 'Short', options: [{ value: 'a', label: 'A', score: 1 }, { value: 'b', label: 'B', score: 4 }],
  }));
  check('question text too short -> 400', tooShort.status === 400, `got ${tooShort.status}`);

  const oneOption = await qPUT(req('/api/admin/vault-questionnaire', 'PUT', {
    question: 'A perfectly reasonable length of question here?',
    options: [{ value: 'only', label: 'Only option', score: 2 }],
  }));
  check('single option -> 400', oneOption.status === 400, `got ${oneOption.status}`);

  const flatScores = await qPUT(req('/api/admin/vault-questionnaire', 'PUT', {
    question: 'Another perfectly reasonable question for testing?',
    options: [
      { value: 'a', label: 'A', score: 2 },
      { value: 'b', label: 'B', score: 2 },
    ],
  }));
  const flatBody = await flatScores.json();
  check('all-same-score question refused', flatScores.status === 400, `got ${flatScores.status}`);
  console.log(`  "${flatBody.error}"`);

  const badScore = await qPUT(req('/api/admin/vault-questionnaire', 'PUT', {
    question: 'Yet another perfectly reasonable question here?',
    options: [
      { value: 'a', label: 'A', score: 1 },
      { value: 'b', label: 'B', score: 99 },
    ],
  }));
  check('out-of-range score refused', badScore.status === 400, `got ${badScore.status}`);

  console.log('\n=== 7. Removing deactivates, never deletes ===');
  const target = createdQuestionIds[0]!;
  const removed = await qDELETE(req(`/api/admin/vault-questionnaire?id=${target}`, 'DELETE'));
  check('removal succeeds', removed.status === 200, `got ${removed.status}`);
  const stillThere = await prisma.vaultRiskQuestion.findUnique({ where: { id: target } });
  check('row still exists (past assessments reference it)', stillThere !== null);
  check('but is inactive', stillThere?.isActive === false);

  invalidateQuestionnaireCache();
  const back = await loadQuestionnaire();
  check('live set back to 7', back.length === 7, `got ${back.length}`);

  console.log('\n=== 8. The questionnaire cannot be emptied ===');
  const allActive = await prisma.vaultRiskQuestion.findMany({ where: { isActive: true } });
  // Deactivate all but one, then try the last.
  for (const q of allActive.slice(1)) {
    await prisma.vaultRiskQuestion.update({ where: { id: q.id }, data: { isActive: false } });
  }
  const lastOne = allActive[0]!;
  const emptyAttempt = await qDELETE(req(`/api/admin/vault-questionnaire?id=${lastOne.id}`, 'DELETE'));
  const emptyBody = await emptyAttempt.json();
  check('removing the last question is refused', emptyAttempt.status === 400, `got ${emptyAttempt.status}`);
  console.log(`  "${emptyBody.error}"`);

  console.log('\n=== 9. An empty stored set falls back to the shipped questions ===');
  await prisma.vaultRiskQuestion.updateMany({ data: { isActive: false } });
  invalidateQuestionnaireCache();
  const fallback = await loadQuestionnaire();
  check('falls back rather than scoring everyone zero',
    fallback.length === RISK_QUESTIONS.length, `got ${fallback.length}`);
  check('and it is the shipped set', fallback[0]!.id === RISK_QUESTIONS[0]!.id);
}

async function cleanup() {
  console.log('\n=== Cleanup ===');
  // Remove every question this run created or touched, then re-seed clean.
  await prisma.vaultRiskQuestion.deleteMany({}).catch(() => undefined);
  const seeded = await seedQuestionnaire();
  invalidateQuestionnaireCache();
  console.log(`  questionnaire restored: ${seeded} questions re-seeded`);

  for (const id of [adminId, memberId]) {
    if (!id) continue;
    await prisma.user.delete({ where: { id } }).catch(() => undefined);
  }
  const active = await prisma.vaultRiskQuestion.count({ where: { isActive: true } });
  console.log(`  active questions: ${active}`);
}

main()
  .catch((e) => { console.error('FATAL', e); failed++; })
  .finally(async () => {
    await cleanup();
    console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
    await prisma.$disconnect();
    process.exit(failed === 0 ? 0 : 1);
  });
