'use client';

import { useState } from 'react';
import axios from 'axios';
import { AlertCircle, Loader2, Lock, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accountBalance: number;
  accountNumber: string | null;
  isActivation: boolean;
  minimumDeposit?: number;
}

/**
 * Fund a vault from the member's main account.
 *
 * Shows the exact consequence before confirming — amount out, balance left —
 * because this debits a real balance and buys holdings immediately rather
 * than queuing a request someone can cancel.
 */
export default function VaultDepositModal({
  open,
  onClose,
  onSuccess,
  accountBalance,
  accountNumber,
  isActivation,
  minimumDeposit = 100,
}: Props) {
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const numericAmount = Number(amount);
  const amountValid = Number.isFinite(numericAmount) && numericAmount >= minimumDeposit;
  const sufficient = numericAmount <= accountBalance;
  const remaining = accountBalance - (Number.isFinite(numericAmount) ? numericAmount : 0);

  const reset = () => {
    setAmount('');
    setPin('');
  };

  const handleSubmit = async () => {
    if (!amountValid) {
      toast.error(`The minimum deposit is $${minimumDeposit.toLocaleString()}.`);
      return;
    }
    if (!sufficient) {
      toast.error('That is more than your account balance.');
      return;
    }
    if (pin.length < 4) {
      toast.error('Enter your transaction PIN.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post('/api/retirement-vault/deposit', {
        amount: numericAmount,
        transactionPin: pin,
      });
      toast.success(
        res.data?.activated
          ? 'Your vault is now active and invested.'
          : 'Deposit invested into your vault.',
      );
      reset();
      onSuccess();
      onClose();
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Deposit failed.';
      toast.error(message);
      // Keep the amount so the member need not retype it, but never the PIN.
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {isActivation ? 'Activate your vault' : 'Deposit into your vault'}
          </h2>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {isActivation && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-900">
                This first deposit activates your vault. Your money is invested into your target
                allocation straight away at current market prices.
              </p>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-500">Funding account</p>
            <p className="text-sm font-medium text-gray-900">
              {accountNumber ?? 'Main account'}
            </p>
            <p className="text-lg font-bold text-gray-900 mt-1">
              ${accountBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount (USD)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={minimumDeposit}
              step={50}
              disabled={submitting}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500"
              placeholder={String(minimumDeposit)}
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-500">
                Minimum ${minimumDeposit.toLocaleString()}
              </p>
              {amount !== '' && Number.isFinite(numericAmount) && (
                <p className={`text-xs ${sufficient ? 'text-gray-500' : 'text-red-600'}`}>
                  {sufficient
                    ? `$${remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })} left after`
                    : 'More than your balance'}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transaction PIN
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                inputMode="numeric"
                autoComplete="off"
                disabled={submitting}
                className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 tracking-widest"
                placeholder="••••"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !amountValid || !sufficient || pin.length < 4}
            className="flex-1 py-3 rounded-lg bg-black text-white font-medium hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Investing
              </>
            ) : isActivation ? (
              'Activate vault'
            ) : (
              'Deposit'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
