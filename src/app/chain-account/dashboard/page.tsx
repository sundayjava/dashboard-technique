'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChainAccountSessionManager } from '@/lib/chain-account-session';
import DepositModal from '@/components/chain-account/DepositModal';
import InvestmentModal from '@/components/chain-account/InvestmentModal';
import WithdrawalModal from '@/components/chain-account/WithdrawalModal';
import RemoveMemberModal from '@/components/chain-account/RemoveMemberModal';
import ModifyAccountModal from '@/components/chain-account/ModifyAccountModal';
import CloseAccountModal from '@/components/chain-account/CloseAccountModal';
import axios from 'axios';
import {
  LogOut, Users, DollarSign, TrendingUp, ArrowDownCircle,
  ArrowUpCircle, Bell, Loader2, AlertCircle, CheckCircle,
  RefreshCw, CreditCard, PieChart, Plus, Settings, UserX,
  XCircle, FileEdit
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DashboardData {
  chainAccount: {
    id: string;
    accountName: string;
    accountNumber: string;
    balance: number;
    currency: string;
    investmentBalance: number;
    status: string;
    authorizationModel: string;
    thresholdAmount: number | null;
    thresholdCurrency: string | null;
    primaryPurpose: string;
    purposeDescription: string;
  };
  member: {
    id: string;
    role: string;
    hasConfirmed: boolean;
  };
  members: Array<{
    id: string;
    userId: string;
    role: string;
    hasConfirmed: boolean;
    user: {
      name: string | null;
      email: string;
    };
  }>;
  stats: {
    totalDeposits: number;
    totalInvestments: number;
    totalWithdrawals: number;
    activeInvestments: number;
    pendingApprovals: number;
  };
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    currency: string;
    description: string;
    createdAt: string;
  }>;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
  }>;
}

export default function ChainAccountDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'deposits' | 'investments' | 'withdrawals' | 'notifications' | 'settings'>('overview');
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showInvestmentModal, setShowInvestmentModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
  const [showModifyAccountModal, setShowModifyAccountModal] = useState(false);
  const [showCloseAccountModal, setShowCloseAccountModal] = useState(false);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    // Check Chain Account session
    const chainSession = ChainAccountSessionManager.getSession();
    console.log('Chain Session from localStorage:', chainSession);
    
    if (!chainSession || !ChainAccountSessionManager.isSessionValid()) {
      toast.error('Chain Account session expired. Please log in again.');
      router.push('/chain-account/login');
      return;
    }

    console.log('Using chainAccountId:', chainSession.chainAccountId);
    setSession(chainSession);
    fetchDashboardData(chainSession.chainAccountId);
  }, [router]);

  const fetchDashboardData = async (chainAccountId: string) => {
    try {
      const token = ChainAccountSessionManager.getToken();
      console.log('Fetching dashboard for chainAccountId:', chainAccountId);
      console.log('Token exists:', !!token);
      console.log('Token value (first 50 chars):', token?.substring(0, 50));
      console.log('Chain Account Session from storage:', ChainAccountSessionManager.getSession());

      if (!token) {
        toast.error('No Chain Account token found. Please log in again.');
        router.push('/chain-account/login');
        return;
      }

      const response = await axios.get(`/api/chain-account/dashboard?chainAccountId=${chainAccountId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      console.error('Error response:', error.response?.data);

      const status = error.response?.status;
      if (status === 401 || status === 404) {
        // Session invalid or member no longer belongs to this Chain Account (e.g. removed)
        ChainAccountSessionManager.clearSession();
        toast.error('You no longer have access to this Chain Account.');
        router.push('/dashboard');
        return;
      }

      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTabData = async () => {
    if (!session) return;
    
    try {
      const headers = { 'Authorization': `Bearer ${ChainAccountSessionManager.getToken()}` };
      
      if (activeTab === 'deposits') {
        const response = await axios.get(`/api/chain-account/deposit?chainAccountId=${session.chainAccountId}`, { headers });
        if (response.data.success) setDeposits(response.data.deposits);
      } else if (activeTab === 'investments') {
        const response = await axios.get(`/api/chain-account/invest?chainAccountId=${session.chainAccountId}`, { headers });
        if (response.data.success) setInvestments(response.data.investments);
      } else if (activeTab === 'withdrawals') {
        const response = await axios.get(`/api/chain-account/withdraw?chainAccountId=${session.chainAccountId}`, { headers });
        if (response.data.success) setWithdrawals(response.data.withdrawals);
      }
    } catch (error) {
      console.error('Error fetching tab data:', error);
    }
  };

  useEffect(() => {
    if (session && data) {
      fetchTabData();
    }
  }, [activeTab, session, data]);

  const handleRefresh = () => {
    if (!session) return;
    setRefreshing(true);
    fetchDashboardData(session.chainAccountId);
    fetchTabData();
  };

  const handleModalSuccess = () => {
    handleRefresh();
  };

  const handleExit = () => {
    ChainAccountSessionManager.clearSession();
    toast.success('Logged out from Chain Account');
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading Chain Account...</p>
        </div>
      </div>
    );
  }

  if (!session || !data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Distinct Header - Blue Theme */}
      <header className="bg-linear-to-r from-blue-600 to-indigo-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <Users className="w-8 h-8" />
                <div>
                  <h1 className="text-2xl font-bold">{data.chainAccount.accountName}</h1>
                  <p className="text-blue-100 text-sm">Chain Account • {data.chainAccount.accountNumber}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleExit}
                className="flex items-center px-4 py-2 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Exit to Personal Dashboard
              </button>
            </div>
          </div>

          {/* Balance Display */}
          <div className="mt-6 grid grid-cols-3 gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-blue-100 text-sm mb-1">Available Balance</p>
              <p className="text-3xl font-bold">
                ${data.chainAccount.balance.toLocaleString()}
              </p>
              <p className="text-blue-100 text-xs mt-1">{data.chainAccount.currency}</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-blue-100 text-sm mb-1">Investment Balance</p>
              <p className="text-3xl font-bold">
                ${data.chainAccount.investmentBalance.toLocaleString()}
              </p>
              <p className="text-blue-100 text-xs mt-1">Active Investments: {data.stats.activeInvestments}</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-blue-100 text-sm mb-1">Total Value</p>
              <p className="text-3xl font-bold">
                ${(data.chainAccount.balance + data.chainAccount.investmentBalance).toLocaleString()}
              </p>
              <p className="text-blue-100 text-xs mt-1">Combined Holdings</p>
            </div>
          </div>

          {/* Member Info */}
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <span className="bg-white/20 px-3 py-1 rounded-full">
                Your Role: <span className="font-semibold">{session.role.replace('_', ' ')}</span>
              </span>
              <span className="bg-white/20 px-3 py-1 rounded-full">
                Authorization: <span className="font-semibold">{data.chainAccount.authorizationModel}</span>
              </span>
              {data.chainAccount.thresholdAmount && (
                <span className="bg-white/20 px-3 py-1 rounded-full">
                  Threshold: <span className="font-semibold">${data.chainAccount.thresholdAmount.toLocaleString()} {data.chainAccount.thresholdCurrency}</span>
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>{data.members.length} Members</span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: PieChart },
              { id: 'deposits', label: 'Deposits', icon: ArrowDownCircle },
              { id: 'investments', label: 'Investments', icon: TrendingUp },
              { id: 'withdrawals', label: 'Withdrawals', icon: ArrowUpCircle },
              { id: 'notifications', label: 'Notifications', icon: Bell, badge: data.notifications.filter(n => !n.isRead).length },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                  {tab.badge && tab.badge > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Total Deposits</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      ${data.stats.totalDeposits.toLocaleString()}
                    </p>
                  </div>
                  <ArrowDownCircle className="w-10 h-10 text-green-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Total Investments</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      ${data.stats.totalInvestments.toLocaleString()}
                    </p>
                  </div>
                  <TrendingUp className="w-10 h-10 text-blue-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Total Withdrawals</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      ${data.stats.totalWithdrawals.toLocaleString()}
                    </p>
                  </div>
                  <ArrowUpCircle className="w-10 h-10 text-orange-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Pending Approvals</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {data.stats.pendingApprovals}
                    </p>
                  </div>
                  <AlertCircle className="w-10 h-10 text-yellow-500" />
                </div>
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-2 gap-6">
              {/* Account Members */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-blue-600" />
                  Account Members
                </h3>
                <div className="space-y-3">
                  {data.members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">
                          {member.user.name || 'User'}
                          {member.id === session.memberId && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">You</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-600">{member.user.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-gray-600">{member.role.replace('_', ' ')}</p>
                        {member.hasConfirmed ? (
                          <span className="text-xs text-green-600 flex items-center">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </span>
                        ) : (
                          <span className="text-xs text-yellow-600">Pending</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
                  Recent Transactions
                </h3>
                {data.recentTransactions.length > 0 ? (
                  <div className="space-y-3">
                    {data.recentTransactions.slice(0, 3).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                          {tx.type === 'DEPOSIT' && <ArrowDownCircle className="w-5 h-5 text-green-500" />}
                          {tx.type === 'WITHDRAWAL' && <ArrowUpCircle className="w-5 h-5 text-orange-500" />}
                          {tx.type === 'INVESTMENT' && <TrendingUp className="w-5 h-5 text-blue-500" />}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{tx.description}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <p className={`font-semibold ${
                          tx.type === 'DEPOSIT' ? 'text-green-600' : 'text-gray-900'
                        }`}>
                          {tx.type === 'DEPOSIT' ? '+' : '-'}${tx.amount.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <CreditCard className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No transactions yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'deposits' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Deposits</h2>
                <button
                  onClick={() => setShowDepositModal(true)}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Deposit
                </button>
              </div>
              
              {deposits.length > 0 ? (
                <div className="space-y-3">
                  {deposits.map((deposit) => (
                    <div key={deposit.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{deposit.depositReference}</p>
                        <p className="text-sm text-gray-600">
                          {deposit.depositMethod} • Deposited by {deposit.depositedBy?.name || deposit.depositedBy?.email || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(deposit.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{deposit.currency} {deposit.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <span className={`text-xs px-2 py-1 rounded ${
                          deposit.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                          deposit.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {deposit.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <ArrowDownCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="mb-4">No deposits yet</p>
                  <button
                    onClick={() => setShowDepositModal(true)}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Make your first deposit →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'investments' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Investments</h2>
                <button
                  onClick={() => setShowInvestmentModal(true)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Investment
                </button>
              </div>
              
              {investments.length > 0 ? (
                <div className="space-y-3">
                  {investments.map((investment) => (
                    <div key={investment.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="font-medium text-gray-900">{investment.plan.planName}</p>
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                            {investment.plan.returnRate}% ROI
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {investment.investmentReference} • Initiated by {investment.initiatedBy}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(investment.startDate).toLocaleDateString()} → {new Date(investment.maturityDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">${investment.amount.toLocaleString()}</p>
                        <p className="text-xs text-green-600">+${investment.expectedReturn.toLocaleString()} return</p>
                        <span className={`text-xs px-2 py-1 rounded mt-1 inline-block ${
                          investment.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                          investment.status === 'PENDING_APPROVAL' ? 'bg-yellow-100 text-yellow-700' :
                          investment.status === 'MATURED' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {investment.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="mb-4">No investments yet</p>
                  <button
                    onClick={() => setShowInvestmentModal(true)}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Start investing →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Withdrawals</h2>
                <button
                  onClick={() => setShowWithdrawalModal(true)}
                  className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Withdrawal
                </button>
              </div>
              
              {withdrawals.length > 0 ? (
                <div className="space-y-3">
                  {withdrawals.map((withdrawal) => (
                    <div key={withdrawal.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-medium text-gray-900">{withdrawal.withdrawalReference}</p>
                          <p className="text-sm text-gray-600">Initiated by {withdrawal.initiatedBy}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(withdrawal.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">${withdrawal.totalAmount.toLocaleString()}</p>
                          <span className={`text-xs px-2 py-1 rounded ${
                            withdrawal.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            withdrawal.status === 'PENDING_APPROVAL' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {withdrawal.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-600 mb-2">Distribution to {withdrawal.memberDistributions.length} member(s):</p>
                        <div className="space-y-1">
                          {withdrawal.memberDistributions.map((dist: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-xs">
                              <span className="text-gray-600">Member {idx + 1}</span>
                              <span className="text-gray-900 font-medium">${dist.amount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <ArrowUpCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="mb-4">No withdrawals yet</p>
                  <button
                    onClick={() => setShowWithdrawalModal(true)}
                    className="text-orange-600 hover:text-orange-700 font-medium"
                  >
                    Request withdrawal →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Notifications</h2>
            {data.notifications.length > 0 ? (
              <div className="space-y-3">
                {data.notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg border ${
                      notification.isRead
                        ? 'bg-white border-gray-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{notification.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <span className="ml-4 w-2 h-2 bg-blue-500 rounded-full"></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>No notifications</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Account Management */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <Settings className="w-6 h-6 mr-2 text-blue-600" />
                Account Management
              </h2>

              <div className="space-y-4">
                {/* Modify Account Settings */}
                <div className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <FileEdit className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Modify Account Settings</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        Change authorization model, transaction thresholds, or account purpose.
                      </p>
                      <div className="flex items-start space-x-2 text-xs text-gray-500">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>Requires approval from all members and final admin approval</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowModifyAccountModal(true)}
                      className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center shrink-0"
                    >
                      <FileEdit className="w-4 h-4 mr-2" />
                      Modify Settings
                    </button>
                  </div>
                </div>

                {/* Remove Member */}
                <div className="border border-gray-200 rounded-lg p-6 hover:border-orange-300 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <UserX className="w-5 h-5 text-orange-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Remove Member</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        Request to remove a member from this Chain Account.
                      </p>
                      <div className="flex items-start space-x-2 text-xs text-gray-500">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>Target member must approve, then all remaining members vote, followed by admin approval</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowRemoveMemberModal(true)}
                      className="ml-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center shrink-0"
                    >
                      <UserX className="w-4 h-4 mr-2" />
                      Remove Member
                    </button>
                  </div>
                </div>

                {/* Close Account */}
                <div className="border-2 border-red-200 bg-red-50 rounded-lg p-6 hover:border-red-300 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <h3 className="text-lg font-semibold text-red-900">Close Account</h3>
                      </div>
                      <p className="text-sm text-red-800 mb-3">
                        Permanently close this Chain Account. This action cannot be undone.
                      </p>
                      <div className="flex items-start space-x-2 text-xs text-red-700">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-semibold mb-1">Requirements:</p>
                          <ul className="list-disc list-inside space-y-0.5">
                            <li>Account balance must be $0</li>
                            <li>All members must approve</li>
                            <li>Admin must give final approval</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowCloseAccountModal(true)}
                      className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center shrink-0"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Close Account
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Current Settings Display */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Settings</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Authorization Model</h3>
                  <p className="text-lg font-semibold text-gray-900">
                    {data.chainAccount.authorizationModel.replace('_', ' ')}
                  </p>
                </div>
                {data.chainAccount.thresholdAmount && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-2">Transaction Threshold</h3>
                    <p className="text-lg font-semibold text-gray-900">
                      {data.chainAccount.thresholdCurrency} ${data.chainAccount.thresholdAmount.toLocaleString()}
                    </p>
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Account Status</h3>
                  <p className="text-lg font-semibold text-green-600">
                    {data.chainAccount.status}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Total Members</h3>
                  <p className="text-lg font-semibold text-gray-900">
                    {data.members.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {data && session && (
        <>
          <DepositModal
            isOpen={showDepositModal}
            onClose={() => setShowDepositModal(false)}
            chainAccountId={data.chainAccount.id}
            chainAccount={{
              cryptoDepositAddress: (data.chainAccount as any).cryptoDepositAddress,
              cryptoNetwork: (data.chainAccount as any).cryptoNetwork,
              cryptoToken: (data.chainAccount as any).cryptoToken,
            }}
            onSuccess={handleModalSuccess}
          />

          <InvestmentModal
            isOpen={showInvestmentModal}
            onClose={() => setShowInvestmentModal(false)}
            chainAccountId={data.chainAccount.id}
            accountBalance={data.chainAccount.balance}
            authorizationModel={data.chainAccount.authorizationModel}
            thresholdAmount={data.chainAccount.thresholdAmount}
            onSuccess={handleModalSuccess}
          />

          <WithdrawalModal
            isOpen={showWithdrawalModal}
            onClose={() => setShowWithdrawalModal(false)}
            chainAccountId={data.chainAccount.id}
            members={data.members}
            accountBalance={data.chainAccount.balance}
            authorizationModel={data.chainAccount.authorizationModel}
            thresholdAmount={data.chainAccount.thresholdAmount}
            onSuccess={handleModalSuccess}
          />

          <RemoveMemberModal
            isOpen={showRemoveMemberModal}
            onClose={() => setShowRemoveMemberModal(false)}
            chainAccountId={data.chainAccount.id}
            currentMemberId={data.member.id}
            members={data.members}
            accessToken={ChainAccountSessionManager.getToken() || ''}
          />

          <ModifyAccountModal
            isOpen={showModifyAccountModal}
            onClose={() => setShowModifyAccountModal(false)}
            chainAccountId={data.chainAccount.id}
            chainAccount={{
              authorizationModel: data.chainAccount.authorizationModel,
              thresholdAmount: data.chainAccount.thresholdAmount,
              thresholdCurrency: data.chainAccount.thresholdCurrency || 'USD',
              primaryPurpose: data.chainAccount.primaryPurpose || '',
              purposeDescription: data.chainAccount.purposeDescription || '',
            }}
            accessToken={ChainAccountSessionManager.getToken() || ''}
          />

          <CloseAccountModal
            isOpen={showCloseAccountModal}
            onClose={() => setShowCloseAccountModal(false)}
            chainAccountId={data.chainAccount.id}
            accountName={data.chainAccount.accountName}
            balance={data.chainAccount.balance}
            accessToken={ChainAccountSessionManager.getToken() || ''}
          />
        </>
      )}
    </div>
  );
}
