import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-middleware';
import { resolveThresholds } from '@/lib/vault/risk-questionnaire';
import {
  deactivateQuestion,
  loadQuestionnaireDetailed,
  reorderQuestions,
  seedQuestionnaire,
  upsertQuestion,
} from '@/lib/vault/questionnaire-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** The questionnaire as the admin manages it, including inactive questions. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.success) return auth.response;

    // Seed on first view so the screen is never empty on a fresh deploy.
    const seeded = await seedQuestionnaire();
    const { usingDefaults, warnings } = await loadQuestionnaireDetailed();

    const rows = await prisma.vaultRiskQuestion.findMany({
      orderBy: [{ isActive: 'desc' }, { displayOrder: 'asc' }],
      include: { options: { orderBy: { displayOrder: 'asc' } } },
    });

    const active = rows.filter((r) => r.isActive);
    const minScore = active.reduce(
      (t, q) => t + Math.min(...q.options.map((o) => o.score)),
      0,
    );
    const maxScore = active.reduce(
      (t, q) => t + Math.max(...q.options.map((o) => o.score)),
      0,
    );
    const thresholds = resolveThresholds(minScore, maxScore);

    const assessmentCount = await prisma.vaultRiskAssessment.count();

    return NextResponse.json({
      success: true,
      seeded,
      usingDefaults,
      warnings,
      // Surfaced so an admin can see what their edits did to the banding
      // before a member is scored against it.
      scoring: {
        activeQuestions: active.length,
        minScore,
        maxScore,
        conservativeBand: `${minScore}–${thresholds.conservativeMax}`,
        balancedBand: `${thresholds.conservativeMax + 1}–${thresholds.balancedMax}`,
        growthBand: `${thresholds.balancedMax + 1}–${maxScore}`,
      },
      assessmentCount,
      questions: rows.map((q) => ({
        id: q.id,
        key: q.key,
        question: q.question,
        helpText: q.helpText,
        measures: q.measures,
        displayOrder: q.displayOrder,
        isActive: q.isActive,
        options: q.options.map((o) => ({ value: o.value, label: o.label, score: o.score })),
      })),
    });
  } catch (error) {
    console.error('[Admin Questionnaire] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load the questionnaire.' },
      { status: 500 },
    );
  }
}

/** Create or update a question. */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.success) return auth.response;

    const body = await request.json();

    if (Array.isArray(body.orderedIds)) {
      const result = await reorderQuestions(body.orderedIds.map(String));
      return NextResponse.json({ success: result.ok });
    }

    const result = await upsertQuestion(body, auth.user.userId);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.errors.join(' ') },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, questionId: result.questionId });
  } catch (error) {
    console.error('[Admin Questionnaire] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not save the question.' },
      { status: 500 },
    );
  }
}

/** Deactivate a question. Never deletes — past assessments reference it. */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.success) return auth.response;

    const id = new URL(request.url).searchParams.get('id');
    if (id === null) {
      return NextResponse.json({ success: false, error: 'id is required.' }, { status: 400 });
    }

    const result = await deactivateQuestion(id);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.errors.join(' ') },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Questionnaire] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not remove the question.' },
      { status: 500 },
    );
  }
}
