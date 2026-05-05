'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { InvestmentTopBar } from '@/components/layout/InvestmentTopBar';
import { investmentSidebarItems } from '@/config/investment-sidebar.config';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface InvestmentPlan {
  id: string;
  planName: string;
  minAmount: number;
  maxAmount: number;
  arkIIAllocation: number;
  duration: number;
  profitPercentage: number;
  cryptoAddress: string | null;
  cryptoSymbol: string | null;
  cryptoIcon: string | null;
}

export default function InvestNowPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params.planId as string;

  const [user, setUser] = useState<any>(null);
  const [plan, setPlan] = useState<InvestmentPlan | null>(null);
  const [userBalance, setUserBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'BANK_WALLET' | 'CRYPTO'>('BANK_WALLET');
  const [transactionPin, setTransactionPin] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCryptoInstructions, setShowCryptoInstructions] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      toast.error('Please log in to continue');
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    fetchPlanAndBalance(parsedUser.id);
  }, [planId, router]);

  const fetchPlanAndBalance = async (userId: string) => {
    try {
      const [plansRes, statsRes] = await Promise.all([
        axios.get(`/api/investments/available-plans?userId=${userId}&activeOnly=true`),
        axios.get(`/api/investments/stats?userId=${userId}`)
      ]);

      const selectedPlan = plansRes.data.plans.find((p: any) => p.id === planId);
      if (!selectedPlan) {
        toast.error('Investment plan not found or not available');
        router.push('/investment/plans');
        return;
      }

      setPlan(selectedPlan);

      // Use investment balance instead of main account balance
      if (statsRes.data) {
        setUserBalance(statsRes.data.investmentBalance || 0);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load investment plan');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateExpectedReturns = () => {
    const investmentAmount = parseFloat(amount) || 0;
    if (!plan) return 0;
    return investmentAmount * (plan.profitPercentage / 100);
  };

  const calculateTotalReturn = () => {
    const investmentAmount = parseFloat(amount) || 0;
    return investmentAmount + calculateExpectedReturns();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!plan) return;

    const investmentAmount = parseFloat(amount);

    if (investmentAmount < plan.minAmount || investmentAmount > plan.maxAmount) {
      toast.error(`Amount must be between $${plan.minAmount} and $${plan.maxAmount}`);
      return;
    }

    if (paymentMethod === 'BANK_WALLET') {
      if (!transactionPin) {
        toast.error('Please enter your transaction PIN');
        return;
      }

      if (investmentAmount > userBalance) {
        toast.error('Insufficient balance. Please use crypto payment or top up your account.');
        return;
      }
    }

    if (paymentMethod === 'CRYPTO' && !plan.cryptoAddress) {
      toast.error('Crypto payment is not available for this plan');
      return;
    }

    setIsProcessing(true);

    try {
      const response = await axios.post('/api/investments', {
        userId: user.id,
        planId: plan.id,
        amount: investmentAmount,
        paymentMethod,
        transactionPin: paymentMethod === 'BANK_WALLET' ? transactionPin : undefined
      });

      if (paymentMethod === 'BANK_WALLET') {
        toast.success('Investment created successfully!');
        router.push('/investment/my-investments');
      } else {
        // Show crypto payment instructions
        setShowCryptoInstructions(true);
        toast.success('Investment created. Please complete payment.');
      }
    } catch (error: any) {
      console.error('Error creating investment:', error);
      toast.error(error.response?.data?.error || 'Failed to create investment');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading || !user || !plan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (showCryptoInstructions && plan.cryptoAddress) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardSidebar 
          items={investmentSidebarItems}
          userId={user.id}
          user={user}
          onCollapseChange={setSidebarCollapsed}
          isMobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
        
        <InvestmentTopBar 
          user={user}
          sidebarCollapsed={sidebarCollapsed}
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        <main className={`pt-20 pb-8 px-4 md:px-6 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'
        }`}>
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">Complete Crypto Payment</h2>
              <p className="text-gray-600 mb-6">Send exactly <span className="font-bold text-gray-900">${amount}</span> to the address below</p>

              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <p className="text-xs text-gray-600 mb-2">Crypto Address</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white px-4 py-3 rounded border border-gray-200 text-sm font-mono break-all">
                    {plan.cryptoAddress}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(plan.cryptoAddress!);
                      toast.success('Address copied!');
                    }}
                    className="px-4 py-3 bg-[#c1ff72] text-black rounded hover:opacity-90 transition-opacity"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Important Instructions:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-800">
                      <li>Send the exact amount shown above</li>
                      <li>Your investment will be activated after payment confirmation</li>
                      <li>This may take a few minutes to process</li>
                      <li>Keep the transaction reference for your records</li>
                    </ul>
                  </div>
                </div>
              </div>

              <button
                onClick={() => router.push('/investment/my-investments')}
                className="px-6 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
              >
                View My Investments
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardSidebar 
        items={investmentSidebarItems}
        userId={user.id}
        user={user}
        onCollapseChange={setSidebarCollapsed}
        isMobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      
      <InvestmentTopBar 
        user={user}
        sidebarCollapsed={sidebarCollapsed}
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      <main className={`pt-20 pb-8 px-4 md:px-6 transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'
      }`}>
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.back()}
            className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Plans
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Investment Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-6">
                  {plan.cryptoIcon && (
                    <img 
                      src={plan.cryptoIcon} 
                      alt={plan.cryptoSymbol || 'Crypto'}
                      className="w-8 h-8 rounded-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <h2 className="text-2xl font-bold text-gray-900">Invest in {plan.planName}</h2>
                  {plan.cryptoSymbol && (
                    <span className="text-sm font-semibold px-2 py-1 bg-gray-100 text-gray-700 rounded">
                      {plan.cryptoSymbol}
                    </span>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Amount Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Investment Amount ($)
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      min={plan.minAmount}
                      max={plan.maxAmount}
                      step="0.01"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent text-lg font-semibold"
                      placeholder={`Min: $${plan.minAmount} - Max: $${plan.maxAmount}`}
                      required
                    />
                    <p className="mt-2 text-sm text-gray-600">
                      Range: ${plan.minAmount.toLocaleString()} - ${plan.maxAmount.toLocaleString()}
                    </p>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Payment Method
                    </label>
                    <div className="space-y-3">
                      {/* Bank Wallet */}
                      <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        paymentMethod === 'BANK_WALLET'
                          ? 'border-[#c1ff72] bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="BANK_WALLET"
                          checked={paymentMethod === 'BANK_WALLET'}
                          onChange={(e) => setPaymentMethod(e.target.value as 'BANK_WALLET')}
                          className="w-5 h-5 text-[#c1ff72]"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-900">Bank Wallet</span>
                            <span className="text-sm text-gray-600">Balance: ${userBalance.toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">Instant activation</p>
                        </div>
                      </label>

                      {/* Crypto Payment */}
                      {plan.cryptoAddress && (
                        <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          paymentMethod === 'CRYPTO'
                            ? 'border-[#c1ff72] bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}>
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="CRYPTO"
                            checked={paymentMethod === 'CRYPTO'}
                            onChange={(e) => setPaymentMethod(e.target.value as 'CRYPTO')}
                            className="w-5 h-5 text-[#c1ff72]"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-gray-900">Crypto Payment</span>
                              <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">Manual</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">Activation after payment confirmation</p>
                          </div>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Transaction PIN (for Bank Wallet only) */}
                  {paymentMethod === 'BANK_WALLET' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Transaction PIN
                      </label>
                      <input
                        type="password"
                        value={transactionPin}
                        onChange={(e) => setTransactionPin(e.target.value)}
                        maxLength={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                        placeholder="Enter your 4-digit PIN"
                        required={paymentMethod === 'BANK_WALLET'}
                      />
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full px-6 py-4 bg-linear-to-r from-[#c1ff72] to-[#8fd04f] text-black font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Confirm Investment
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Summary Sidebar */}
            <div className="space-y-6">
              {/* Plan Details */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-gray-900 mb-4">Plan Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Duration</span>
                    <span className="font-semibold">{plan.duration} days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Profit Rate</span>
                    <span className="font-semibold text-green-600">{plan.profitPercentage}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">ARK_II Allocation</span>
                    <span className="font-semibold">{plan.arkIIAllocation.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Investment Summary */}
              {amount && parseFloat(amount) > 0 && (
                <div className="bg-linear-to-r from-[#c1ff72] to-[#8fd04f] rounded-xl p-6 text-black">
                  <h3 className="font-bold mb-4">Investment Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Investment Amount</span>
                      <span className="font-semibold">${parseFloat(amount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expected Returns</span>
                      <span className="font-semibold">${calculateExpectedReturns().toLocaleString()}</span>
                    </div>
                    <div className="border-t border-black/20 pt-2 mt-2">
                      <div className="flex justify-between text-base">
                        <span className="font-bold">Total Return</span>
                        <span className="font-bold">${calculateTotalReturn().toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
