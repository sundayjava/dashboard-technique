/**
 * Every member-facing string in the Retirement Vault onboarding flow.
 *
 * This file is the COMPLETE inventory and the shipped default. An admin can
 * override any entry; anything not overridden falls back to the value here, so
 * a missing or blank row can never leave a blank screen.
 *
 * Keys are stable: changing one orphans an admin's edit, so add a new key
 * rather than renaming an existing one.
 *
 * Risk-quiz questions are NOT here — they are managed separately with their
 * own scoring, under /admin/vault-questionnaire.
 */

export type CopyKind = 'heading' | 'text' | 'label' | 'placeholder' | 'button' | 'option';

export interface CopyEntry {
  key: string;
  value: string;
  /** Section shown in the admin screen. */
  group: string;
  /** What an admin sees as the field name. */
  label: string;
  /** Where it appears, for an admin who cannot see the page. */
  hint?: string;
  kind: CopyKind;
}

export const COPY_GROUPS = [
  'Page chrome',
  'Step 1 — Eligibility',
  'Step 2 — Risk profile',
  'Step 3 — Allocation',
  'Step 4 — Contributions',
  'Step 5 — Review & sign',
  'Asset class names',
  'After activation',
] as const;

export const DEFAULT_COPY: CopyEntry[] = [
  // ------------------------------------------------------------ page chrome
  { key: 'chrome.headerSubtitle', value: 'Retirement Vault Setup', group: 'Page chrome', label: 'Header subtitle', hint: 'Small text beside the logo', kind: 'label' },
  { key: 'chrome.exit', value: 'Exit', group: 'Page chrome', label: 'Exit button', kind: 'button' },
  { key: 'chrome.pageTitle', value: 'Open your Retirement Vault', group: 'Page chrome', label: 'Page title', kind: 'heading' },
  { key: 'chrome.pageSubtitle', value: 'A long-term retirement vehicle, allocated across equities, bonds, commodities, real estate and a capped crypto sleeve.', group: 'Page chrome', label: 'Page subtitle', kind: 'text' },
  { key: 'chrome.step1', value: 'Eligibility', group: 'Page chrome', label: 'Stepper label 1', kind: 'label' },
  { key: 'chrome.step2', value: 'Risk Profile', group: 'Page chrome', label: 'Stepper label 2', kind: 'label' },
  { key: 'chrome.step3', value: 'Allocation', group: 'Page chrome', label: 'Stepper label 3', kind: 'label' },
  { key: 'chrome.step4', value: 'Contributions', group: 'Page chrome', label: 'Stepper label 4', kind: 'label' },
  { key: 'chrome.step5', value: 'Review', group: 'Page chrome', label: 'Stepper label 5', kind: 'label' },
  { key: 'chrome.back', value: 'Back', group: 'Page chrome', label: 'Back button', kind: 'button' },
  { key: 'chrome.continue', value: 'Continue', group: 'Page chrome', label: 'Continue button', kind: 'button' },
  { key: 'chrome.scoring', value: 'Scoring', group: 'Page chrome', label: 'Continue button, while scoring', kind: 'button' },
  { key: 'chrome.activate', value: 'Activate vault', group: 'Page chrome', label: 'Final submit button', kind: 'button' },
  { key: 'chrome.creating', value: 'Creating', group: 'Page chrome', label: 'Submit button, while creating', kind: 'button' },

  // ------------------------------------------------------------- step 1
  { key: 'step1.heading', value: 'Eligibility & intent', group: 'Step 1 — Eligibility', label: 'Heading', kind: 'heading' },
  { key: 'step1.age.label', value: 'Your age *', group: 'Step 1 — Eligibility', label: 'Age field label', kind: 'label' },
  { key: 'step1.age.placeholder', value: '35', group: 'Step 1 — Eligibility', label: 'Age placeholder', kind: 'placeholder' },
  { key: 'step1.country.label', value: 'Country of residence *', group: 'Step 1 — Eligibility', label: 'Country field label', kind: 'label' },
  { key: 'step1.country.placeholder', value: 'USA', group: 'Step 1 — Eligibility', label: 'Country placeholder', kind: 'placeholder' },
  { key: 'step1.horizon.label', value: 'What is your Retirement horizon? *', group: 'Step 1 — Eligibility', label: 'Horizon question', kind: 'label' },
  { key: 'step1.horizon.help', value: 'This affects how much investment risk is appropriate for you, not just how much you are comfortable with.', group: 'Step 1 — Eligibility', label: 'Horizon helper text', kind: 'text' },
  { key: 'step1.horizon.years10', value: '10 years', group: 'Step 1 — Eligibility', label: 'Horizon option: 10 years', kind: 'option' },
  { key: 'step1.horizon.years15', value: '15 years', group: 'Step 1 — Eligibility', label: 'Horizon option: 15 years', kind: 'option' },
  { key: 'step1.horizon.years20', value: '20 years', group: 'Step 1 — Eligibility', label: 'Horizon option: 20 years', kind: 'option' },
  { key: 'step1.horizon.years25plus', value: '25+ years', group: 'Step 1 — Eligibility', label: 'Horizon option: 25+ years', kind: 'option' },
  { key: 'step1.vehicle.label', value: 'Is this your primary retirement vehicle? *', group: 'Step 1 — Eligibility', label: 'Vehicle question', kind: 'label' },
  { key: 'step1.vehicle.primary.label', value: 'Primary', group: 'Step 1 — Eligibility', label: 'Primary option title', kind: 'option' },
  { key: 'step1.vehicle.primary.hint', value: 'My main retirement provision', group: 'Step 1 — Eligibility', label: 'Primary option hint', kind: 'text' },
  { key: 'step1.vehicle.supplementary.label', value: 'Supplementary', group: 'Step 1 — Eligibility', label: 'Supplementary option title', kind: 'option' },
  { key: 'step1.vehicle.supplementary.hint', value: 'I have other retirement savings', group: 'Step 1 — Eligibility', label: 'Supplementary option hint', kind: 'text' },

  // ------------------------------------------------------------- step 2
  { key: 'step2.heading', value: 'Risk profile', group: 'Step 2 — Risk profile', label: 'Heading', kind: 'heading' },
  { key: 'step2.intro', value: 'There are no right answers — answer honestly so we allocate your vault appropriately.', group: 'Step 2 — Risk profile', label: 'Intro text', hint: 'The questions themselves are managed under Vault Questionnaire', kind: 'text' },

  // ------------------------------------------------------------- step 3
  { key: 'step3.heading', value: 'How should we allocate it?', group: 'Step 3 — Allocation', label: 'Heading', kind: 'heading' },
  { key: 'step3.profilePrefix', value: 'Your profile:', group: 'Step 3 — Allocation', label: 'Profile result prefix', hint: 'Followed by Conservative / Balanced / Growth', kind: 'label' },
  { key: 'step3.horizonLimited', value: 'Your answers alone suggested a higher-risk profile. We held it back because of your retirement horizon.', group: 'Step 3 — Allocation', label: 'Horizon guardrail notice', kind: 'text' },
  { key: 'step3.diversified.title', value: 'Diversified', group: 'Step 3 — Allocation', label: 'Diversified title', kind: 'option' },
  { key: 'step3.diversified.description', value: 'Spread across every asset class according to your risk profile.', group: 'Step 3 — Allocation', label: 'Diversified description', kind: 'text' },
  { key: 'step3.diversified.detail', value: 'The default for most members. Nothing to manage.', group: 'Step 3 — Allocation', label: 'Diversified detail', kind: 'text' },
  { key: 'step3.focused.title', value: 'Focused', group: 'Step 3 — Allocation', label: 'Focused title', kind: 'option' },
  { key: 'step3.focused.description', value: 'Concentrated in one asset class you choose, with the rest diversified.', group: 'Step 3 — Allocation', label: 'Focused description', kind: 'text' },
  { key: 'step3.focused.detail', value: 'Higher conviction, higher concentration risk.', group: 'Step 3 — Allocation', label: 'Focused detail', kind: 'text' },
  { key: 'step3.expert.title', value: 'Expert Allocator', group: 'Step 3 — Allocation', label: 'Expert Allocator title', kind: 'option' },
  { key: 'step3.expert.description', value: 'Acredis-managed and rebalanced as market conditions change.', group: 'Step 3 — Allocation', label: 'Expert Allocator description', kind: 'text' },
  { key: 'step3.expert.detail', value: 'You can still override any single allocation.', group: 'Step 3 — Allocation', label: 'Expert Allocator detail', kind: 'text' },
  { key: 'step3.focusClass.label', value: 'Which asset class? *', group: 'Step 3 — Allocation', label: 'Focus class question', kind: 'label' },
  { key: 'step3.cryptoWarning', value: 'Crypto is capped at 5% of any vault, so a crypto-focused vault will still hold no more than 5% in crypto. The rest stays diversified.', group: 'Step 3 — Allocation', label: 'Crypto focus warning', kind: 'text' },

  // ------------------------------------------------------------- step 4
  { key: 'step4.heading', value: 'Contributions', group: 'Step 4 — Contributions', label: 'Heading', kind: 'heading' },
  { key: 'step4.deposit.label', value: 'Initial deposit (USD) *', group: 'Step 4 — Contributions', label: 'Initial deposit label', kind: 'label' },
  { key: 'step4.deposit.placeholder', value: '10000', group: 'Step 4 — Contributions', label: 'Initial deposit placeholder', kind: 'placeholder' },
  { key: 'step4.deposit.help', value: 'Minimum $100.', group: 'Step 4 — Contributions', label: 'Initial deposit helper', kind: 'text' },
  { key: 'step4.auto.label', value: 'Set up a monthly auto-contribution', group: 'Step 4 — Contributions', label: 'Auto-contribution checkbox', kind: 'label' },
  { key: 'step4.auto.amountLabel', value: 'Monthly amount (USD)', group: 'Step 4 — Contributions', label: 'Monthly amount label', kind: 'label' },
  { key: 'step4.auto.amountPlaceholder', value: '500', group: 'Step 4 — Contributions', label: 'Monthly amount placeholder', kind: 'placeholder' },
  { key: 'step4.auto.dayLabel', value: 'Day of month', group: 'Step 4 — Contributions', label: 'Day of month label', kind: 'label' },
  { key: 'step4.auto.dayHelp', value: 'Capped at the 28th so it never skips February.', group: 'Step 4 — Contributions', label: 'Day of month helper', kind: 'text' },
  { key: 'step4.lockIn.label', value: 'Lock-in preference *', group: 'Step 4 — Contributions', label: 'Lock-in question', kind: 'label' },
  { key: 'step4.lockIn.soft.label', value: 'Soft lock', group: 'Step 4 — Contributions', label: 'Soft lock title', kind: 'option' },
  { key: 'step4.lockIn.soft.hint', value: 'Committed to the long term. Early withdrawals carry a 14-day notice and may incur a penalty.', group: 'Step 4 — Contributions', label: 'Soft lock hint', kind: 'text' },
  { key: 'step4.lockIn.flexible.label', value: 'Flexible', group: 'Step 4 — Contributions', label: 'Flexible title', kind: 'option' },
  { key: 'step4.lockIn.flexible.hint', value: 'Easier access, with the 14-day notice period still applying.', group: 'Step 4 — Contributions', label: 'Flexible hint', kind: 'text' },

  // ------------------------------------------------------------- step 5
  { key: 'step5.heading', value: 'Review & activate', group: 'Step 5 — Review & sign', label: 'Heading', kind: 'heading' },
  { key: 'step5.disclaimerTitle', value: 'Before you sign', group: 'Step 5 — Review & sign', label: 'Disclaimer heading', kind: 'heading' },
  { key: 'step5.disclaimer.returns', value: 'Target returns shown anywhere in this product are targets, not guarantees. The value of your vault can fall as well as rise, and past performance does not predict future returns.', group: 'Step 5 — Review & sign', label: 'Disclaimer: returns', kind: 'text' },
  { key: 'step5.disclaimer.crypto', value: 'Crypto is capped at 5% of your vault at all times and cannot be exceeded in any allocation mode.', group: 'Step 5 — Review & sign', label: 'Disclaimer: crypto cap', kind: 'text' },
  { key: 'step5.disclaimer.withdrawal', value: 'Withdrawing before your retirement horizon requires 14 days’ notice and may incur a penalty.', group: 'Step 5 — Review & sign', label: 'Disclaimer: withdrawals', kind: 'text' },
  { key: 'step5.disclaimer.activation', value: 'Your vault activates only once your initial deposit has cleared. Nothing is invested before then.', group: 'Step 5 — Review & sign', label: 'Disclaimer: activation', kind: 'text' },
  { key: 'step5.signature.label', value: 'Type your full name to sign *', group: 'Step 5 — Review & sign', label: 'Signature field label', kind: 'label' },
  { key: 'step5.signature.placeholder', value: 'Your full name', group: 'Step 5 — Review & sign', label: 'Signature placeholder', hint: 'Shown when the account has no name on file', kind: 'placeholder' },
  { key: 'step5.consent', value: 'I confirm the information above is accurate and I accept the Retirement Vault terms, including the withdrawal notice period and the capped crypto allocation.', group: 'Step 5 — Review & sign', label: 'Consent checkbox text', kind: 'text' },

  // Asset class names. Shared vocabulary: these appear on the vault dashboard
  // too, which still carries its own copy of them. Wiring those is the next
  // step, so an edit here does not yet change the dashboard.
  { key: 'assetClass.GLOBAL_EQUITIES', value: 'Global Equities', group: 'Asset class names', label: 'Global Equities', kind: 'option' },
  { key: 'assetClass.FIXED_INCOME', value: 'Bonds / Fixed Income', group: 'Asset class names', label: 'Bonds / Fixed Income', kind: 'option' },
  { key: 'assetClass.COMMODITIES', value: 'Commodities (Gold, Silver)', group: 'Asset class names', label: 'Commodities', kind: 'option' },
  { key: 'assetClass.REAL_ESTATE', value: 'Real Estate / REITs', group: 'Asset class names', label: 'Real Estate / REITs', kind: 'option' },
  { key: 'assetClass.FUTURES_MACRO', value: 'Futures / Macro', group: 'Asset class names', label: 'Futures / Macro', kind: 'option' },
  { key: 'assetClass.CRYPTO', value: 'Crypto (capped at 5%)', group: 'Asset class names', label: 'Crypto', kind: 'option' },

  // --------------------------------------------------------- after activation
  { key: 'success.heading', value: 'Vault created', group: 'After activation', label: 'Success heading', kind: 'heading' },
  { key: 'success.notice', value: 'Your vault activates once your initial deposit has cleared. You then choose how to invest it, or hand a total to the Expert Allocator.', group: 'After activation', label: 'Activation notice', kind: 'text' },
  { key: 'success.cta', value: 'Go to my vault', group: 'After activation', label: 'Continue button', kind: 'button' },
];

/** Shipped defaults as a plain map, used as the fallback everywhere. */
export const DEFAULT_COPY_MAP: Record<string, string> = Object.fromEntries(
  DEFAULT_COPY.map((entry) => [entry.key, entry.value]),
);

/** Look up a string, falling back to the shipped default, then to the key. */
export function resolveCopy(
  overrides: Record<string, string> | null | undefined,
  key: string,
): string {
  const override = overrides?.[key];
  // A blank override is treated as "not set": an admin who clears a field
  // should get the default back, not an empty screen.
  if (typeof override === 'string' && override.trim() !== '') return override;
  return DEFAULT_COPY_MAP[key] ?? key;
}
