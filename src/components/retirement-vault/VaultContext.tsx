'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
// Imported for its side effect: it installs the auth interceptor on load, so
// the fetch below cannot run before the Authorization header exists.
import '@/lib/axios-config';

/**
 * Shared vault state for the dashboard section.
 *
 * Held in the layout so the seven pages share one fetch. Without this, moving
 * between tabs would re-request the same valuation on every navigation, which
 * is a full price-and-holdings computation server-side.
 */

export interface Holding {
  symbol: string;
  assetClass: string;
  units: number;
  price: number;
  value: number;
  costBasis: number;
  gainLoss: number;
  gainLossPercent: number;
  priceDate: string;
}

export interface VaultSummary {
  id: string;
  vaultNumber: string;
  status: string;
  riskProfile: string;
  allocationMode: string;
  focusedAssetClass: string | null;
  expertAllocatorActive: boolean;
  horizon: string;
  currency: string;
  totalContributed: number;
  totalWithdrawn: number;
  cashBalance: number;
  monthlyContribution: number | null;
  lockInPreference: string;
  activatedAt: string | null;
  createdAt: string;
}

export interface Valuation {
  totalValue: number;
  holdingsValue: number;
  cashBalance: number;
  unrealisedGainLoss: number;
  unrealisedGainLossPercent: number;
  benchmarkValue: number | null;
  currentAllocation: Record<string, number>;
  /** Performance the daily engine has credited, summed across classes. */
  accruedPerformance: number;
  /** Principal and credited performance per class. */
  classValues: Record<string, { principal: number; accrued: number; value: number }>;
  complete: boolean;
  missingPrices: string[];
  holdings: Holding[];
}

/** One asset class's rate for the most recently closed day. */
export interface ClassRate {
  assetClass: string;
  /** Sum of the class's instrument moves at the close. */
  assetSumPercent: number;
  /** What the admin added on top. */
  upliftPercent: number;
  /** assetSumPercent + upliftPercent: the rate the money grew by. */
  totalPercent: number;
  assetCount: number;
  breakdown: Array<{ symbol: string; changePercent: number }>;
}

export interface VaultData {
  hasVault: boolean;
  vault: VaultSummary | null;
  valuation: Valuation | null;
  targetAllocation: Record<string, number>;
  classPerformance: { date: string | null; rates: ClassRate[] };
  drift: { maxAbsoluteDrift: number; rebalanceRequired: boolean } | null;
  contributions: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    processedAt: string | null;
    createdAt: string;
  }>;
  fundingAccount: { accountNumber: string; balance: number } | null;
}

interface VaultContextValue {
  data: VaultData | null;
  loading: boolean;
  /** Re-fetch after any action that changes the vault. */
  refresh: () => Promise<void>;
}

const VaultContext = createContext<VaultContextValue>({
  data: null,
  loading: true,
  refresh: async () => undefined,
});

export function useVault() {
  return useContext(VaultContext);
}

export function VaultProvider({
  children,
  onMissingVault,
  onUnauthenticated,
}: {
  children: React.ReactNode;
  onMissingVault: () => void;
  onUnauthenticated: () => void;
}) {
  const [data, setData] = useState<VaultData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await axios.get('/api/retirement-vault/dashboard');
      setData(res.data);
      if (!res.data?.hasVault) onMissingVault();
    } catch (error) {
      // A 401 means the session has gone, which is a different problem from a
      // transient fetch failure and needs a different destination.
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        onUnauthenticated();
        return;
      }
      // Otherwise leave the last good data in place rather than blanking the
      // whole section because one refresh failed.
    } finally {
      setLoading(false);
    }
  }, [onMissingVault, onUnauthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <VaultContext.Provider value={{ data, loading, refresh }}>{children}</VaultContext.Provider>
  );
}

/* ---------------------------------------------------------------- helpers */

/**
 * Currency, for display.
 *
 * Both helpers tolerate a missing number and render an em dash. They are used
 * in roughly forty places against data that arrives over the network, and a
 * null reaching one of them used to throw inside render and take down the
 * whole page -- so a single absent field cost the member every other figure on
 * the screen as well.
 *
 * A dash rather than $0.00 on purpose: "no number" and "zero dollars" are
 * different statements, and showing a balance of zero that is really a failed
 * fetch is the more misleading of the two. Call sites that genuinely mean zero
 * already pass `?? 0`.
 */
export const money = (n: number | null | undefined) =>
  typeof n === 'number' && Number.isFinite(n)
    ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';

export const moneyShort = (n: number | null | undefined) =>
  typeof n === 'number' && Number.isFinite(n)
    ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : '—';

export const CLASS_LABELS: Record<string, string> = {
  GLOBAL_EQUITIES: 'Global Equities',
  FIXED_INCOME: 'Bonds / Fixed Income',
  COMMODITIES: 'Commodities',
  REAL_ESTATE: 'Real Estate / REITs',
  FUTURES_MACRO: 'Futures / Macro',
  CRYPTO: 'Crypto',
};

export const PROFILE_LABELS: Record<string, string> = {
  CONSERVATIVE: 'Conservative',
  BALANCED: 'Balanced',
  GROWTH: 'Growth',
};

export const MODE_LABELS: Record<string, string> = {
  DIVERSIFIED: 'Diversified',
  FOCUSED: 'Focused',
  EXPERT_ALLOCATOR: 'Expert Allocator',
};

/**
 * Share of the WHOLE vault, cash included.
 *
 * `valuation.currentAllocation` is deliberately a share of INVESTED value —
 * that is the right basis for drift, because pending cash should not make
 * every class look underweight and trigger a rebalance.
 *
 * It is the wrong basis to show beside a target. A member with uninvested
 * cash saw crypto at 7.3% against a 5% target and could only conclude the cap
 * had been breached, when in fact $750 of a $15,000 vault is exactly 5%. This
 * puts both numbers on the same denominator.
 */
export function sharesOfVault(
  currentAllocation: Record<string, number>,
  holdingsValue: number,
  cashBalance: number,
): { shares: Record<string, number>; cashPercent: number; vaultTotal: number } {
  const vaultTotal = holdingsValue + cashBalance;
  if (vaultTotal <= 0) return { shares: {}, cashPercent: 0, vaultTotal: 0 };

  const shares: Record<string, number> = {};
  for (const [cls, pct] of Object.entries(currentAllocation)) {
    const value = (holdingsValue * pct) / 100;
    shares[cls] = (value / vaultTotal) * 100;
  }
  return { shares, cashPercent: (cashBalance / vaultTotal) * 100, vaultTotal };
}
