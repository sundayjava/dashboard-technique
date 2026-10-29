'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Clock, Loader2, Lock, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Quote {
  amount: number;
  isEarly: boolean;
  penaltyPercent: number;
  penaltyAmount: number;
  netAmount: number;
  noticePeriodDays: number;
  explanation: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  availableToWithdraw: number;
}

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Request a withdrawal.
 *
 * The penalty and release date are quoted live as the member types, because
 * the whole point of the friction is that it should be visible BEFORE someone
 * commits, not discovered afterwards.
 */
export default function VaultWithdrawModal({
  open,
  onClose,
  onSuccess,
  availableToWithdraw,
}: Props) {
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /**
   * The confirmation step.
   *
   * A withdrawal is reviewed by an admin before any money moves, and it does
   * not land the same day. Telling a member that only after they have
   * committed turns a normal wait into a support ticket, so the last thing
   * between them and the request is a plain statement of what happens next.
   */
  const [confirming, setConfirming] = useState(false);

  const numericAmount = Number(amount);
  const amountValid = Number.isFinite(numericAmount) && numericAmount > 0;
  const withinBalance = numericAmount <= availableToWithdraw;

  const fetchQuote = useCallback(async (value: number) => {
    setQuoting(true);
    try {
      const res = await axios.get(`/api/retirement-vault/withdraw?quote=${value}`);
      setQuote(res.data?.quote ?? null);
    } catch {
      setQuote(null);
    } finally {
      setQuoting(false);
    }
  }, []);

  // Debounced so typing an amount does not fire a request per keystroke.
  useEffect(() => {
    if (!open || !amountValid || !withinBalance) {
      setQuote(null);
      return;
    }
    const timer = setTimeout(() => fetchQuote(numericAmount), 400);
    return () => clearTimeout(timer);
  }, [open, amountValid, withinBalance, numericAmount, fetchQuote]);

  useEffect(() => {
    if (!open) setConfirming(false);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!amountValid) {
      toast.error('Enter an amount.');
      return;
    }
    if (!withinBalance) {
      toast.error('That is more than you can withdraw.');
      return;
    }
    if (pin.length < 4) {
      toast.error('Enter your transaction PIN.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post('/api/retirement-vault/withdraw', {
        amount: numericAmount,
        transactionPin: pin,
        reason: reason.trim() || undefined,
      });
      toast.success('Withdrawal request submitted.');
      setAmount('');
      setPin('');
      setReason('');
      setQuote(null);
      setConfirming(false);
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : 'Could not submit your request.',
      );
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Withdraw from your vault</h2>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-500">Available to withdraw</p>
            <p className="text-lg font-bold text-gray-900">{money(availableToWithdraw)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount (USD)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setConfirming(false);
              }}
              min={1}
              step={50}
              disabled={submitting}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500"
              placeholder="1000"
            />
            {amount !== '' && !withinBalance && (
              <p className="text-xs text-red-600 mt-1">More than you can withdraw.</p>
            )}
          </div>

          {quoting && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              Calculating penalty…
            </div>
          )}

          {quote && !quoting && (
            <div
              className={`rounded-lg p-4 border ${
                quote.isEarly ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
              }`}
            >
              {quote.isEarly && (
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <p className="text-sm font-semibold text-amber-900">Early withdrawal</p>
                </div>
              )}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">You withdraw</span>
                  <span className="font-medium text-gray-900">{money(quote.amount)}</span>
                </div>
                {quote.penaltyAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Penalty ({quote.penaltyPercent}%)</span>
                    <span className="font-medium text-red-600">−{money(quote.penaltyAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1.5 border-t border-black/10">
                  <span className="font-semibold text-gray-900">You receive</span>
                  <span className="font-bold text-gray-900">{money(quote.netAmount)}</span>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-3">{quote.explanation}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              disabled={submitting}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 text-sm"
              placeholder="Helps us support you if anything needs review"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Transaction PIN</label>
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

        {confirming && (
          <div className="mx-6 mb-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-900">
                <p className="font-semibold">Before you submit</p>
                <ul className="mt-1.5 space-y-1 text-xs leading-relaxed">
                  <li>
                    Your request is reviewed by our team before any money moves. Nothing is
                    sold until it is approved.
                  </li>
                  {quote !== null && quote.noticePeriodDays > 0 && (
                    <li>
                      A {quote.noticePeriodDays}-day notice period applies, and you can cancel
                      free of charge at any point during it.
                    </li>
                  )}
                  <li>
                    Once approved, allow <span className="font-semibold">2 working days</span>{' '}
                    for the money to reach your account.
                  </li>
                  {quote !== null && quote.penaltyAmount > 0 && (
                    <li>
                      {money(quote.penaltyAmount)} will be deducted as an early withdrawal
                      penalty. You will receive {money(quote.netAmount)}.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={() => (confirming ? setConfirming(false) : onClose())}
            disabled={submitting}
            className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 cursor-pointer disabled:opacity-40"
          >
            {confirming ? 'Back' : 'Cancel'}
          </button>
          <button
            onClick={() => (confirming ? handleSubmit() : setConfirming(true))}
            disabled={submitting || !amountValid || !withinBalance || pin.length < 4}
            className="flex-1 py-3 rounded-lg bg-black text-white font-medium hover:bg-gray-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting
              </>
            ) : confirming ? (
              'Confirm withdrawal'
            ) : (
              'Review request'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
