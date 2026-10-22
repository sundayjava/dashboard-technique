'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import axios from 'axios';
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle,
  ClipboardList, Loader2, PieChart, Shield, Sparkles, Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { SessionManager } from '@/lib/session';

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface QuestionOption {
  value: string;
  label: string;
}

interface Question {
  id: string;
  question: string;
  helpText: string | null;
  options: QuestionOption[];
}

interface AssessmentResult {
  score: number;
  maxScore: number;
  assignedProfile: string;
  scoredProfile: string;
  limitedByHorizon: boolean;
  explanation: string;
  previewAllocation: Record<string, number>;
}

interface CreatedVault {
  vaultNumber: string;
  status: string;
  riskProfile: string;
  initialDeposit: number;
}

const HORIZONS = [
  { value: 'YEARS_10', label: '10 years' },
  { value: 'YEARS_15', label: '15 years' },
  { value: 'YEARS_20', label: '20 years' },
  { value: 'YEARS_25_PLUS', label: '25+ years' },
];

const ALLOCATION_MODES = [
  {
    value: 'DIVERSIFIED',
    title: 'Diversified',
    icon: PieChart,
    description: 'Spread across every asset class according to your risk profile.',
    detail: 'The default for most members. Nothing to manage.',
  },
  {
    value: 'FOCUSED',
    title: 'Focused',
    icon: Wallet,
    description: 'Concentrated in one asset class you choose, with the rest diversified.',
    detail: 'Higher conviction, higher concentration risk.',
  },
  {
    value: 'EXPERT_ALLOCATOR',
    title: 'Expert Allocator',
    icon: Sparkles,
    description: 'Acredis-managed and rebalanced as market conditions change.',
    detail: 'You can still override any single allocation.',
  },
];

const ASSET_CLASSES = [
  { value: 'GLOBAL_EQUITIES', label: 'Global Equities' },
  { value: 'FIXED_INCOME', label: 'Bonds / Fixed Income' },
  { value: 'COMMODITIES', label: 'Commodities (Gold, Silver)' },
  { value: 'REAL_ESTATE', label: 'Real Estate / REITs' },
  { value: 'FUTURES_MACRO', label: 'Futures / Macro' },
  { value: 'CRYPTO', label: 'Crypto (capped at 5%)' },
];

const CLASS_LABELS: Record<string, string> = Object.fromEntries(
  ASSET_CLASSES.map((c) => [c.value, c.label]),
);

const PROFILE_LABELS: Record<string, string> = {
  CONSERVATIVE: 'Conservative',
  BALANCED: 'Balanced',
  GROWTH: 'Growth',
};

const steps = [
  { number: 1, title: 'Eligibility', icon: Shield },
  { number: 2, title: 'Risk Profile', icon: ClipboardList },
  { number: 3, title: 'Allocation', icon: PieChart },
  { number: 4, title: 'Contributions', icon: Wallet },
  { number: 5, title: 'Review', icon: Check },
];

export default function CreateRetirementVaultPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [checkingVault, setCheckingVault] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [created, setCreated] = useState<CreatedVault | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);

  // Step 1
  const [age, setAge] = useState('');
  const [country, setCountry] = useState('');
  const [horizon, setHorizon] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  // Step 3
  const [allocationMode, setAllocationMode] = useState('');
  const [focusedAssetClass, setFocusedAssetClass] = useState('');
  // Step 4
  const [initialDeposit, setInitialDeposit] = useState('');
  const [autoContribute, setAutoContribute] = useState(false);
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [contributionDay, setContributionDay] = useState('1');
  const [lockInPreference, setLockInPreference] = useState('');
  // Step 5
  const [signatureName, setSignatureName] = useState('');
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  useEffect(() => {
    const sessionUser = SessionManager.getUser();
    if (!sessionUser) {
      router.push('/login');
      return;
    }
    setUser(sessionUser);
  }, [router]);

  // Send a member who already has a vault to their dashboard rather than
  // walking them through creating a second one.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const [statusRes, questionsRes] = await Promise.all([
          axios.get('/api/retirement-vault/status'),
          axios.get('/api/retirement-vault/questionnaire'),
        ]);
        if (cancelled) return;

        if (statusRes.data?.hasVault) {
          toast('You already have a Retirement Vault.');
          router.push('/retirement-vault/dashboard');
          return;
        }
        setQuestions(questionsRes.data?.questions ?? []);
      } catch {
        if (!cancelled) toast.error('Could not load the onboarding form.');
      } finally {
        if (!cancelled) setCheckingVault(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, router]);

  const runAssessment = useCallback(async () => {
    setAssessing(true);
    try {
      const res = await axios.post('/api/retirement-vault/assess', {
        answers: Object.entries(answers).map(([questionId, optionValue]) => ({
          questionId,
          optionValue,
        })),
        horizon,
      });
      setAssessment(res.data);
      return true;
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Could not score your answers.';
      toast.error(message);
      return false;
    } finally {
      setAssessing(false);
    }
  }, [answers, horizon]);

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: {
        const ageNum = Number(age);
        if (!Number.isInteger(ageNum) || ageNum < 18 || ageNum > 100) {
          toast.error('Enter an age between 18 and 100.');
          return false;
        }
        if (country.trim().length < 2) {
          toast.error('Enter your country of residence.');
          return false;
        }
        if (!horizon) {
          toast.error('Select your retirement horizon.');
          return false;
        }
        if (!vehicleType) {
          toast.error('Tell us whether this is your primary vehicle.');
          return false;
        }
        return true;
      }
      case 2: {
        const unanswered = questions.filter((q) => !answers[q.id]);
        if (unanswered.length > 0) {
          toast.error(`Please answer all ${questions.length} questions.`);
          return false;
        }
        return true;
      }
      case 3: {
        if (!allocationMode) {
          toast.error('Choose how your vault should be allocated.');
          return false;
        }
        if (allocationMode === 'FOCUSED' && !focusedAssetClass) {
          toast.error('Choose the asset class to focus on.');
          return false;
        }
        return true;
      }
      case 4: {
        const deposit = Number(initialDeposit);
        if (!Number.isFinite(deposit) || deposit < 100) {
          toast.error('The minimum initial deposit is $100.');
          return false;
        }
        if (autoContribute) {
          const monthly = Number(monthlyContribution);
          if (!Number.isFinite(monthly) || monthly <= 0) {
            toast.error('Enter a monthly contribution amount.');
            return false;
          }
        }
        if (!lockInPreference) {
          toast.error('Select a lock-in preference.');
          return false;
        }
        return true;
      }
      case 5: {
        if (signatureName.trim().length < 3) {
          toast.error('Type your full name to sign.');
          return false;
        }
        if (!consentConfirmed) {
          toast.error('You must accept the terms to activate your vault.');
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  };

  const nextStep = async () => {
    if (!validateStep(currentStep)) return;

    // Score at the end of step 2 so the member sees their profile before
    // choosing an allocation mode that depends on it.
    if (currentStep === 2 && assessment === null) {
      const ok = await runAssessment();
      if (!ok) return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentStep((prev) => Math.min(prev + 1, 5));
  };

  const prevStep = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleAnswer = (questionId: string, optionValue: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionValue }));
    // Answers changed, so any existing result is stale.
    setAssessment(null);
  };

  const handleSubmit = async () => {
    if (!validateStep(5)) return;
    setSubmitting(true);
    try {
      const res = await axios.post('/api/retirement-vault/create', {
        age: Number(age),
        countryOfResidence: country.trim(),
        horizon,
        vehicleType,
        answers: Object.entries(answers).map(([questionId, optionValue]) => ({
          questionId,
          optionValue,
        })),
        allocationMode,
        focusedAssetClass: allocationMode === 'FOCUSED' ? focusedAssetClass : null,
        initialDeposit: Number(initialDeposit),
        monthlyContribution: autoContribute ? Number(monthlyContribution) : null,
        monthlyContributionDay: autoContribute ? Number(contributionDay) : null,
        lockInPreference,
        signatureName: signatureName.trim(),
        consentConfirmed,
      });

      setCreated(res.data.vault);
      toast.success('Your Retirement Vault has been created.');
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Could not create your vault.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || checkingVault) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (created) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-lg w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Vault created</h1>
          <p className="text-gray-600 mt-2">
            Your Retirement Vault <span className="font-semibold">{created.vaultNumber}</span> has
            been set up with a {PROFILE_LABELS[created.riskProfile] ?? created.riskProfile} profile.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-6 text-left">
            <p className="text-sm text-amber-900">
              Your vault activates once your initial deposit of{' '}
              <span className="font-semibold">${created.initialDeposit.toLocaleString()}</span> has
              cleared. Nothing is invested until then.
            </p>
          </div>
          <button
            onClick={() => router.push('/retirement-vault/dashboard')}
            className="w-full mt-6 bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors cursor-pointer"
          >
            Go to my vault
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-black shadow-sm border-b border-gray-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Image
                src="/logo/WG_Gbg_Fin-No-bg.png"
                alt="Acredis Finance"
                width={150}
                height={40}
                className="h-12 w-auto"
                priority
              />
              <div>
                <span className="text-xl font-bold text-white whitespace-nowrap">
                  <span className="text-[#c1ff72]">A</span>credis Finance
                </span>
                <p className="text-xs text-gray-500">Retirement Vault Setup</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center text-gray-300 cursor-pointer hover:text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Exit
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="md:text-3xl text-xl font-bold text-gray-900">
            Open your Retirement Vault
          </h1>
          <p className="text-gray-600 md:text-base text-sm md:mt-2">
            A long-term retirement vehicle, allocated across equities, bonds, commodities, real
            estate and a capped crypto sleeve.
          </p>
        </div>

        {/* Progress Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;

              return (
                <div key={step.number} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 md:h-12 h-10 md:w-12 rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-[#e0ff57] text-black scale-110'
                          : isCompleted
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {isCompleted ? <Check className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                    </div>
                    <span
                      className={`text-xs mt-2 text-center font-medium ${
                        isActive ? 'text-black' : isCompleted ? 'text-green-600' : 'text-gray-500'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-1 flex-1 mx-2 rounded ${
                        isCompleted ? 'bg-green-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 md:p-8">
          {/* ---------------------------------------------- Step 1 */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Eligibility & intent</h2>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your age *</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    min={18}
                    max={100}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    placeholder="35"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Country of residence *
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    placeholder="Nigeria"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How long until you retire? *
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {HORIZONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setHorizon(option.value);
                        setAssessment(null);
                      }}
                      className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                        horizon === option.value
                          ? 'border-black bg-[#e0ff57] text-black'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  This affects how much investment risk is appropriate for you, not just how much
                  you are comfortable with.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Is this your primary retirement vehicle? *
                </label>
                <div className="grid md:grid-cols-2 gap-3">
                  {[
                    { value: 'PRIMARY', label: 'Primary', hint: 'My main retirement provision' },
                    {
                      value: 'SUPPLEMENTARY',
                      label: 'Supplementary',
                      hint: 'I have other retirement savings',
                    },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setVehicleType(option.value)}
                      className={`px-4 py-3 rounded-lg border text-left transition-colors cursor-pointer ${
                        vehicleType === option.value
                          ? 'border-black bg-gray-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                      <span className="block text-xs text-gray-500 mt-0.5">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------- Step 2 */}
          {currentStep === 2 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Risk profile</h2>
                <p className="text-gray-600 text-sm mt-1">
                  Seven questions. There are no right answers — answer honestly so we allocate your
                  vault appropriately.
                </p>
              </div>

              {questions.map((question, index) => (
                <div key={question.id} className="border-b border-gray-100 pb-6 last:border-0">
                  <p className="text-sm font-medium text-gray-900">
                    {index + 1}. {question.question}
                  </p>
                  {question.helpText && (
                    <p className="text-xs text-gray-500 mt-1">{question.helpText}</p>
                  )}
                  <div className="mt-3 space-y-2">
                    {question.options.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleAnswer(question.id, option.value)}
                        className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors cursor-pointer ${
                          answers[question.id] === option.value
                            ? 'border-black bg-[#e0ff57] text-black font-medium'
                            : 'border-gray-300 text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ---------------------------------------------- Step 3 */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">How should we allocate it?</h2>

              {assessment && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        Your profile: {PROFILE_LABELS[assessment.assignedProfile]}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">{assessment.explanation}</p>
                    </div>
                  </div>

                  {assessment.limitedByHorizon && (
                    <div className="flex items-start gap-2 mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-900">
                        Your answers alone suggested a higher-risk profile. We held it back because
                        of your retirement horizon.
                      </p>
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(assessment.previewAllocation)
                      .filter(([, pct]) => pct > 0)
                      .map(([cls, pct]) => (
                        <div key={cls} className="bg-white border border-gray-200 rounded px-3 py-2">
                          <p className="text-xs text-gray-500">{CLASS_LABELS[cls] ?? cls}</p>
                          <p className="text-sm font-semibold text-gray-900">{pct.toFixed(0)}%</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {ALLOCATION_MODES.map((mode) => {
                  const Icon = mode.icon;
                  const selected = allocationMode === mode.value;
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setAllocationMode(mode.value)}
                      className={`w-full text-left p-5 rounded-lg border transition-colors cursor-pointer ${
                        selected ? 'border-black bg-gray-50' : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                            selected ? 'bg-[#e0ff57] text-black' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{mode.title}</p>
                          <p className="text-sm text-gray-600 mt-0.5">{mode.description}</p>
                          <p className="text-xs text-gray-500 mt-1">{mode.detail}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {allocationMode === 'FOCUSED' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Which asset class? *
                  </label>
                  <div className="grid md:grid-cols-2 gap-3">
                    {ASSET_CLASSES.map((cls) => (
                      <button
                        key={cls.value}
                        type="button"
                        onClick={() => setFocusedAssetClass(cls.value)}
                        className={`px-4 py-3 rounded-lg border text-sm text-left transition-colors cursor-pointer ${
                          focusedAssetClass === cls.value
                            ? 'border-black bg-[#e0ff57] text-black font-medium'
                            : 'border-gray-300 text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        {cls.label}
                      </button>
                    ))}
                  </div>
                  {focusedAssetClass === 'CRYPTO' && (
                    <div className="flex items-start gap-2 mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-900">
                        Crypto is capped at 5% of any vault, so a crypto-focused vault will still
                        hold no more than 5% in crypto. The rest stays diversified.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ---------------------------------------------- Step 4 */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Contributions</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial deposit (USD) *
                </label>
                <input
                  type="number"
                  value={initialDeposit}
                  onChange={(e) => setInitialDeposit(e.target.value)}
                  min={100}
                  step={50}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  placeholder="10000"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum $100.</p>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoContribute}
                    onChange={(e) => setAutoContribute(e.target.checked)}
                    className="w-4 h-4 accent-black"
                  />
                  <span className="text-sm font-medium text-gray-900">
                    Set up a monthly auto-contribution
                  </span>
                </label>

                {autoContribute && (
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Monthly amount (USD)
                      </label>
                      <input
                        type="number"
                        value={monthlyContribution}
                        onChange={(e) => setMonthlyContribution(e.target.value)}
                        min={1}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500"
                        placeholder="500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Day of month
                      </label>
                      <select
                        value={contributionDay}
                        onChange={(e) => setContributionDay(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500"
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={String(d)}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Capped at the 28th so it never skips February.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lock-in preference *
                </label>
                <div className="grid md:grid-cols-2 gap-3">
                  {[
                    {
                      value: 'SOFT_LOCK',
                      label: 'Soft lock',
                      hint: 'Committed to the long term. Early withdrawals carry a 14-day notice and may incur a penalty.',
                    },
                    {
                      value: 'FLEXIBLE',
                      label: 'Flexible',
                      hint: 'Easier access, with the 14-day notice period still applying.',
                    },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setLockInPreference(option.value)}
                      className={`px-4 py-3 rounded-lg border text-left transition-colors cursor-pointer ${
                        lockInPreference === option.value
                          ? 'border-black bg-gray-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                      <span className="block text-xs text-gray-500 mt-0.5">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------- Step 5 */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Review & activate</h2>

              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {[
                  ['Age', age],
                  ['Country', country],
                  ['Retirement horizon', HORIZONS.find((h) => h.value === horizon)?.label ?? '—'],
                  ['Vehicle', vehicleType === 'PRIMARY' ? 'Primary' : 'Supplementary'],
                  [
                    'Risk profile',
                    assessment ? PROFILE_LABELS[assessment.assignedProfile] : '—',
                  ],
                  [
                    'Allocation mode',
                    ALLOCATION_MODES.find((m) => m.value === allocationMode)?.title ?? '—',
                  ],
                  ...(allocationMode === 'FOCUSED'
                    ? [['Focused on', CLASS_LABELS[focusedAssetClass] ?? '—'] as [string, string]]
                    : []),
                  ['Initial deposit', `$${Number(initialDeposit || 0).toLocaleString()}`],
                  [
                    'Monthly contribution',
                    autoContribute
                      ? `$${Number(monthlyContribution || 0).toLocaleString()} on day ${contributionDay}`
                      : 'None',
                  ],
                  ['Lock-in', lockInPreference === 'SOFT_LOCK' ? 'Soft lock' : 'Flexible'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between px-4 py-3">
                    <span className="text-sm text-gray-500">{label}</span>
                    <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
                  </div>
                ))}
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-xs text-gray-600">
                <p className="font-semibold text-gray-900 text-sm">Before you sign</p>
                <p>
                  Target returns shown anywhere in this product are targets, not guarantees. The
                  value of your vault can fall as well as rise, and past performance does not
                  predict future returns.
                </p>
                <p>
                  Crypto is capped at 5% of your vault at all times and cannot be exceeded in any
                  allocation mode.
                </p>
                <p>
                  Withdrawing before your retirement horizon requires 14 days&apos; notice and may
                  incur a penalty.
                </p>
                <p>
                  Your vault activates only once your initial deposit has cleared. Nothing is
                  invested before then.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type your full name to sign *
                </label>
                <input
                  type="text"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500"
                  placeholder={user.name ?? 'Your full name'}
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentConfirmed}
                  onChange={(e) => setConsentConfirmed(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-black"
                />
                <span className="text-sm text-gray-700">
                  I confirm the information above is accurate and I accept the Retirement Vault
                  terms, including the withdrawal notice period and the capped crypto allocation.
                </span>
              </label>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
            <button
              onClick={prevStep}
              disabled={currentStep === 1 || submitting}
              className="flex items-center px-6 py-3 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </button>

            {currentStep < 5 ? (
              <button
                onClick={nextStep}
                disabled={assessing}
                className="flex items-center px-6 py-3 rounded-lg bg-black text-white font-medium hover:bg-gray-800 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {assessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scoring
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center px-6 py-3 rounded-lg bg-black text-white font-medium hover:bg-gray-800 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating
                  </>
                ) : (
                  <>
                    Activate vault
                    <Check className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
