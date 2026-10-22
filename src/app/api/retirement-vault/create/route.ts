import { NextRequest, NextResponse } from 'next/server';
import {
  AllocationMode,
  ContributionStatus,
  ContributionType,
  LockInPreference,
  RetirementHorizon,
  VaultAssetClass,
  VaultStatus,
  VehicleType,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getAllAssetClasses, getTargetAllocation } from '@/lib/vault/allocation-model';
import { loadVaultPolicy } from '@/lib/vault/policy-store';
import { QuestionnaireAnswer, scoreQuestionnaire } from '@/lib/vault/risk-questionnaire';
import {
  CURRENT_TERMS_VERSION,
  MAX_AGE,
  MAX_INITIAL_DEPOSIT,
  MIN_AGE,
  MIN_INITIAL_DEPOSIT,
  generateVaultNumber,
  getOpenVaultForUser,
} from '@/lib/vault/vault-utils';

export const dynamic = 'force-dynamic';

interface CreateVaultBody {
  // Step 1
  age?: number;
  countryOfResidence?: string;
  horizon?: string;
  vehicleType?: string;
  // Step 2
  answers?: QuestionnaireAnswer[];
  // Step 3
  allocationMode?: string;
  focusedAssetClass?: string | null;
  // Step 4
  initialDeposit?: number;
  monthlyContribution?: number | null;
  monthlyContributionDay?: number | null;
  lockInPreference?: string;
  // Step 5
  signatureName?: string;
  consentConfirmed?: boolean;
}

function isEnumValue<T extends Record<string, string>>(
  enumObject: T,
  value: unknown,
): value is T[keyof T] {
  return typeof value === 'string' && Object.values(enumObject).includes(value);
}

/**
 * Create and activate a Retirement Vault.
 *
 * Every field that affects risk is recomputed here. The client sends ANSWERS,
 * never a profile or a score: a browser-supplied profile could simply be
 * edited, which would let a member bypass both the questionnaire and the
 * horizon guardrail. The same applies to the allocation, which is derived from
 * the server-scored profile rather than accepted from the request.
 *
 * The whole creation runs in one transaction. A vault without its allocations,
 * or with an initial contribution recorded but no vault, would be a broken
 * account holding someone's retirement money.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) return auth.response;

    const userId = auth.user.userId;
    const body = (await request.json()) as CreateVaultBody;

    // --- one vault per member ---------------------------------------------
    const existing = await getOpenVaultForUser(userId);
    if (existing !== null) {
      return NextResponse.json(
        {
          success: false,
          error: 'You already have a Retirement Vault.',
          vaultNumber: existing.vaultNumber,
        },
        { status: 409 },
      );
    }

    // --- step 1 -------------------------------------------------------------
    const age = Number(body.age);
    if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) {
      return NextResponse.json(
        { success: false, error: `Age must be between ${MIN_AGE} and ${MAX_AGE}.` },
        { status: 400 },
      );
    }

    const countryOfResidence = (body.countryOfResidence ?? '').trim();
    if (countryOfResidence.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Country of residence is required.' },
        { status: 400 },
      );
    }

    if (!isEnumValue(RetirementHorizon, body.horizon)) {
      return NextResponse.json(
        { success: false, error: 'A valid retirement horizon is required.' },
        { status: 400 },
      );
    }
    const horizon = body.horizon;

    if (!isEnumValue(VehicleType, body.vehicleType)) {
      return NextResponse.json(
        { success: false, error: 'Select whether this is a primary or supplementary vehicle.' },
        { status: 400 },
      );
    }
    const vehicleType = body.vehicleType;

    // --- step 2: score server-side ------------------------------------------
    if (!Array.isArray(body.answers)) {
      return NextResponse.json(
        { success: false, error: 'Questionnaire answers are required.' },
        { status: 400 },
      );
    }

    const assessment = scoreQuestionnaire(body.answers, horizon);
    if (!assessment.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please complete the risk questionnaire.',
          details: assessment.errors,
        },
        { status: 400 },
      );
    }
    const riskProfile = assessment.assignedProfile;

    // --- step 3 -------------------------------------------------------------
    if (!isEnumValue(AllocationMode, body.allocationMode)) {
      return NextResponse.json(
        { success: false, error: 'A valid allocation mode is required.' },
        { status: 400 },
      );
    }
    const allocationMode = body.allocationMode;

    let focusedAssetClass: VaultAssetClass | null = null;
    if (allocationMode === AllocationMode.FOCUSED) {
      if (!isEnumValue(VaultAssetClass, body.focusedAssetClass)) {
        return NextResponse.json(
          { success: false, error: 'Choose an asset class to focus on.' },
          { status: 400 },
        );
      }
      focusedAssetClass = body.focusedAssetClass;
    }

    // --- step 4 -------------------------------------------------------------
    const initialDeposit = Number(body.initialDeposit);
    if (
      !Number.isFinite(initialDeposit) ||
      initialDeposit < MIN_INITIAL_DEPOSIT ||
      initialDeposit > MAX_INITIAL_DEPOSIT
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Initial deposit must be between $${MIN_INITIAL_DEPOSIT.toLocaleString()} and $${MAX_INITIAL_DEPOSIT.toLocaleString()}.`,
        },
        { status: 400 },
      );
    }

    let monthlyContribution: number | null = null;
    let monthlyContributionDay: number | null = null;

    if (body.monthlyContribution !== null && body.monthlyContribution !== undefined) {
      const monthly = Number(body.monthlyContribution);
      if (!Number.isFinite(monthly) || monthly <= 0) {
        return NextResponse.json(
          { success: false, error: 'Monthly contribution must be a positive amount.' },
          { status: 400 },
        );
      }
      monthlyContribution = monthly;

      const day = Number(body.monthlyContributionDay ?? 1);
      // Capped at 28 so a monthly contribution never skips February.
      if (!Number.isInteger(day) || day < 1 || day > 28) {
        return NextResponse.json(
          { success: false, error: 'Contribution day must be between 1 and 28.' },
          { status: 400 },
        );
      }
      monthlyContributionDay = day;
    }

    if (!isEnumValue(LockInPreference, body.lockInPreference)) {
      return NextResponse.json(
        { success: false, error: 'A valid lock-in preference is required.' },
        { status: 400 },
      );
    }
    const lockInPreference = body.lockInPreference;

    // --- step 5 -------------------------------------------------------------
    const signatureName = (body.signatureName ?? '').trim();
    if (signatureName.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Please type your full name to sign.' },
        { status: 400 },
      );
    }

    if (body.consentConfirmed !== true) {
      return NextResponse.json(
        { success: false, error: 'You must accept the terms to activate your vault.' },
        { status: 400 },
      );
    }

    // --- derive the allocation from the SERVER-scored profile ---------------
    // Admin-configured policy, falling back to shipped defaults if unset or
    // invalid. Loaded at creation time so a vault records the targets that
    // were in force when the member signed, not whatever they become later.
    const policy = await loadVaultPolicy();
    const targetAllocation = getTargetAllocation(
      { riskProfile, mode: allocationMode, focusedAssetClass },
      policy,
    );

    const vaultNumber = await generateVaultNumber();
    const now = new Date();

    const vault = await prisma.$transaction(async (tx) => {
      const created = await tx.retirementVault.create({
        data: {
          userId,
          vaultNumber,
          ageAtOnboarding: age,
          countryOfResidence,
          horizon,
          vehicleType,
          riskProfile,
          allocationMode,
          focusedAssetClass,
          expertAllocatorActive: allocationMode === AllocationMode.EXPERT_ALLOCATOR,
          modeLastChangedAt: now,
          initialDeposit,
          monthlyContribution,
          monthlyContributionDay,
          lockInPreference,
          signedAt: now,
          signatureName,
          termsVersion: CURRENT_TERMS_VERSION,
          // PENDING_ACTIVATION until the deposit clears. The vault becomes
          // ACTIVE when the contribution is marked COMPLETED, so money is
          // never allocated before it has actually arrived.
          status: VaultStatus.PENDING_ACTIVATION,
        },
      });

      await tx.vaultRiskAssessment.create({
        data: {
          vaultId: created.id,
          answers: JSON.stringify(assessment.answers),
          score: assessment.score,
          assignedProfile: assessment.assignedProfile,
        },
      });

      await tx.vaultAllocation.createMany({
        data: getAllAssetClasses().map((assetClass) => ({
          vaultId: created.id,
          assetClass,
          targetPercent: targetAllocation[assetClass],
        })),
      });

      await tx.vaultContribution.create({
        data: {
          vaultId: created.id,
          type: ContributionType.INITIAL,
          amount: initialDeposit,
          currency: created.currency,
          status: ContributionStatus.PENDING,
        },
      });

      return created;
    });

    await prisma.notification.create({
      data: {
        userId,
        type: 'INVESTMENT',
        title: 'Retirement Vault created',
        message:
          `Your Retirement Vault ${vault.vaultNumber} has been created with a ` +
          `${riskProfile.toLowerCase()} profile. It will activate once your initial ` +
          `deposit of $${initialDeposit.toLocaleString()} has cleared.`,
        link: '/retirement-vault/dashboard',
      },
    }).catch((error) => {
      // A failed notification must not undo a created vault.
      console.error('[Vault Create] notification failed:', error);
    });

    return NextResponse.json({
      success: true,
      vault: {
        id: vault.id,
        vaultNumber: vault.vaultNumber,
        status: vault.status,
        riskProfile: vault.riskProfile,
        allocationMode: vault.allocationMode,
        initialDeposit: vault.initialDeposit,
      },
      assessment: {
        score: assessment.score,
        maxScore: assessment.maxScore,
        assignedProfile: assessment.assignedProfile,
        limitedByHorizon: assessment.limitedByHorizon,
        explanation: assessment.explanation,
      },
      targetAllocation,
    });
  } catch (error) {
    console.error('[Vault Create] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Could not create your vault.',
      },
      { status: 500 },
    );
  }
}
