'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { InvestmentTopBar } from '@/components/layout/InvestmentTopBar';
import { investmentSidebarItems } from '@/config/investment-sidebar.config';
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
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
      }`}>
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">My Investments</h1>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-600 mb-1">Total Invested</p>
              <p className="text-2xl font-bold text-gray-900">${stats.total.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-600 mb-1">Active</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-600 mb-1">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-600 mb-1">Completed</p>
              <p className="text-2xl font-bold text-blue-600">{stats.completed}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-600 mb-1">Total Profit</p>
              <p className="text-2xl font-bold text-green-600">${stats.totalProfit.toLocaleString()}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {['ALL', 'PENDING', 'ACTIVE', 'COMPLETED'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter as any)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-gray-600 mb-4">No investments found</p>
              <button
                onClick={() => router.push('/investment/plans')}
                className="px-6 py-3 bg-linear-to-r from-[#c1ff72] to-[#8fd04f] text-black font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                Browse Investment Plans
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInvestments.map((investment) => (
                <div key={investment.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Left Section */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{investment.plan.planName}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              {getPaymentMethodIcon(investment.paymentMethod)}
                              <span>{investment.paymentMethod === 'BANK_WALLET' ? 'Bank Wallet' : 'Crypto'}</span>
                            </div>
                            <span className="text-gray-400">•</span>
                            <span className="text-sm text-gray-600">
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
                          <p className="text-xs text-gray-600">Invested</p>
                          <p className="text-sm font-semibold text-gray-900">${investment.amount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Expected Return</p>
                          <p className="text-sm font-semibold text-green-600">
                            ${calculateExpectedReturn(investment).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Total Return</p>
                          <p className="text-sm font-semibold text-gray-900">
                            ${calculateTotalReturn(investment).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Duration</p>
                          <p className="text-sm font-semibold text-gray-900">{investment.plan.duration} days</p>
                        </div>
                      </div>

                      {/* Progress Bar for Active Investments */}
                      {investment.status === 'ACTIVE' && investment.startDate && investment.endDate && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>Progress</span>
                            <span>{calculateDaysRemaining(investment.endDate)} days remaining</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-linear-to-r from-[#c1ff72] to-[#8fd04f] h-2 rounded-full transition-all"
                              style={{ width: `${calculateProgress(investment.startDate, investment.endDate)}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Crypto Payment Instructions */}
                      {investment.status === 'PENDING' && investment.paymentMethod === 'CRYPTO' && investment.plan.cryptoAddress && (
                        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-yellow-900 mb-1">Complete Payment</p>
                              <p className="text-xs text-yellow-800 mb-2">Send ${investment.amount} to:</p>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 bg-white px-3 py-2 rounded border border-yellow-300 text-xs font-mono break-all">
                                  {investment.plan.cryptoAddress}
                                </code>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(investment.plan.cryptoAddress!);
                                    toast.success('Address copied!');
                                  }}
                                  className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-xs"
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
    </div>
  );
}
