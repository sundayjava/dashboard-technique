'use client';

import { useState, useEffect, useRef } from 'react';
import { DashboardLayoutWrapper } from '@/components/layout/DashboardLayoutWrapper';
import axios from 'axios';
import { 
  ArrowRight, 
  Building2, 
  User, 
  Hash, 
  FileText, 
  Lock, 
  Check,
  ChevronDown,
  Search,
  X
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Account {
  id: string;
  accountNumber: string;
  accountName: string;
  currency: string;
  balance: number;
  availableBalance: number;
  status: string;
}

interface Bank {
  code: string;
  name: string;
}

export default function DomesticTransferPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [filteredBanks, setFilteredBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fee, setFee] = useState(3); // Will be loaded from settings

  // Form fields
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [amount, setAmount] = useState('');
  const [beneficiaryAccountName, setBeneficiaryAccountName] = useState('');
  const [beneficiaryAccountNumber, setBeneficiaryAccountNumber] = useState('');
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [narration, setNarration] = useState('');
  const [saveBeneficiary, setSaveBeneficiary] = useState(false);
  const [pin, setPin] = useState(['', '', '', '']);
  
  // Bank dropdown states
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    fetchAccounts();
    fetchBanks();
    fetchTransferFee();
  }, []);

  useEffect(() => {
    // Filter banks based on search query
    if (bankSearchQuery.trim()) {
      const filtered = banks.filter(bank =>
        bank.name.toLowerCase().includes(bankSearchQuery.toLowerCase())
      );
      setFilteredBanks(filtered);
    } else {
      setFilteredBanks(banks);
    }
  }, [bankSearchQuery, banks]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowBankDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const fetchAccounts = async () => {
    const userId = getUserId();
    if (!userId) return;

    try {
      const response = await axios.get(`/api/accounts?userId=${userId}`);
      const activeAccounts = (response.data.accounts || []).filter(
        (acc: Account) => acc.status === 'ACTIVE'
      );
      setAccounts(activeAccounts);
      if (activeAccounts.length > 0) {
        setSelectedAccount(activeAccounts[0]);
      }
    } catch (err: any) {
      console.error('Error fetching accounts:', err);
      setError(err.response?.data?.error || 'Failed to fetch accounts');
    }
  };

  const fetchBanks = async () => {
    try {
      const response = await axios.get('/api/transfer/domestic');
      setBanks(response.data.banks || []);
      setFilteredBanks(response.data.banks || []);
    } catch (err: any) {
      console.error('Error fetching banks:', err);
    }
  };

  const fetchTransferFee = async () => {
    try {
      const response = await axios.get('/api/settings?key=domestic_transfer_fee');
      if (response.data.value) {
        setFee(Number(response.data.value));
      }
    } catch (err: any) {
      console.error('Error fetching transfer fee:', err);
      // Keep default fee of 3 if fetch fails
    }
  };

  const handlePinChange = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newPin = [...pin];
      newPin[index] = value;
      setPin(newPin);

      // Auto-focus next input
      if (value && index < 3) {
        pinRefs[index + 1].current?.focus();
      }
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs[index - 1].current?.focus();
    }
  };

  const handleBankSelect = (bank: Bank) => {
    setSelectedBank(bank);
    setBankSearchQuery('');
    setShowBankDropdown(false);
  };

  const handleNext = () => {
    setError('');

    if (step === 1) {
      if (!selectedAccount) {
        setError('Please select an account');
        return;
      }
      if (!amount || parseFloat(amount) <= 0) {
        setError('Please enter a valid amount');
        return;
      }
      if (!beneficiaryAccountName.trim()) {
        setError('Please enter beneficiary account name');
        return;
      }
      if (!beneficiaryAccountNumber.trim() || beneficiaryAccountNumber.length < 10) {
        setError('Please enter a valid account number (10 digits)');
        return;
      }
      if (!selectedBank) {
        setError('Please select a beneficiary bank');
        return;
      }
      
      const transferAmount = parseFloat(amount);
      const total = transferAmount + fee;
      
      if (selectedAccount.availableBalance < total) {
        setError(`Insufficient balance. You need ${total} ${selectedAccount.currency} (Amount: ${transferAmount} + Fee: ${fee})`);
        return;
      }

      setStep(2);
    }
  };

  const handleSubmit = async () => {
    const pinValue = pin.join('');
    
    if (pinValue.length !== 4) {
      setError('Please enter your 4-digit transaction PIN');
      return;
    }

    if (!selectedAccount || !selectedBank) return;

    setLoading(true);
    setError('');

    try {
      const userId = getUserId();
      const response = await axios.post('/api/transfer/domestic', {
        userId,
        accountId: selectedAccount.id,
        amount: parseFloat(amount),
        beneficiaryAccountName: beneficiaryAccountName.trim(),
        beneficiaryAccountNumber: beneficiaryAccountNumber.trim(),
        beneficiaryBank: selectedBank.name,
        narration: narration.trim(),
        transactionPin: pinValue,
        saveBeneficiary,
      });

      setSuccess(`Transfer initiated successfully! Reference: ${response.data.reference}`);
      
      // Reset form after 3 seconds and redirect
      setTimeout(() => {
        router.push('/dashboard/transfer/history');
      }, 3000);
    } catch (err: any) {
      console.error('Error processing transfer:', err);
      setError(err.response?.data?.error || 'Failed to process transfer');
      setPin(['', '', '', '']);
      pinRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  if (success) {
    return (
      <DashboardLayoutWrapper>
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Transfer Initiated!</h2>
            <p className="text-gray-600 mb-6">{success}</p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Your transfer is pending approval by our team. You will be notified once it's processed.
              </p>
            </div>
            <p className="text-sm text-gray-500">Redirecting to transfer history...</p>
          </div>
        </div>
      </DashboardLayoutWrapper>
    );
  }

  return (
    <DashboardLayoutWrapper>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Domestic Transfer</h1>
          <p className="text-gray-600">Transfer to any bank account in Nigeria</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step >= 1 ? 'bg-[#c1ff72] text-gray-900' : 'bg-gray-200 text-gray-600'
              } font-semibold`}>
                1
              </div>
              <div className={`w-24 h-1 ${step >= 2 ? 'bg-[#c1ff72]' : 'bg-gray-200'}`}></div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step >= 2 ? 'bg-[#c1ff72] text-gray-900' : 'bg-gray-200 text-gray-600'
              } font-semibold`}>
                2
              </div>
            </div>
          </div>
          <div className="flex justify-center mt-2">
            <div className="flex items-center gap-16">
              <span className={`text-sm ${step >= 1 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                Transfer Details
              </span>
              <span className={`text-sm ${step >= 2 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                Confirm & Pay
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Step 1: Transfer Details */}
        {step === 1 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 md:p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Enter Transfer Details</h2>
            
            <div className="space-y-6">
              {/* From Account */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From Account
                </label>
                <select
                  value={selectedAccount?.id || ''}
                  onChange={(e) => {
                    const account = accounts.find(a => a.id === e.target.value);
                    setSelectedAccount(account || null);
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountName} - {account.accountNumber} ({formatCurrency(account.availableBalance, account.currency)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                    {selectedAccount?.currency || 'NGN'}
                  </span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-16 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                  />
                </div>
                {selectedAccount && amount && parseFloat(amount) > 0 && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Transfer Amount:</span>
                      <span className="font-medium">{formatCurrency(parseFloat(amount), selectedAccount.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">Transfer Fee:</span>
                      <span className="font-medium">{formatCurrency(fee, selectedAccount.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-2 pt-2 border-t border-blue-300">
                      <span className="text-gray-900 font-semibold">Total:</span>
                      <span className="font-bold">{formatCurrency(parseFloat(amount) + fee, selectedAccount.currency)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Beneficiary Account Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  Beneficiary Account Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={beneficiaryAccountName}
                  onChange={(e) => setBeneficiaryAccountName(e.target.value)}
                  placeholder="Enter beneficiary's account name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                />
              </div>

              {/* Beneficiary Account Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Hash className="w-4 h-4 inline mr-1" />
                  Beneficiary Account Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={beneficiaryAccountNumber}
                  onChange={(e) => setBeneficiaryAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="0123456789"
                  maxLength={10}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none font-mono"
                />
              </div>

              {/* Beneficiary Bank - Searchable Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  Beneficiary Bank <span className="text-red-500">*</span>
                </label>
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowBankDropdown(!showBankDropdown)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none text-left flex items-center justify-between bg-white"
                  >
                    <span className={selectedBank ? 'text-gray-900' : 'text-gray-500'}>
                      {selectedBank ? selectedBank.name : 'Select beneficiary bank'}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showBankDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showBankDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                      {/* Search Input */}
                      <div className="p-3 border-b border-gray-200 sticky top-0 bg-white">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="text"
                            value={bankSearchQuery}
                            onChange={(e) => setBankSearchQuery(e.target.value)}
                            placeholder="Search for a bank..."
                            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none text-sm"
                            autoFocus
                          />
                          {bankSearchQuery && (
                            <button
                              onClick={() => setBankSearchQuery('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Banks List */}
                      <div className="max-h-64 overflow-y-auto">
                        {filteredBanks.length > 0 ? (
                          filteredBanks.map((bank) => (
                            <button
                              key={bank.code}
                              type="button"
                              onClick={() => handleBankSelect(bank)}
                              className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium text-gray-900">{bank.name}</div>
                              <div className="text-xs text-gray-500 mt-1">Code: {bank.code}</div>
                            </button>
                          ))
                        ) : (
                          <div className="p-4 text-center text-gray-500 text-sm">
                            No banks found
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Narration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Narration (Optional)
                </label>
                <textarea
                  value={narration}
                  onChange={(e) => setNarration(e.target.value.slice(0, 200))}
                  placeholder="Enter transfer description or reference"
                  rows={3}
                  maxLength={200}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none resize-none"
                />
                <div className="text-xs text-gray-500 mt-1 text-right">
                  {narration.length}/200 characters
                </div>
              </div>

              {/* Save Beneficiary */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="saveBeneficiary"
                  checked={saveBeneficiary}
                  onChange={(e) => setSaveBeneficiary(e.target.checked)}
                  className="w-5 h-5 text-[#c1ff72] border-gray-300 rounded focus:ring-[#c1ff72] cursor-pointer"
                />
                <label htmlFor="saveBeneficiary" className="text-sm text-gray-700 cursor-pointer">
                  Save this beneficiary for future transfers
                </label>
              </div>
            </div>

            {/* Continue Button */}
            <button
              onClick={handleNext}
              className="w-full mt-8 px-6 py-3 bg-[#c1ff72] text-gray-900 font-bold rounded-lg hover:bg-[#b0ef62] transition-colors flex items-center justify-center gap-2"
            >
              Continue
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Step 2: Confirm and PIN */}
        {step === 2 && selectedAccount && selectedBank && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 md:p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Confirm Transfer</h2>

            {/* Transfer Summary */}
            <div className="mb-8 p-6 bg-gray-50 rounded-lg space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                <span className="text-gray-600">From:</span>
                <div className="text-right">
                  <div className="font-medium text-gray-900">{selectedAccount.accountName}</div>
                  <div className="text-sm text-gray-500">{selectedAccount.accountNumber}</div>
                </div>
              </div>

              <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                <span className="text-gray-600">To:</span>
                <div className="text-right">
                  <div className="font-medium text-gray-900">{beneficiaryAccountName}</div>
                  <div className="text-sm text-gray-500">{beneficiaryAccountNumber}</div>
                  <div className="text-sm text-gray-500">{selectedBank.name}</div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Amount:</span>
                <span className="font-semibold text-gray-900">{formatCurrency(parseFloat(amount), selectedAccount.currency)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Fee:</span>
                <span className="font-medium text-gray-900">{formatCurrency(fee, selectedAccount.currency)}</span>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-gray-300">
                <span className="text-gray-900 font-semibold text-lg">Total:</span>
                <span className="font-bold text-gray-900 text-lg">{formatCurrency(parseFloat(amount) + fee, selectedAccount.currency)}</span>
              </div>

              {narration && (
                <div className="pt-4 border-t border-gray-200">
                  <span className="text-gray-600 text-sm">Narration:</span>
                  <p className="text-gray-900 text-sm mt-1">{narration}</p>
                </div>
              )}
            </div>

            {/* Transaction PIN */}
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                <Lock className="w-4 h-4" />
                Enter Transaction PIN
              </label>
              <div className="flex gap-3 justify-center mb-2">
                {pin.map((digit, index) => (
                  <input
                    key={index}
                    ref={pinRefs[index]}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(index, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(index, e)}
                    className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                  />
                ))}
              </div>
            </div>

            {/* Warning */}
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> This transfer will be pending approval by our team. You will receive a notification once it's processed.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setStep(1);
                  setPin(['', '', '', '']);
                  setError('');
                }}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || pin.join('').length !== 4}
                className="flex-1 px-6 py-3 bg-[#c1ff72] text-gray-900 font-bold rounded-lg hover:bg-[#b0ef62] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  'Confirm Transfer'
                )}
              </button>
            </div>

            {/* Security Note */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Your funds will be held until the transfer is approved</li>
                <li>• Never share your transaction PIN with anyone</li>
                <li>• Contact support if you notice any suspicious activity</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </DashboardLayoutWrapper>
  );
}
