'use client';

import { useState, useEffect } from 'react';
import { X, Wallet, Bitcoin, Loader2, AlertCircle, CheckCircle, Copy, Check, Hash } from 'lucide-react';
import { SessionManager } from '@/lib/session';
import { ChainAccountSessionManager } from '@/lib/chain-account-session';
import axios from 'axios';
import toast from 'react-hot-toast';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  chainAccountId: string;
  chainAccount?: {
    cryptoDepositAddress?: string | null;
    cryptoNetwork?: string | null;
    cryptoToken?: string | null;
  };
  onSuccess: () => void;
}

export default function DepositModal({ isOpen, onClose, chainAccountId, chainAccount, onSuccess }: DepositModalProps) {
  const [step, setStep] = useState<'method' | 'wallet' | 'crypto-amount' | 'crypto-hash'>('method');
  const [amount, setAmount] = useState('');
  const [transactionHash, setTransactionHash] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [userWalletBalance, setUserWalletBalance] = useState(0);
  const [walletCurrency, setWalletCurrency] = useState('USD');
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && step === 'method') {
      fetchWalletBalance();
    }
  }, [isOpen, step]);

  const fetchWalletBalance = async () => {
    setLoadingBalance(true);
    try {
      const user = SessionManager.getUser();
      if (!user) {
        toast.error('User session not found');
        return;
      }

      const accountRes = await axios.get(`/api/accounts?userId=${user.id}`);

      if (accountRes.data.accounts?.length > 0) {
        setUserWalletBalance(accountRes.data.accounts[0].balance);
        setWalletCurrency(accountRes.data.accounts[0].currency || 'USD');
      }
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      toast.error('Failed to load wallet balance');
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleWalletDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (parseFloat(amount) > userWalletBalance) {
      toast.error('Insufficient wallet balance');
      return;
    }

    setSubmitting(true);

    try {
      const token = ChainAccountSessionManager.getToken();
      if (!token) {
        toast.error('Chain Account session expired. Please log in again.');
        return;
      }

      const response = await axios.post(
        '/api/chain-account/deposit',
        {
          chainAccountId,
          amount: parseFloat(amount),
          depositMethod: 'WALLET',
          currency: walletCurrency,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        const { originalAmount, originalCurrency, amount: usdtAmount, newBalance } = response.data.deposit;

        const conversionMessage = originalCurrency !== 'USDT'
          ? ` (${originalCurrency} ${originalAmount} converted to USDT ${usdtAmount.toFixed(2)})`
          : '';

        toast.success(`Deposit successful!${conversionMessage} New balance: USDT ${newBalance.toFixed(2)}`);
        onSuccess();
        handleClose();
      }
    } catch (error: any) {
      console.error('Wallet deposit error:', error);
      toast.error(error.response?.data?.error || 'Failed to submit deposit');
    } finally {
      setSubmitting(false);
    }
  };

  const proceedToCryptoHash = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setStep('crypto-hash');
  };

  const handleCryptoDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!transactionHash || transactionHash.trim().length === 0) {
      toast.error('Please enter the transaction hash');
      return;
    }

    setSubmitting(true);

    try {
      const token = ChainAccountSessionManager.getToken();
      if (!token) {
        toast.error('Chain Account session expired. Please log in again.');
        return;
      }

      const response = await axios.post(
        '/api/chain-account/deposit',
        {
          chainAccountId,
          amount: parseFloat(amount),
          depositMethod: 'CRYPTO',
          transactionHash: transactionHash.trim(),
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success('Crypto deposit submitted! Awaiting admin verification.');
        onSuccess();
        handleClose();
      }
    } catch (error: any) {
      console.error('Crypto deposit error:', error);
      toast.error(error.response?.data?.error || 'Failed to submit deposit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyAddress = () => {
    if (chainAccount?.cryptoDepositAddress) {
      navigator.clipboard.writeText(chainAccount.cryptoDepositAddress);
      setCopied(true);
      toast.success('Address copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setStep('method');
    setAmount('');
    setTransactionHash('');
    setCopied(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Deposit Funds</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Choose Method */}
          {step === 'method' && (
            <div className="space-y-4">
              <p className="text-gray-600 text-sm mb-6">
                Choose how you'd like to deposit funds into your Chain Account
              </p>

              {/* Wallet Option */}
              <button
                onClick={() => setStep('wallet')}
                disabled={loadingBalance}
                className="w-full p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <Wallet className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-gray-900 mb-1">From Your Wallet</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      Instant transfer from your personal Acredis wallet
                    </p>
                    {loadingBalance ? (
                      <div className="flex items-center text-xs text-gray-500">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Loading balance...
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Available: <span className="font-semibold text-green-600">{walletCurrency} {userWalletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </p>
                    )}
                  </div>
                </div>
              </button>

              {/* Crypto Option */}
              <button
                onClick={() => setStep('crypto-amount')}
                className="w-full p-6 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all group"
              >
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                    <Bitcoin className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-gray-900 mb-1">Crypto Transfer</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      Deposit via cryptocurrency (USDT)
                    </p>
                    {chainAccount?.cryptoDepositAddress ? (
                      <p className="text-xs text-green-600 font-semibold">✓ Deposit address assigned</p>
                    ) : (
                      <p className="text-xs text-red-600">⚠ No deposit address assigned - contact admin</p>
                    )}
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Step 2: Wallet Deposit */}
          {step === 'wallet' && (
            <div className="space-y-6">
              <button
                onClick={() => setStep('method')}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
              >
                ← Back to methods
              </button>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <Wallet className="w-5 h-5 text-blue-600 mt-0.5 mr-3 shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold text-blue-900 mb-1">Instant Wallet Transfer</h4>
                    <p className="text-xs text-blue-700">
                      Funds will be instantly transferred to the Chain Account. All members will be notified via email.
                      {walletCurrency !== 'USDT' && (
                        <span className="block mt-1">Your {walletCurrency} will be automatically converted to USDT.</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deposit Amount ({walletCurrency})
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={userWalletBalance}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available: {walletCurrency} {userWalletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <button
                onClick={handleWalletDeposit}
                disabled={submitting || !amount || parseFloat(amount) <= 0}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold flex items-center justify-center"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Deposit Now (Instant)'
                )}
              </button>
            </div>
          )}

          {/* Step 3a: Crypto Amount */}
          {step === 'crypto-amount' && (
            <div className="space-y-6">
              <button
                onClick={() => setStep('method')}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
              >
                ← Back to methods
              </button>

              {!chainAccount?.cryptoDepositAddress ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                  <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
                  <h4 className="text-lg font-semibold text-red-900 mb-2">No Deposit Address Assigned</h4>
                  <p className="text-sm text-red-700">
                    This Chain Account does not have a crypto deposit address assigned yet. Please contact support to have one assigned.
                  </p>
                  <button
                    onClick={handleClose}
                    className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <Bitcoin className="w-5 h-5 text-orange-600 mt-0.5 mr-3 shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-orange-900 mb-1">Crypto Deposit</h4>
                        <p className="text-xs text-orange-700">
                          Enter the amount you're depositing, then you'll provide the transaction hash for verification.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Deposit Amount (USDT)
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  <button
                    onClick={proceedToCryptoHash}
                    disabled={!amount || parseFloat(amount) <= 0}
                    className="w-full py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold"
                  >
                    Next: Enter Transaction Hash
                  </button>
                </>
              )}
            </div>
          )}

          {/* Step 3b: Crypto Transaction Hash */}
          {step === 'crypto-hash' && (
            <div className="space-y-6">
              <button
                onClick={() => setStep('crypto-amount')}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
              >
                ← Back
              </button>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-green-900 mb-3">Deposit Address</h4>
                <div className="flex items-center space-x-2 mb-2">
                  <input
                    type="text"
                    value={chainAccount?.cryptoDepositAddress || ''}
                    readOnly
                    className="flex-1 px-3 py-2 border border-green-300 rounded-lg bg-white font-mono text-sm"
                  />
                  <button
                    onClick={handleCopyAddress}
                    className="px-3 py-2 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
                  >
                    {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5 text-green-600" />}
                  </button>
                </div>
                <p className="text-xs text-green-700">
                  Network: {chainAccount?.cryptoNetwork || 'TRC20'} • Token: {chainAccount?.cryptoToken || 'USDT'}
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-xs text-yellow-800 font-semibold mb-2">Amount to send:</p>
                <p className="text-2xl font-bold text-yellow-900">USDT {parseFloat(amount).toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 items-center">
                  <Hash className="w-4 h-4 mr-1" />
                  Transaction Hash
                </label>
                <input
                  type="text"
                  value={transactionHash}
                  onChange={(e) => setTransactionHash(e.target.value)}
                  placeholder="Enter your transaction hash"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  After sending USDT to the address above, paste the transaction hash here
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> Your deposit will be verified by our admin team. This typically takes 1-24 hours. All Chain Account members will be notified once approved.
                </p>
              </div>

              <button
                onClick={handleCryptoDeposit}
                disabled={submitting || !transactionHash.trim()}
                className="w-full py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold flex items-center justify-center"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit for Verification'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
