'use client';

import { useState, useEffect } from 'react';
import { DashboardLayoutWrapper } from '@/components/layout/DashboardLayoutWrapper';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface Account {
  id: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  currency: string;
  balance: number;
  availableBalance: number;
}

export default function InternationalTransferPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fee, setFee] = useState(25);
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpRequired, setOtpRequired] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    accountId: '',
    amount: '',
    currency: 'USD',
    // Beneficiary details
    beneficiaryName: '',
    beneficiaryEmail: '',
    beneficiaryPhone: '',
    beneficiaryAddress: '',
    beneficiaryCity: '',
    beneficiaryState: '',
    beneficiaryCountry: '',
    beneficiaryPostalCode: '',
    // Bank details
    bankName: '',
    bankAddress: '',
    bankCity: '',
    bankCountry: '',
    accountNumber: '',
    iban: '',
    swiftCode: '',
    routingNumber: '',
    sortCode: '',
    // Transfer details
    purpose: '',
    narration: '',
    pin: '',
    otp: '',
  });

  useEffect(() => {
    fetchAccounts();
    fetchTransferFee();
    checkOTPRequirement();
  }, []);

  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpTimer]);

  const fetchAccounts = async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) return;

      const response = await axios.get(`/api/accounts?userId=${userId}`);
      setAccounts(response.data);
      if (response.data.length > 0) {
        setFormData((prev) => ({ ...prev, accountId: response.data[0].id }));
      }
    } catch (err: any) {
      console.error('Error fetching accounts:', err);
    }
  };

  const fetchTransferFee = async () => {
    try {
      const response = await axios.get('/api/settings?key=international_transfer_fee');
      if (response.data.value) {
        setFee(Number(response.data.value));
      }
    } catch (err: any) {
      console.error('Error fetching transfer fee:', err);
    }
  };

  const checkOTPRequirement = async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) return;

      const response = await axios.get(`/api/transfer/otp/required?userId=${userId}`);
      setOtpRequired(response.data.requireOTP);
    } catch (err: any) {
      console.error('Error checking OTP requirement:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const selectedAccount = accounts.find((acc) => acc.id === formData.accountId);
  const totalAmount = parseFloat(formData.amount || '0') + fee;

  const handleNext = () => {
    if (step === 1) {
      // Validate step 1
      if (!formData.accountId || !formData.amount) {
        toast.error('Please fill in all required fields');
        return;
      }
      if (parseFloat(formData.amount) <= 0) {
        toast.error('Amount must be greater than 0');
        return;
      }
      if (selectedAccount && totalAmount > selectedAccount.availableBalance) {
        toast.error('Insufficient balance');
        return;
      }
    } else if (step === 2) {
      // Validate beneficiary details
      if (!formData.beneficiaryName || !formData.beneficiaryAddress || !formData.beneficiaryCountry) {
        toast.error('Please fill in all required beneficiary details');
        return;
      }
    } else if (step === 3) {
      // Validate bank details
      if (!formData.bankName || !formData.bankAddress || !formData.bankCountry || !formData.accountNumber || !formData.swiftCode) {
        toast.error('Please fill in all required bank details. SWIFT code is mandatory.');
        return;
      }
      if (!formData.purpose) {
        toast.error('Transfer purpose is required');
        return;
      }
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSendOTP = async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        toast.error('Please login to continue');
        return;
      }

      setLoading(true);
      await axios.post('/api/transfer/otp/generate', {
        userId,
        type: 'international_transfer',
      });

      toast.success('OTP sent to your email');
      setOtpSent(true);
      setOtpTimer(60); // 60 seconds cooldown
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.pin) {
      toast.error('Please enter your transaction PIN');
      return;
    }

    if (otpRequired && !formData.otp) {
      toast.error('Please enter the OTP sent to your email');
      return;
    }

    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        toast.error('Please login to continue');
        return;
      }

      setLoading(true);

      const response = await axios.post('/api/transfer/international', {
        userId,
        ...formData,
        amount: parseFloat(formData.amount),
      });

      toast.success(response.data.message);
      toast.success(`Reference: ${response.data.reference}`);

      // Reset form
      setFormData({
        accountId: accounts[0]?.id || '',
        amount: '',
        currency: 'USD',
        beneficiaryName: '',
        beneficiaryEmail: '',
        beneficiaryPhone: '',
        beneficiaryAddress: '',
        beneficiaryCity: '',
        beneficiaryState: '',
        beneficiaryCountry: '',
        beneficiaryPostalCode: '',
        bankName: '',
        bankAddress: '',
        bankCity: '',
        bankCountry: '',
        accountNumber: '',
        iban: '',
        swiftCode: '',
        routingNumber: '',
        sortCode: '',
        purpose: '',
        narration: '',
        pin: '',
        otp: '',
      });
      setStep(1);
      setOtpSent(false);

      // Redirect to transactions page after 2 seconds
      setTimeout(() => {
        router.push('/dashboard/transactions');
      }, 2000);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  const purposeOptions = [
    'Family Support',
    'Education',
    'Medical Expenses',
    'Business Transaction',
    'Investment',
    'Property Purchase',
    'Loan Repayment',
    'Gift',
    'Charity/Donation',
    'Travel Expenses',
    'Other',
  ];

  return (
    <DashboardLayoutWrapper>
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">International Transfer</h1>
            <p className="mt-2 text-gray-600">
              Send money to bank accounts worldwide
            </p>
          </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                    s <= step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {s}
                </div>
                {s < 4 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      s < step ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  ></div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span>Amount</span>
            <span>Beneficiary</span>
            <span>Bank Details</span>
            <span>Confirm</span>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit}>
            {/* Step 1: Amount and Account */}
            {step === 1 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900">Transfer Amount</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Account *
                  </label>
                  <select
                    name="accountId"
                    value={formData.accountId}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.accountName} - {account.accountNumber} (Available: ${account.availableBalance.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount *
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Currency *
                  </label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                    <option value="AUD">AUD - Australian Dollar</option>
                    <option value="JPY">JPY - Japanese Yen</option>
                    <option value="CHF">CHF - Swiss Franc</option>
                  </select>
                </div>

                {/* Fee Breakdown */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Transfer Amount:</span>
                    <span className="font-medium">${parseFloat(formData.amount || '0').toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Transfer Fee:</span>
                    <span className="font-medium">${fee.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-2 flex justify-between">
                    <span className="font-semibold">Total Amount:</span>
                    <span className="font-semibold text-blue-600">${totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Beneficiary Details */}
            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900">Beneficiary Details</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="beneficiaryName"
                      value={formData.beneficiaryName}
                      onChange={handleChange}
                      placeholder="John Doe"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      name="beneficiaryEmail"
                      value={formData.beneficiaryEmail}
                      onChange={handleChange}
                      placeholder="john@example.com"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="beneficiaryPhone"
                      value={formData.beneficiaryPhone}
                      onChange={handleChange}
                      placeholder="+1234567890"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address *
                    </label>
                    <input
                      type="text"
                      name="beneficiaryAddress"
                      value={formData.beneficiaryAddress}
                      onChange={handleChange}
                      placeholder="123 Main Street"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      name="beneficiaryCity"
                      value={formData.beneficiaryCity}
                      onChange={handleChange}
                      placeholder="New York"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State/Province
                    </label>
                    <input
                      type="text"
                      name="beneficiaryState"
                      value={formData.beneficiaryState}
                      onChange={handleChange}
                      placeholder="NY"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country *
                    </label>
                    <input
                      type="text"
                      name="beneficiaryCountry"
                      value={formData.beneficiaryCountry}
                      onChange={handleChange}
                      placeholder="United States"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      name="beneficiaryPostalCode"
                      value={formData.beneficiaryPostalCode}
                      onChange={handleChange}
                      placeholder="10001"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Bank Details */}
            {step === 3 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900">Bank Details</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      name="bankName"
                      value={formData.bankName}
                      onChange={handleChange}
                      placeholder="Bank of America"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bank Address *
                    </label>
                    <input
                      type="text"
                      name="bankAddress"
                      value={formData.bankAddress}
                      onChange={handleChange}
                      placeholder="100 North Tryon Street"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bank City
                    </label>
                    <input
                      type="text"
                      name="bankCity"
                      value={formData.bankCity}
                      onChange={handleChange}
                      placeholder="Charlotte"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bank Country *
                    </label>
                    <input
                      type="text"
                      name="bankCountry"
                      value={formData.bankCountry}
                      onChange={handleChange}
                      placeholder="United States"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Account Number *
                    </label>
                    <input
                      type="text"
                      name="accountNumber"
                      value={formData.accountNumber}
                      onChange={handleChange}
                      placeholder="123456789"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      IBAN (if applicable)
                    </label>
                    <input
                      type="text"
                      name="iban"
                      value={formData.iban}
                      onChange={handleChange}
                      placeholder="GB82 WEST 1234 5698 7654 32"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SWIFT/BIC Code *
                    </label>
                    <input
                      type="text"
                      name="swiftCode"
                      value={formData.swiftCode}
                      onChange={handleChange}
                      placeholder="BOFAUS3N"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Routing Number (US)
                    </label>
                    <input
                      type="text"
                      name="routingNumber"
                      value={formData.routingNumber}
                      onChange={handleChange}
                      placeholder="123456789"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sort Code (UK)
                    </label>
                    <input
                      type="text"
                      name="sortCode"
                      value={formData.sortCode}
                      onChange={handleChange}
                      placeholder="12-34-56"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Purpose of Transfer *
                    </label>
                    <select
                      name="purpose"
                      value={formData.purpose}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select purpose</option>
                      {purposeOptions.map((purpose) => (
                        <option key={purpose} value={purpose}>
                          {purpose}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Additional Notes (Optional)
                    </label>
                    <textarea
                      name="narration"
                      value={formData.narration}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Any additional information..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Confirmation & PIN */}
            {step === 4 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900">Confirm Transfer</h2>

                {/* Summary */}
                <div className="bg-gray-50 p-6 rounded-lg space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Transfer Details</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Amount:</span>
                        <span className="font-medium">{formData.currency} {parseFloat(formData.amount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Fee:</span>
                        <span className="font-medium">${fee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold">Total:</span>
                        <span className="font-semibold text-blue-600">${totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Beneficiary</h3>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-gray-600">Name:</span> {formData.beneficiaryName}</p>
                      <p><span className="text-gray-600">Country:</span> {formData.beneficiaryCountry}</p>
                      {formData.beneficiaryEmail && <p><span className="text-gray-600">Email:</span> {formData.beneficiaryEmail}</p>}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Bank Details</h3>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-gray-600">Bank:</span> {formData.bankName}</p>
                      <p><span className="text-gray-600">Account Number:</span> {formData.accountNumber}</p>
                      <p><span className="text-gray-600">SWIFT Code:</span> {formData.swiftCode}</p>
                      {formData.iban && <p><span className="text-gray-600">IBAN:</span> {formData.iban}</p>}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Purpose</h3>
                    <p className="text-sm">{formData.purpose}</p>
                  </div>
                </div>

                {/* OTP Section - Only show if required */}
                {otpRequired && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">
                        Email OTP *
                      </label>
                      <button
                        type="button"
                        onClick={handleSendOTP}
                        disabled={loading || otpTimer > 0}
                        className={`px-4 py-2 text-sm font-medium rounded-lg ${
                          loading || otpTimer > 0
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {otpTimer > 0 ? `Resend in ${otpTimer}s` : otpSent ? 'Resend OTP' : 'Send OTP'}
                      </button>
                    </div>
                    <input
                      type="text"
                      name="otp"
                      value={formData.otp}
                      onChange={handleChange}
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required={otpRequired}
                    />
                    <p className="text-xs text-gray-500">
                      An OTP has been sent to your registered email address
                    </p>
                  </div>
                )}

                {/* PIN */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transaction PIN *
                  </label>
                  <input
                    type="password"
                    name="pin"
                    value={formData.pin}
                    onChange={handleChange}
                    placeholder="Enter your 4-digit PIN"
                    maxLength={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Warning */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex">
                    <div className="shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        <strong>Important:</strong> This transfer will be sent for admin approval. Funds will be locked until the transfer is processed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                  className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  Back
                </button>
              )}
              {step < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="ml-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="ml-auto px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing...' : 'Complete Transfer'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
    </DashboardLayoutWrapper>
  );
}
