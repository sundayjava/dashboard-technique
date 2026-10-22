'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  AlertCircle, ArrowLeft, Loader2, Minus, Plus, TrendingDown, TrendingUp, Wallet, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { SessionManager } from '@/lib/session';
import VaultDepositModal from '@/components/retirement-vault/VaultDepositModal';
import VaultWithdrawModal from '@/components/retirement-vault/VaultWithdrawModal';

interface Holding {
  symbol: string;
  assetClass: string;
  units: number;
  price: number;
  value: number;
  costBasis: number;
  gainLoss: number;
  gainLossPercent: number;
}

interface WithdrawalRow {
  id: string;
  amount: number;
  penaltyAmount: number;
  netAmount: number;
  isEarlyWithdrawal: boolean;
  status: string;
  requestedAt: string;
  noticeEndsAt: string;
  canCancel: boolean;
}

interface DashboardData {
  hasVault: boolean;
  vault: {
    vaultNumber: string;
    status: string;
    riskProfile: string;
    allocationMode: string;
    totalContributed: number;
    cashBalance: number;
    monthlyContribution: number | null;
  } | null;
  valuation: {
    totalValue: number;
    holdingsValue: number;
    unrealisedGainLoss: number;
    unrealisedGainLossPercent: number;
    benchmarkValue: number | null;
    currentAllocation: Record<string, number>;
    complete: boolean;
    missingPrices: string[];
    holdings: Holding[];
  } | null;
  targetAllocation: Record<string, number>;
  drift: { maxAbsoluteDrift: number; rebalanceRequired: boolean } | null;
  fundingAccount: { accountNumber: string; balance: number } | null;
}

const CLASS_LABELS: Record<string, string> = {
  GLOBAL_EQUITIES: 'Global Equities',
  FIXED_INCOME: 'Bonds / Fixed Income',
  COMMODITIES: 'Commodities',
  REAL_ESTATE: 'Real Estate / REITs',
  FUTURES_MACRO: 'Futures / Macro',
  CRYPTO: 'Crypto',
};

const PROFILE_LABELS: Record<string, string> = {
  CONSERVATIVE: 'Conservative',
  BALANCED: 'Balanced',
  GROWTH: 'Growth',
};

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function RetirementVaultDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [availableToWithdraw, setAvailableToWithdraw] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/api/retirement-vault/dashboard');
      setData(res.data);
      if (!res.data.hasVault) {
        router.push('/retirement-vault/create');
        return;
      }
      // Withdrawals live on their own endpoint; a failure here must not blank
      // the whole dashboard.
      try {
        const w = await axios.get('/api/retirement-vault/withdraw');
        setWithdrawals(w.data?.requests ?? []);
        setAvailableToWithdraw(w.data?.availableToWithdraw ?? 0);
      } catch {
        setWithdrawals([]);
      }
    } catch {
      toast.error('Could not load your vault.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const cancelWithdrawal = async (id: string) => {
    try {
      await axios.delete(`/api/retirement-vault/withdraw?id=${id}`);
      toast.success('Request cancelled.');
      await load();
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Could not cancel.',
      );
    }
  };

  useEffect(() => {
    if (!SessionManager.getUser()) {
      router.push('/login');
      return;
    }
    load();
  }, [router, load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data?.vault) return null;

  const { vault, valuation, targetAllocation, drift, fundingAccount } = data;
  const pendingActivation = vault.status === 'PENDING_ACTIVATION';
  const gain = valuation?.unrealisedGainLoss ?? 0;
  const gainPositive = gain >= 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-black border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">
              <span className="text-[#c1ff72]">Retirement</span> Vault
            </h1>
            <p className="text-xs text-gray-400">{vault.vaultNumber}</p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer text-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Dashboard
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {pendingActivation && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">Your vault is not active yet</p>
              <p className="text-sm text-amber-800 mt-0.5">
                Nothing is invested until you fund it. Your first deposit buys your target
                allocation at current market prices.
              </p>
            </div>
            <button
              onClick={() => setDepositOpen(true)}
              className="shrink-0 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer"
            >
              Fund vault
            </button>
          </div>
        )}

        {valuation && !valuation.complete && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-900">
              Live prices are unavailable for {valuation.missingPrices.join(', ')}, so this value
              is incomplete.
            </p>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-black md:col-span-2">
            <p className="text-xs text-gray-500">Vault value</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {money(valuation?.totalValue ?? 0)}
            </p>
            <div className="flex items-center gap-2 mt-2">
              {gainPositive ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <span className={`text-sm font-medium ${gainPositive ? 'text-green-600' : 'text-red-600'}`}>
                {gainPositive ? '+' : ''}
                {money(gain)} ({valuation?.unrealisedGainLossPercent.toFixed(2) ?? '0.00'}%)
              </span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-5">
            <p className="text-xs text-gray-500">Total contributed</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{money(vault.totalContributed)}</p>
            {vault.monthlyContribution && (
              <p className="text-xs text-gray-500 mt-1">
                +{money(vault.monthlyContribution)}/month
              </p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm p-5">
            <p className="text-xs text-gray-500">vs traditional 401k</p>
            {valuation?.benchmarkValue != null ? (
              <>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {money(valuation.benchmarkValue)}
                </p>
                <p
                  className={`text-xs mt-1 font-medium ${
                    (valuation.totalValue ?? 0) >= valuation.benchmarkValue
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {(valuation.totalValue ?? 0) >= valuation.benchmarkValue ? 'Ahead by ' : 'Behind by '}
                  {money(Math.abs((valuation.totalValue ?? 0) - valuation.benchmarkValue))}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400 mt-2">Available once funded</p>
            )}
          </div>
        </div>

        {/* Profile strip */}
        <div className="bg-white rounded-lg shadow-sm p-5 flex flex-wrap items-center gap-x-8 gap-y-3">
          {[
            ['Risk profile', PROFILE_LABELS[vault.riskProfile] ?? vault.riskProfile],
            ['Allocation mode', vault.allocationMode.replace('_', ' ').toLowerCase()],
            ['Status', vault.status.replace('_', ' ').toLowerCase()],
            ['Uninvested cash', money(vault.cashBalance)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-sm font-semibold text-gray-900 capitalize">{value}</p>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {!pendingActivation && (
              <button
                onClick={() => setWithdrawOpen(true)}
                className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <Minus className="w-4 h-4" />
                Withdraw
              </button>
            )}
            <button
              onClick={() => setDepositOpen(true)}
              className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Deposit
            </button>
          </div>
        </div>

        {/* Allocation */}
        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Allocation</h2>
            {drift?.rebalanceRequired && (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                Drifted {drift.maxAbsoluteDrift.toFixed(1)} pts from target
              </span>
            )}
          </div>

          <div className="space-y-3">
            {Object.entries(targetAllocation)
              .filter(([, target]) => target > 0)
              .map(([cls, target]) => {
                const current = valuation?.currentAllocation?.[cls] ?? 0;
                return (
                  <div key={cls}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-700">{CLASS_LABELS[cls] ?? cls}</span>
                      <span className="text-gray-500">
                        {current.toFixed(1)}% <span className="text-gray-400">/ {target}% target</span>
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-[#c1ff72] rounded-full"
                        style={{ width: `${Math.min(100, current)}%` }}
                      />
                      <div
                        className="absolute top-0 h-full w-0.5 bg-gray-900"
                        style={{ left: `${Math.min(100, target)}%` }}
                        title={`Target ${target}%`}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
          <p className="text-xs text-gray-400 mt-4">
            The dark marker is your target. Crypto is capped at 5% in every mode.
          </p>
        </div>

        {/* Holdings */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Holdings</h2>
          </div>

          {!valuation || valuation.holdings.length === 0 ? (
            <div className="p-10 text-center">
              <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                Nothing invested yet. Fund your vault to buy your allocation.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left font-medium px-5 py-3">Asset</th>
                    <th className="text-right font-medium px-5 py-3">Units</th>
                    <th className="text-right font-medium px-5 py-3">Price</th>
                    <th className="text-right font-medium px-5 py-3">Value</th>
                    <th className="text-right font-medium px-5 py-3">Return</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {valuation.holdings.map((h) => (
                    <tr key={h.symbol}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{h.symbol}</p>
                        <p className="text-xs text-gray-500">
                          {CLASS_LABELS[h.assetClass] ?? h.assetClass}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600 font-mono text-xs">
                        {h.units.toFixed(6)}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">{money(h.price)}</td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900">
                        {money(h.value)}
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-medium ${
                          h.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {h.gainLoss >= 0 ? '+' : ''}
                        {h.gainLossPercent.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {withdrawals.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Withdrawal requests</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {withdrawals.map((w) => {
                const noticeRunning = w.status === 'PENDING_NOTICE';
                return (
                  <div key={w.id} className="px-5 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {money(w.amount)}
                        </span>
                        {w.penaltyAmount > 0 && (
                          <span className="text-xs text-red-600">
                            −{money(w.penaltyAmount)} penalty
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          you receive {money(w.netAmount)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {noticeRunning
                          ? `Released after ${new Date(w.noticeEndsAt).toLocaleDateString()}`
                          : `Requested ${new Date(w.requestedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded font-medium whitespace-nowrap ${
                        w.status === 'PAID'
                          ? 'bg-green-50 text-green-700'
                          : w.status === 'CANCELLED' || w.status === 'REJECTED'
                            ? 'bg-gray-100 text-gray-500'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {w.status.replace(/_/g, ' ').toLowerCase()}
                    </span>
                    {w.canCancel && (
                      <button
                        onClick={() => cancelWithdrawal(w.id)}
                        title="Cancel this request"
                        className="text-gray-400 hover:text-red-600 cursor-pointer shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100">
              You can cancel at any point before funds are released.
            </p>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center pb-6">
          Values are based on the most recent closing prices. Target returns shown elsewhere are
          targets, not guarantees.
        </p>
      </div>

      <VaultDepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        onSuccess={load}
        accountBalance={fundingAccount?.balance ?? 0}
        accountNumber={fundingAccount?.accountNumber ?? null}
        isActivation={pendingActivation}
      />

      <VaultWithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onSuccess={load}
        availableToWithdraw={availableToWithdraw}
      />
    </div>
  );
}
