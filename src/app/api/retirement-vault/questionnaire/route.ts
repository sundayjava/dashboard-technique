import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { loadQuestionnaire } from '@/lib/vault/questionnaire-store';
import { getAssetClasses } from '@/lib/vault/asset-class-store';

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

  // Admin-managed set, falling back to the shipped questions if none stored.
  const questions = await loadQuestionnaire();

  // Onboarding's Focused picker was a hardcoded six, so a class added in
  // admin could never be chosen as a focus. Served here because onboarding
  // already fetches this endpoint.
  const assetClasses = await getAssetClasses();

  return NextResponse.json({
    success: true,
    assetClasses: assetClasses.map((c) => ({ key: c.key, name: c.name })),
    questions: questions.map((question) => ({
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
