'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { InvestmentTopBar } from '@/components/layout/InvestmentTopBar';
import { investmentSidebarItems } from '@/config/investment-sidebar.config';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface TradeKey {
  id: string;
  key: string;
  isActive: boolean;
  maxUses: number | null;
  currentUses: number;
  expiresAt: string | null;
  createdAt: string;
  investmentAccess: Array<{
    id: string;
    user: {
      name: string;
      email: string;
    };
    accessedAt: string;
  }>;
}

export default function TradeKeyPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tradeKeys, setTradeKeys] = useState<TradeKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<TradeKey | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [referralBonus, setReferralBonus] = useState(0);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      toast.error('Please log in to continue');
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    fetchTradeKeys(parsedUser.id);
    fetchUserData(parsedUser.id);
  }, [router]);

  const fetchTradeKeys = async (userId: string) => {
    try {
      const response = await axios.get(`/api/admin/trade-keys?userId=${userId}`);
      setTradeKeys(response.data.tradeKeys);
    } catch (error) {
      console.error('Error fetching trade keys:', error);
      toast.error('Failed to load trade keys');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserData = async (userId: string) => {
    try {
      const response = await axios.get(`/api/user/${userId}`);
      setReferralBonus(response.data.user.referralBonus || 0);
      // Update localStorage with latest user data
      const updatedUser = { ...user, ...response.data.user };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('Referral key copied to clipboard!');
  };

  const handleShowDetails = (tradeKey: TradeKey) => {
    setSelectedKey(tradeKey);
    setShowDetailsModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailsModal(false);
    setSelectedKey(null);
  };

  const handleWithdrawBonus = async () => {
    if (!user?.id) return;
    
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amount > referralBonus) {
      toast.error('Insufficient referral bonus balance');
      return;
    }

    setIsWithdrawing(true);
    try {
      const response = await axios.post('/api/referral/withdraw', {
        userId: user.id,
        amount: amount
      });

      toast.success('Referral bonus withdrawn successfully!');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      await fetchUserData(user.id);
    } catch (error: any) {
      console.error('Error withdrawing bonus:', error);
      toast.error(error.response?.data?.error || 'Failed to withdraw bonus');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleCreateReferralKey = async () => {
    if (!user?.id) return;
    
    // Check if user already has a key
    if (tradeKeys.length > 0) {
      toast.error('You already have a referral key');
      return;
    }

    setIsCreating(true);
    try {
      const response = await axios.post('/api/admin/trade-keys', {
        userId: user.id,
        createdBy: user.id,
        maxUses: null, // No limit
        expiresAt: null, // Never expires
      });

      toast.success('Referral key created successfully!');
      await fetchTradeKeys(user.id);
    } catch (error: any) {
      console.error('Error creating referral key:', error);
      toast.error(error.response?.data?.error || 'Failed to create referral key');
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusBadge = (tradeKey: TradeKey) => {
    if (!tradeKey.isActive) {
      return <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded-full">Inactive</span>;
    }
    
    if (tradeKey.expiresAt && new Date(tradeKey.expiresAt) < new Date()) {
      return <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">Expired</span>;
    }
    
    if (tradeKey.maxUses && tradeKey.currentUses >= tradeKey.maxUses) {
      return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">Max Uses Reached</span>;
    }
    
    return <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">Active</span>;
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
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
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">My Referral Key</h1>
            <p className="text-gray-600 mt-1">Share your referral key to grant investment access and track your referrals</p>
          </div>

          {/* Referral Program Banner */}
          <div className="bg-linear-to-br from-[#c1ff72] via-green-400 to-[#c1ff72] rounded-xl p-8 mb-6 text-center shadow-lg">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-3">
                $24,000,000+
              </h2>
              <p className="text-xl md:text-2xl font-bold text-gray-800">
                earned by our members in referral bonuses
              </p>
            </div>
          </div>

          {/* Referral Bonus Card */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-6 mb-6 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-green-500 rounded-full p-3">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Available Referral Bonus</p>
                  <p className="text-3xl font-bold text-green-600">
                    ${referralBonus.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Earned from your referrals</p>
                </div>
              </div>
              <button
                onClick={() => setShowWithdrawModal(true)}
                disabled={referralBonus <= 0}
                className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Withdraw to Balance
              </button>
            </div>
          </div>

          {/* Trade Keys List */}
          {tradeKeys.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <p className="text-gray-600 mb-4 text-lg font-semibold">You don't have a referral key yet</p>
              <p className="text-sm text-gray-500 mb-6">Create your referral key to start inviting others to the investment platform</p>
              <button
                onClick={handleCreateReferralKey}
                disabled={isCreating}
                className="px-6 py-3 bg-[#c1ff72] text-black font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {isCreating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Referral Key
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {tradeKeys.map((tradeKey) => (
                <div key={tradeKey.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        <h3 className="font-semibold text-gray-900">Referral Key</h3>
                      </div>
                      {getStatusBadge(tradeKey)}
                    </div>
                  </div>

                  {/* Key Display */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                      <code className="flex-1 text-sm font-mono text-gray-900 break-all">
                        {tradeKey.key}
                      </code>
                      <button
                        onClick={() => handleCopyKey(tradeKey.key)}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                        title="Copy referral key"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Uses</p>
                      <p className="text-lg font-bold text-gray-900">
                        {tradeKey.currentUses}
                        {tradeKey.maxUses && <span className="text-sm text-gray-500">/{tradeKey.maxUses}</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Referrals</p>
                      <p className="text-lg font-bold text-gray-900">{tradeKey.investmentAccess.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Created</p>
                      <p className="text-xs text-gray-900">
                        {new Date(tradeKey.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Expiration Info */}
                  {tradeKey.expiresAt && (
                    <div className="mb-4 text-sm">
                      <span className="text-gray-600">Expires: </span>
                      <span className={`font-semibold ${
                        new Date(tradeKey.expiresAt) < new Date()
                          ? 'text-red-600'
                          : 'text-gray-900'
                      }`}>
                        {new Date(tradeKey.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    onClick={() => handleShowDetails(tradeKey)}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-900 font-semibold rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View Details
                  </button>
                </div>
              ))}
            </div>
          )}


          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
            <div className="flex gap-4">
              <svg className="w-6 h-6 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2">What is a Referral Key?</h3>
                <p className="text-sm text-blue-800 mb-2">
                  Your referral key allows you to grant investment access to other users. When someone uses your referral key, 
                  they gain access to the investment platform, and you can track all your referrals.
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
                  <li>Share your key with friends and family</li>
                  <li>Track who used your key and when</li>
                  <li>Your key has unlimited uses and never expires</li>
                  <li>Earn bonus when someone uses your referral key</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Details Modal */}
      {showDetailsModal && selectedKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Referral Key Details</h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Key Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-2">Referral Key</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-white px-3 py-2 rounded border border-gray-200">
                    {selectedKey.key}
                  </code>
                  <button
                    onClick={() => handleCopyKey(selectedKey.key)}
                    className="px-3 py-2 bg-[#c1ff72] text-black rounded hover:opacity-90"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-xs text-blue-800 mb-1">Total Uses</p>
                  <p className="text-2xl font-bold text-blue-900">{selectedKey.currentUses}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-xs text-green-800 mb-1">Referrals</p>
                  <p className="text-2xl font-bold text-green-900">{selectedKey.investmentAccess.length}</p>
                </div>
              </div>

              {/* Referrals List */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Users Who Used This Key</h3>
                {selectedKey.investmentAccess.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-sm">No one has used this key yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedKey.investmentAccess.map((access) => (
                      <div key={access.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {access.user.name || access.user.email}
                          </p>
                          <p className="text-xs text-gray-500">{access.user.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-600">
                            {new Date(access.accessedAt).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(access.accessedAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={handleCloseModal}
                className="w-full px-6 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Bonus Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Withdraw Referral Bonus</h2>
              <button
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawAmount('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Bonus Info */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-1">Available Balance</p>
              <p className="text-3xl font-bold text-green-600">${referralBonus.toFixed(2)}</p>
            </div>

            {/* Amount Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Withdrawal Amount
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg font-semibold">$</span>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={referralBonus}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-lg"
                />
              </div>
              <button
                onClick={() => setWithdrawAmount(referralBonus.toString())}
                className="mt-2 text-sm text-green-600 hover:text-green-700 font-medium"
              >
                Withdraw All
              </button>
            </div>

            {/* Info Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Withdrawal Information</p>
                  <p>The amount will be added to your main account balance instantly.</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawAmount('');
                }}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdrawBonus}
                disabled={isWithdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                className="flex-1 px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {isWithdrawing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  'Confirm Withdrawal'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
