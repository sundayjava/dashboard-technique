'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { InvestmentTopBar } from '@/components/layout/InvestmentTopBar';
import { investmentSidebarItems } from '@/config/investment-sidebar.config';
import { SupportModal } from '@/components/modals';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface Investment {
  id: string;
  amount: number;
  paymentMethod: 'BANK_WALLET' | 'CRYPTO';
  transactionRef: string | null;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  startDate: string | null;
  endDate: string | null;
  profitEarned: number;
  completedAt: string | null;
  createdAt: string;
  plan: {
    id: string;
    planName: string;
    duration: number;
    profitPercentage: number;
    arkIIAllocation: number;
    cryptoAddress: string | null;
    cryptoSymbol: string | null;
    cryptoIcon: string | null;
  };
}

export default function MyInvestmentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [filteredInvestments, setFilteredInvestments] = useState<Investment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      toast.error('Please log in to continue');
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    fetchInvestments(parsedUser.id);
  }, [router]);

  useEffect(() => {
    if (activeFilter === 'ALL') {
      setFilteredInvestments(investments);
    } else {
      setFilteredInvestments(investments.filter(inv => inv.status === activeFilter));
    }
  }, [activeFilter, investments]);

  const fetchInvestments = async (userId: string) => {
    try {
      const response = await axios.get(`/api/investments?userId=${userId}`);
      setInvestments(response.data.investments);
      setFilteredInvestments(response.data.investments);
    } catch (error) {
      console.error('Error fetching investments:', error);
      toast.error('Failed to load investments');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    if (method === 'BANK_WALLET') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  };

  const calculateDaysRemaining = (endDate: string) => {
    const today = new Date();
    const end = new Date(endDate);
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const calculateProgress = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const progress = (elapsedDays / totalDays) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  const calculateExpectedReturn = (investment: Investment) => {
    return investment.amount * (investment.plan.profitPercentage / 100);
  };

  const calculateTotalReturn = (investment: Investment) => {
    if (investment.status === 'COMPLETED') {
      return investment.amount + investment.profitEarned;
    }
    return investment.amount + calculateExpectedReturn(investment);
  };

  const stats = {
    total: investments.reduce((sum, inv) => sum + inv.amount, 0),
    active: investments.filter(inv => inv.status === 'ACTIVE').length,
    pending: investments.filter(inv => inv.status === 'PENDING').length,
    completed: investments.filter(inv => inv.status === 'COMPLETED').length,
    totalProfit: investments.reduce((sum, inv) => sum + inv.profitEarned, 0)
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
          <h1 className="text-2xl font-bold text-gray-900 mb-4">My Investments</h1>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <p className="text-xs text-gray-600 mb-1">Total Invested</p>
              <p className="text-xl font-bold text-gray-900">${stats.total.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <p className="text-xs text-gray-600 mb-1">Active</p>
              <p className="text-xl font-bold text-green-600">{stats.active}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <p className="text-xs text-gray-600 mb-1">Pending</p>
              <p className="text-xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <p className="text-xs text-gray-600 mb-1">Completed</p>
              <p className="text-xl font-bold text-blue-600">{stats.completed}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <p className="text-xs text-gray-600 mb-1">Total Profit</p>
              <p className="text-xl font-bold text-green-600">${stats.totalProfit.toLocaleString()}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            {['ALL', 'PENDING', 'ACTIVE', 'COMPLETED'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter as any)}
                className={`px-3 py-1.5 text-sm rounded-lg font-semibold transition-all ${
                  activeFilter === filter
                    ? 'bg-[#c1ff72] text-black'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Investments List */}
          {filteredInvestments.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-sm text-gray-600 mb-3">No investments found</p>
              <button
                onClick={() => router.push('/investment/plans')}
                className="px-5 py-2 bg-linear-to-r from-[#c1ff72] to-[#8fd04f] text-black font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                Browse Investment Plans
              </button>
            </div>
          ) : (
            <div className="space-y-3 bg-linear-to-br from-gray-900 via-gray-800 to-black rounded-xl p-6">
              {filteredInvestments.map((investment) => (
                <div 
                  key={investment.id} 
                  onClick={() => {
                    setSelectedInvestment(investment);
                    setIsDetailsModalOpen(true);
                  }}
                  className="bg-white/10 backdrop-blur-sm rounded-lg shadow-lg border border-white/20 p-4 hover:bg-white/15 transition-all cursor-pointer"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    {/* Left Section */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            {investment.plan.cryptoIcon && (
                              <img 
                                src={investment.plan.cryptoIcon} 
                                alt={investment.plan.cryptoSymbol || 'Crypto'}
                                className="w-5 h-5 rounded-full object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            )}
                            <h3 className="text-base font-bold text-white">{investment.plan.planName}</h3>
                            {investment.plan.cryptoSymbol && (
                              <span className="text-xs font-semibold px-1.5 py-0.5 bg-[#c1ff72]/20 text-[#c1ff72] rounded border border-[#c1ff72]/30">
                                {investment.plan.cryptoSymbol}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex items-center gap-1 text-sm text-gray-300">
                              {getPaymentMethodIcon(investment.paymentMethod)}
                              <span>{investment.paymentMethod === 'BANK_WALLET' ? 'Bank Wallet' : 'Crypto'}</span>
                            </div>
                            <span className="text-gray-500">•</span>
                            <span className="text-sm text-gray-300">
                              {new Date(investment.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(investment.status)}`}>
                          {investment.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-400">Invested</p>
                          <p className="text-sm font-semibold text-white">${investment.amount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Expected Return</p>
                          <p className="text-sm font-semibold text-[#c1ff72]">
                            ${calculateExpectedReturn(investment).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Total Return</p>
                          <p className="text-sm font-semibold text-white">
                            ${calculateTotalReturn(investment).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Duration</p>
                          <p className="text-sm font-semibold text-white">{investment.plan.duration} days</p>
                        </div>
                      </div>

                      {/* Progress Bar for Active Investments */}
                      {investment.status === 'ACTIVE' && investment.startDate && investment.endDate && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                            <span>Progress</span>
                            <span>{calculateDaysRemaining(investment.endDate)} days remaining</span>
                          </div>
                          <div className="w-full bg-gray-700/50 rounded-full h-2">
                            <div
                              className="bg-linear-to-r from-[#c1ff72] to-[#8fd04f] h-2 rounded-full transition-all shadow-lg shadow-[#c1ff72]/50"
                              style={{ width: `${calculateProgress(investment.startDate, investment.endDate)}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Crypto Payment Instructions */}
                      {investment.status === 'PENDING' && investment.paymentMethod === 'CRYPTO' && investment.plan.cryptoAddress && (
                        <div className="mt-3 bg-yellow-500/20 border border-yellow-500/40 rounded-lg p-2.5 backdrop-blur-sm">
                          <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-yellow-300 mb-1">Complete Payment</p>
                              <p className="text-xs text-yellow-200 mb-2">Send ${investment.amount} to:</p>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 bg-black/30 px-3 py-2 rounded border border-yellow-500/30 text-xs font-mono break-all text-yellow-100">
                                  {investment.plan.cryptoAddress}
                                </code>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(investment.plan.cryptoAddress!);
                                    toast.success('Address copied!');
                                  }}
                                  className="px-3 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-400 text-xs font-semibold transition-colors"
                                >
                                  Copy
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Investment Details Modal */}
      {selectedInvestment && (
        <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 transition-opacity ${
          isDetailsModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}>
          <div className="bg-linear-to-br from-gray-900 via-gray-800 to-black rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto border border-white/20 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {selectedInvestment.plan.cryptoIcon && (
                  <img 
                    src={selectedInvestment.plan.cryptoIcon} 
                    alt={selectedInvestment.plan.cryptoSymbol || 'Crypto'}
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedInvestment.plan.planName}</h2>
                  {selectedInvestment.plan.cryptoSymbol && (
                    <span className="text-sm font-semibold text-[#c1ff72]">{selectedInvestment.plan.cryptoSymbol}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Status Badge */}
            <div className="mb-6">
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                selectedInvestment.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                selectedInvestment.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                selectedInvestment.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                selectedInvestment.status === 'CANCELLED' ? 'bg-gray-100 text-gray-800' :
                'bg-red-100 text-red-800'
              }`}>
                {selectedInvestment.status}
              </span>
            </div>

            {/* Investment Details Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="text-sm text-gray-400 mb-1">Amount Invested</p>
                <p className="text-2xl font-bold text-white">${selectedInvestment.amount.toLocaleString()}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="text-sm text-gray-400 mb-1">Expected Return</p>
                <p className="text-2xl font-bold text-[#c1ff72]">${calculateExpectedReturn(selectedInvestment).toLocaleString()}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="text-sm text-gray-400 mb-1">Total Return</p>
                <p className="text-2xl font-bold text-white">${calculateTotalReturn(selectedInvestment).toLocaleString()}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="text-sm text-gray-400 mb-1">Profit Percentage</p>
                <p className="text-2xl font-bold text-[#c1ff72]">{selectedInvestment.plan.profitPercentage}%</p>
              </div>
            </div>

            {/* Additional Details */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-gray-400">Duration</span>
                <span className="text-white font-semibold">{selectedInvestment.plan.duration} days</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-gray-400">Payment Method</span>
                <span className="text-white font-semibold">
                  {selectedInvestment.paymentMethod === 'BANK_WALLET' ? 'Bank Wallet' : 'Crypto'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-gray-400">Created Date</span>
                <span className="text-white font-semibold">
                  {new Date(selectedInvestment.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              {selectedInvestment.startDate && (
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-gray-400">Start Date</span>
                  <span className="text-white font-semibold">
                    {new Date(selectedInvestment.startDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              )}
              {selectedInvestment.endDate && (
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-gray-400">End Date</span>
                  <span className="text-white font-semibold">
                    {new Date(selectedInvestment.endDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              )}
              {selectedInvestment.transactionRef && (
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-gray-400">Transaction Ref</span>
                  <span className="text-white font-semibold font-mono text-sm">
                    {selectedInvestment.transactionRef}
                  </span>
                </div>
              )}
            </div>

            {/* Progress Bar for Active Investments */}
            {selectedInvestment.status === 'ACTIVE' && selectedInvestment.startDate && selectedInvestment.endDate && (
              <div className="mb-6">
                <div className="flex items-center justify-between text-sm text-gray-300 mb-2">
                  <span>Progress</span>
                  <span>{calculateDaysRemaining(selectedInvestment.endDate)} days remaining</span>
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-3">
                  <div
                    className="bg-linear-to-r from-[#c1ff72] to-[#8fd04f] h-3 rounded-full transition-all shadow-lg shadow-[#c1ff72]/50"
                    style={{ width: `${calculateProgress(selectedInvestment.startDate, selectedInvestment.endDate)}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Close Investment Button */}
            {(selectedInvestment.status === 'ACTIVE' || selectedInvestment.status === 'PENDING') && (
              <button
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  setIsSupportModalOpen(true);
                }}
                className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Close Investment
              </button>
            )}
          </div>
        </div>
      )}

      {/* Support Modal */}
      <SupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        initialTopic="Close Investment Request"
      />
    </div>
  );
}
