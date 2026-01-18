'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Send, User, ArrowRight, CheckCircle, AlertCircle, Loader2, ArrowRightLeft } from 'lucide-react';
import { DashboardLayoutWrapper } from '@/components/layout/DashboardLayoutWrapper';
import { convertCurrency, formatCurrency } from '@/lib/currency-converter';
import axios from 'axios';

interface RecipientInfo {
  accountNumber: string;
  accountName: string;
  accountType: string;
  currency: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar: string | null;
}

interface Account {
  id: string;
  accountNumber: string;
  accountName: string;
  balance: number;
  availableBalance: number;
  currency: string;
}

export default function AcredisToAcredisTransferPage() {
  const router = useRouter();
  
  // Form states
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [recipientIdentifier, setRecipientIdentifier] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [pin, setPin] = useState(['', '', '', '']);
  
  // UI states
  const [recipientInfo, setRecipientInfo] = useState<RecipientInfo | null>(null);
  const [verifyingRecipient, setVerifyingRecipient] = useState(false);
  const [recipientVerified, setRecipientVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(1); // 1: Enter recipient, 2: Enter amount, 3: Confirm
  
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Calculate converted amount for recipient
  const convertedAmount = useMemo(() => {
    if (!amount || !selectedAccount || !recipientInfo) return null;
    
    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) return null;
    
    if (selectedAccount.currency === recipientInfo.currency) {
      return transferAmount;
    }
    
    try {
      return convertCurrency(transferAmount, selectedAccount.currency, recipientInfo.currency);
    } catch (error) {
      return null;
    }
  }, [amount, selectedAccount, recipientInfo]);

  const getUserId = () => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          return userData.id;
        } catch (error) {
          console.error('Error parsing stored user:', error);
        }
      }
    }
    return null;
  };

  useEffect(() => {
    const userId = getUserId();
    if (userId) {
      fetchAccounts(userId);
    }
  }, []);

  const fetchAccounts = async (userId: string) => {
    try {
      const response = await axios.get(`/api/accounts?userId=${userId}`);
      // API returns { accounts: [...] }
      const accountsData = response.data.accounts || [];
      const activeAccounts = accountsData.filter((acc: Account) => acc.balance !== undefined);
      
      if (activeAccounts.length === 0) {
        setError('No active accounts found. Please contact support.');
        return;
      }
      
      setAccounts(activeAccounts);
      setSelectedAccount(activeAccounts[0]);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setError('Failed to load accounts');
    }
  };

  const verifyRecipient = async () => {
    if (!recipientIdentifier.trim()) {
      setError('Please enter recipient account number or email');
      return;
    }

    // Check if trying to send to own account
    if (selectedAccount && selectedAccount.accountNumber === recipientIdentifier) {
      setError('Cannot transfer to your own account');
      return;
    }

    setVerifyingRecipient(true);
    setError('');
    setRecipientVerified(false);
    setRecipientInfo(null);

    try {
      const response = await axios.get(`/api/verify-recipient?identifier=${encodeURIComponent(recipientIdentifier)}`);
      setRecipientInfo(response.data);
      setRecipientVerified(true);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to verify recipient');
      setRecipientVerified(false);
    } finally {
      setVerifyingRecipient(false);
    }
  };

  const handlePinChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    
    if (value && index < 3) {
      pinRefs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs.current[index - 1]?.focus();
    }
  };

  const handleTransfer = async () => {
    setError('');
    setSuccess('');

    // Validations
    if (!selectedAccount) {
      setError('Please select an account');
      return;
    }

    if (!recipientInfo) {
      setError('Please verify recipient first');
      return;
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (transferAmount > selectedAccount.availableBalance) {
      setError('Insufficient funds');
      return;
    }

    const pinValue = pin.join('');
    if (pinValue.length !== 4) {
      setError('Please enter your 4-digit transaction PIN');
      return;
    }

    setLoading(true);

    try {
      const userId = getUserId();
      if (!userId) {
        setError('Please log in again');
        setLoading(false);
        return;
      }

      const response = await axios.post('/api/transfer/acredis-to-acredis', {
        senderId: userId,
        senderAccountId: selectedAccount.id,
        recipientAccountNumber: recipientInfo.accountNumber,
        amount: transferAmount,
        transactionPin: pinValue,
        description: description.trim() || undefined,
      });

      setSuccess(`Transfer successful! Reference: ${response.data.reference}`);
      
      // Reset form
      setTimeout(() => {
        router.push('/dashboard/account/statement');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayoutWrapper>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-[#c1ff72] rounded-lg flex items-center justify-center">
              <Send className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Acredis Transfer</h1>
              <p className="text-gray-600">Send money to another Acredis user</p>
            </div>
          </div>
        </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Error</h3>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Success Alert */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-900">Success!</h3>
                <p className="text-green-700 text-sm">{success}</p>
              </div>
            </div>
          )}

          {/* Step Indicator */}
          <div className="mb-8 flex items-center justify-center gap-4">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-[#c1ff72]' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${step >= 1 ? 'bg-[#c1ff72] text-black' : 'bg-gray-200'}`}>
                1
              </div>
              <span className="text-sm font-medium">Recipient</span>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-[#c1ff72]' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${step >= 2 ? 'bg-[#c1ff72] text-black' : 'bg-gray-200'}`}>
                2
              </div>
              <span className="text-sm font-medium">Amount</span>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
            <div className={`flex items-center gap-2 ${step >= 3 ? 'text-[#c1ff72]' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${step >= 3 ? 'bg-[#c1ff72] text-black' : 'bg-gray-200'}`}>
                3
              </div>
              <span className="text-sm font-medium">Confirm</span>
            </div>
          </div>

          {/* Transfer Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {/* Step 1: Recipient */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Account
                  </label>
                  <select
                    value={selectedAccount?.id || ''}
                    onChange={(e) => {
                      const account = accounts.find(acc => acc.id === e.target.value);
                      setSelectedAccount(account || null);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.accountName} - {account.accountNumber} ({account.currency} {account.availableBalance.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recipient Account Number or Email
                  </label>
                  <input
                    type="text"
                    value={recipientIdentifier}
                    onChange={(e) => {
                      setRecipientIdentifier(e.target.value);
                      setRecipientVerified(false);
                      setRecipientInfo(null);
                    }}
                    placeholder="Enter account number or email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                    disabled={verifyingRecipient}
                  />
                </div>

                {recipientVerified && recipientInfo && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <h3 className="font-semibold text-green-900">Recipient Verified</h3>
                    </div>
                    <div className="flex items-center gap-4">
                      {recipientInfo.userAvatar ? (
                        <img src={recipientInfo.userAvatar} alt={recipientInfo.userName} className="w-12 h-12 rounded-full" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="w-6 h-6 text-gray-600" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-900">{recipientInfo.accountName}</p>
                        <p className="text-sm text-gray-600">{recipientInfo.accountNumber}</p>
                        <p className="text-sm text-gray-600">{recipientInfo.userEmail}</p>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={verifyRecipient}
                  disabled={verifyingRecipient || !recipientIdentifier.trim()}
                  className="w-full py-3 bg-[#c1ff72] text-black font-semibold rounded-lg hover:bg-[#b0ef62] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {verifyingRecipient ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Continue'
                  )}
                </button>
              </div>
            )}

            {/* Step 2: Amount */}
            {step === 2 && recipientInfo && (
              <div className="space-y-6">
                {/* Recipient Summary */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Sending to:</p>
                  <p className="font-semibold text-gray-900">{recipientInfo.accountName}</p>
                  <p className="text-sm text-gray-600">{recipientInfo.accountNumber}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount ({selectedAccount?.currency})
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none text-2xl font-semibold"
                  />
                  {selectedAccount && (
                    <p className="text-sm text-gray-600 mt-2">
                      Available: {selectedAccount.currency} {selectedAccount.availableBalance.toFixed(2)}
                    </p>
                  )}
                </div>

                {/* Currency Conversion Display */}
                {selectedAccount && recipientInfo && selectedAccount.currency !== recipientInfo.currency && convertedAmount && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Currency Conversion</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-blue-800">You send:</span>
                        <span className="text-sm font-semibold text-blue-900">
                          {formatCurrency(parseFloat(amount), selectedAccount.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-blue-800">Recipient receives:</span>
                        <span className="text-sm font-semibold text-blue-900">
                          {formatCurrency(convertedAmount, recipientInfo.currency)}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-blue-200">
                        <p className="text-xs text-blue-700">
                          Exchange rate: 1 {selectedAccount.currency} ≈ {(convertedAmount / parseFloat(amount)).toFixed(4)} {recipientInfo.currency}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., Payment for services"
                    maxLength={100}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!amount || parseFloat(amount) <= 0}
                    className="flex-1 py-3 bg-[#c1ff72] text-black font-semibold rounded-lg hover:bg-[#b0ef62] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Confirm */}
            {step === 3 && recipientInfo && selectedAccount && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Transfer</h3>

                {/* Transfer Summary */}
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-gray-600">From:</span>
                    <span className="font-semibold text-gray-900">{selectedAccount.accountName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">To:</span>
                    <span className="font-semibold text-gray-900">{recipientInfo.accountName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Account:</span>
                    <span className="font-semibold text-gray-900">{recipientInfo.accountNumber}</span>
                  </div>
                  <div className="border-t border-gray-300 pt-3">
                    <div className="flex justify-between text-lg">
                      <span className="text-gray-600">You send:</span>
                      <span className="font-bold text-gray-900">{selectedAccount.currency} {parseFloat(amount).toFixed(2)}</span>
                    </div>
                    {selectedAccount.currency !== recipientInfo.currency && convertedAmount && (
                      <div className="flex justify-between text-lg mt-2">
                        <span className="text-gray-600">They receive:</span>
                        <span className="font-bold text-blue-600">{recipientInfo.currency} {convertedAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-gray-600">Fee:</span>
                      <span className="text-green-600 font-semibold">FREE</span>
                    </div>
                  </div>
                  {description && (
                    <div className="border-t border-gray-300 pt-3">
                      <span className="text-gray-600 text-sm">Description:</span>
                      <p className="text-gray-900">{description}</p>
                    </div>
                  )}
                </div>

                {/* Transaction PIN */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Enter Transaction PIN
                  </label>
                  <div className="flex gap-3 justify-center">
                    {pin.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => { pinRefs.current[index] = el; }}
                        type="password"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handlePinChange(index, e.target.value)}
                        onKeyDown={(e) => handlePinKeyDown(e, index)}
                        className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(2)}
                    disabled={loading}
                    className="flex-1 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleTransfer}
                    disabled={loading || pin.join('').length !== 4}
                    className="flex-1 py-3 bg-[#c1ff72] text-black font-semibold rounded-lg hover:bg-[#b0ef62] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Complete Transfer'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 text-sm mb-1">Security Tips</h3>
            <ul className="text-blue-800 text-sm space-y-1">
              <li>• Always verify recipient details before transferring</li>
              <li>• Never share your transaction PIN with anyone</li>
              <li>• Acredis to Acredis transfers are instant and free</li>
            </ul>
          </div>
        </div>
      </DashboardLayoutWrapper>
  );
}
