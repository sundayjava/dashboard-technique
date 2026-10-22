import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { RISK_QUESTIONS } from '@/lib/vault/risk-questionnaire';

export const dynamic = 'force-dynamic';

/**
 * Serve the risk questionnaire.
 *
 * Option SCORES are deliberately stripped. If the client could see which
 * answer carries which weight, a member could work backwards to the profile
 * they wanted rather than the one their answers describe — which would defeat
 * the point of assessing suitability at all. Scoring happens server-side only.
 *
 * The `measures` field is also withheld: knowing a question tests "capacity"
 * rather than "willingness" is a similar hint.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.success) return auth.response;

  return NextResponse.json({
    success: true,
    questions: RISK_QUESTIONS.map((question) => ({
      id: question.id,
      question: question.question,
      helpText: question.helpText ?? null,
      options: question.options.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    })),
  });
}
