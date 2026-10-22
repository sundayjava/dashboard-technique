import { NextRequest, NextResponse } from 'next/server';
import { RetirementHorizon } from '@prisma/client';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getTargetAllocation } from '@/lib/vault/allocation-model';
import { loadVaultPolicy } from '@/lib/vault/policy-store';
import { QuestionnaireAnswer, scoreQuestionnaire } from '@/lib/vault/risk-questionnaire';
import { loadQuestionnaire } from '@/lib/vault/questionnaire-store';
import { AllocationMode } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * Score a questionnaire without persisting anything.
 *
 * Backs the "here is your profile" screen at the end of step 2, so the member
 * sees their result before committing. Scoring runs here rather than in the
 * browser for the same reason the weights are withheld: a client-computed
 * profile could simply be edited.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const { answers, horizon } = body as {
      answers?: QuestionnaireAnswer[];
      horizon?: string;
    };

    if (!Array.isArray(answers)) {
      return NextResponse.json(
        { success: false, error: 'answers must be an array' },
        { status: 400 },
      );
    }

    if (
      typeof horizon !== 'string' ||
      !Object.values(RetirementHorizon).includes(horizon as RetirementHorizon)
    ) {
      return NextResponse.json(
        { success: false, error: 'A valid retirement horizon is required' },
        { status: 400 },
      );
    }

    const questions = await loadQuestionnaire();
    const result = scoreQuestionnaire(answers, horizon as RetirementHorizon, questions);

    if (!result.valid) {
      return NextResponse.json(
        { success: false, error: 'Questionnaire incomplete', details: result.errors },
        { status: 400 },
      );
    }

    // Show the allocation the assigned profile implies, so the member sees the
    // consequence of their answers rather than just a label.
    const policy = await loadVaultPolicy();
    const previewAllocation = getTargetAllocation(
      { riskProfile: result.assignedProfile, mode: AllocationMode.DIVERSIFIED },
      policy,
    );

    return NextResponse.json({
      success: true,
      score: result.score,
      maxScore: result.maxScore,
      assignedProfile: result.assignedProfile,
      scoredProfile: result.scoredProfile,
      limitedByHorizon: result.limitedByHorizon,
      explanation: result.explanation,
      previewAllocation,
    });
  } catch (error) {
    console.error('[Vault Assess] error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not score the questionnaire' },
      { status: 500 },
    );
  }
}
