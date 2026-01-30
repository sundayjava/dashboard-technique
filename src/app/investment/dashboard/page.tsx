'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { InvestmentTopBar } from '@/components/layout/InvestmentTopBar';
import { investmentSidebarItems } from '@/config/investment-sidebar.config';
import AcredisPlusModal from '@/components/modals/AcredisPlusModal';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  DollarSign, BarChart3, Activity, Clock, Calendar, 
  PieChart, Wallet, Plus, ArrowUpCircle, ArrowDownCircle, Award
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import MiniLineChart from '@/components/MiniLineChart';

interface CryptoToken {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  icon: string;
  priceHistory: { time: string; price: number }[];
}

interface EconomicEvent {
  id: string;
  date: string;
  time: string;
  country: string;
  event: string;
  impact: 'high' | 'medium' | 'low';
  forecast: string;
  previous: string;
}

export default function InvestmentDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState<'bank' | 'crypto' | null>(null);
  const [cryptoTransactionId, setCryptoTransactionId] = useState('');
  const [cryptoDepositInfo, setCryptoDepositInfo] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({
    investmentBalance: 0,
    totalInvested: 0,
    activeInvestments: 0,
    totalReturns: 0,
    portfolioValue: 0,
  });
  const [cryptoData, setCryptoData] = useState<CryptoToken[]>([]);
  const [economicEvents, setEconomicEvents] = useState<EconomicEvent[]>([]);
  const [cryptoUpdating, setCryptoUpdating] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showPlusModal, setShowPlusModal] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      toast.error('Please log in to continue');
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    // Check if user has investment access
    checkInvestmentAccess(parsedUser.id);
    fetchCryptoData();
    fetchEconomicCalendar();
    fetchCryptoDepositInfo();
    fetchTransactions(parsedUser.id);

    // Auto-refresh crypto data every 10 seconds
    const interval = setInterval(fetchCryptoData, 10000);
    return () => clearInterval(interval);
  }, [router]);

  const fetchCryptoData = async () => {
    try {
      setCryptoUpdating(true);
      const response = await axios.get('/api/investment/crypto-prices');
      if (response.data.success) {
        setCryptoData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching crypto data:', error);
    } finally {
      setCryptoUpdating(false);
    }
  };

  const fetchEconomicCalendar = async () => {
    try {
      const response = await axios.get('/api/economic-calendar');
      if (response.data.success) {
        setEconomicEvents(response.data.events);
      }
    } catch (error) {
      console.error('Error fetching economic calendar:', error);
    }
  };

  const fetchCryptoDepositInfo = async () => {
    try {
      const response = await axios.get('/api/investments/crypto-deposit-info');
      if (response.data.success) {
        setCryptoDepositInfo(response.data.info);
      }
    } catch (error) {
      console.error('Error fetching crypto deposit info:', error);
    }
  };

  const checkInvestmentAccess = async (userId: string) => {
    try {
      setIsLoading(true);
      const response = await axios.get(`/api/trade-key/check-access?userId=${userId}`);
      
      if (!response.data.hasAccess) {
        toast.error('You need a valid trade key to access investments');
        router.push('/dashboard');
        return;
      }

      // User has access, load dashboard data
      fetchDashboardStats(userId);
      setIsLoading(false);
    } catch (error) {
      console.error('Error checking access:', error);
      toast.error('Failed to verify investment access');
      router.push('/dashboard');
    }
  };

  const fetchDashboardStats = async (userId: string) => {
    try {
      const response = await axios.get(`/api/investments/stats?userId=${userId}`);
      if (response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchTransactions = async (userId: string) => {
    try {
      setLoadingTransactions(true);
      const response = await axios.get(`/api/investments/transactions?userId=${userId}&limit=10`);
      if (response.data.success) {
        setTransactions(response.data.transactions);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleDeposit = async () => {
    if (!depositMethod) {
      toast.error('Please select a deposit method');
      return;
    }

    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (depositMethod === 'crypto' && !cryptoTransactionId.trim()) {
      toast.error('Please enter transaction ID');
      return;
    }

    try {
      setIsProcessing(true);
      const response = await axios.post('/api/investments/deposit', {
        userId: user.id,
        amount: parseFloat(depositAmount),
        method: depositMethod,
        transactionId: depositMethod === 'crypto' ? cryptoTransactionId : undefined
      });

      if (response.data.success) {
        if (depositMethod === 'bank') {
          toast.success('Deposit successful!');
          fetchDashboardStats(user.id);
          fetchTransactions(user.id);
        } else {
          toast.success('Deposit request submitted! Awaiting admin confirmation.');
          fetchTransactions(user.id);
        }
        setShowDepositModal(false);
        setDepositAmount('');
        setDepositMethod(null);
        setCryptoTransactionId('');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Deposit failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      setIsProcessing(true);
      const response = await axios.post('/api/investments/withdraw', {
        userId: user.id,
        amount: parseFloat(withdrawAmount)
      });

      if (response.data.success) {
        toast.success('Withdrawal successful!');
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        fetchDashboardStats(user.id);
        fetchTransactions(user.id);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Withdrawal failed');
    } finally {
      setIsProcessing(false);
    }
  };



  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading investment dashboard...</p>
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
        onPlusUpgrade={() => setShowPlusModal(true)}
      />
      
      <InvestmentTopBar 
        user={user}
        sidebarCollapsed={sidebarCollapsed}
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      <main className={`pt-16 pb-4 px-3 md:px-4 transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'
      }`}>
        <div className="space-y-4">
          {/* Welcome Banner with Gradient */}
          <div className="bg-linear-to-r from-purple-900 via-purple-800 to-indigo-900 rounded-lg p-4 text-white">
            <h1 className="text-lg font-bold mb-1">Acredis Secure Stake 📈</h1>
            <p className="text-sm text-purple-200">Track your investments and grow your wealth</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Investment Balance */}
            <div className="bg-white rounded-lg p-3 shadow border-l-4 border-blue-500">
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-blue-600" />
                </div>
                <DollarSign className="w-3 h-3 text-blue-600" />
              </div>
              <p className="text-xs text-gray-600 mb-1">Balance</p>
              <p className="text-lg font-bold text-gray-900">
                ${stats.investmentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>

            {/* Active Investments */}
            <div className="bg-white rounded-lg p-3 shadow border-l-4 border-green-500">
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-green-600" />
                </div>
                <Activity className="w-3 h-3 text-green-600" />
              </div>
              <p className="text-xs text-gray-600 mb-1">Active Plans</p>
              <p className="text-lg font-bold text-gray-900">{stats.activeInvestments}</p>
            </div>

            {/* Total Returns */}
            <div className="bg-white rounded-lg p-3 shadow border-l-4 border-purple-500">
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-xs text-green-600 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +12.5%
                </span>
              </div>
              <p className="text-xs text-gray-600 mb-1">Total Returns</p>
              <p className="text-lg font-bold text-gray-900">
                ${stats.totalReturns.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>

            {/* Portfolio Value */}
            <div className="bg-white rounded-lg p-3 shadow border-l-4 border-orange-500">
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <PieChart className="w-4 h-4 text-orange-600" />
                </div>
                <DollarSign className="w-3 h-3 text-orange-600" />
              </div>
              <p className="text-xs text-gray-600 mb-1">Portfolio Value</p>
              <p className="text-lg font-bold text-gray-900">
                ${stats.portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>


          {/* Quick Investment Actions */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-base font-bold text-gray-900 mb-3">Quick Actions</h2>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setShowDepositModal(true)}
                className="p-3 rounded-lg border-2 border-green-200 hover:border-green-500 hover:bg-green-50 transition-all duration-200 group"
              >
                <div className="w-10 h-10 bg-green-100 group-hover:bg-green-200 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <ArrowDownCircle className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-xs font-semibold text-gray-900 text-center">Deposit</p>
              </button>

              <button
                onClick={() => setShowWithdrawModal(true)}
                className="p-3 rounded-lg border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 group"
              >
                <div className="w-10 h-10 bg-blue-100 group-hover:bg-blue-200 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <ArrowUpCircle className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-xs font-semibold text-gray-900 text-center">Withdraw</p>
              </button>

              <button
                onClick={() => router.push('/investment/plans')}
                className="p-3 rounded-lg border-2 border-purple-200 hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 group"
              >
                <div className="w-10 h-10 bg-purple-100 group-hover:bg-purple-200 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-xs font-semibold text-gray-900 text-center">AI Trade</p>
              </button>
            </div>
          </div>


          {/* Recent Transactions */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900">Recent Transactions</h2>
              <Clock className="w-4 h-4 text-gray-400" />
            </div>
            
            {loadingTransactions ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <Activity className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((transaction) => {
                  const isDeposit = transaction.transactionType === 'DEPOSIT';
                  const isWithdrawal = transaction.transactionType === 'WITHDRAWAL';
                  const isPending = transaction.status === 'PENDING';
                  const isFailed = transaction.status === 'FAILED';
                  
                  return (
                    <div 
                      key={transaction.id} 
                      onClick={() => {
                        setSelectedTransaction(transaction);
                        setShowTransactionModal(true);
                      }}
                      className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isDeposit ? 'bg-green-100' : 
                          isWithdrawal ? 'bg-blue-100' : 
                          'bg-purple-100'
                        }`}>
                          {isDeposit ? (
                            <ArrowDownCircle className={`w-4 h-4 ${
                              isPending ? 'text-yellow-600' : isFailed ? 'text-red-600' : 'text-green-600'
                            }`} />
                          ) : isWithdrawal ? (
                            <ArrowUpCircle className="w-4 h-4 text-blue-600" />
                          ) : (
                            <TrendingUp className="w-4 h-4 text-purple-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {transaction.description}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-gray-500">
                              {new Date(transaction.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              isPending ? 'bg-yellow-100 text-yellow-700' :
                              isFailed ? 'bg-red-100 text-red-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {transaction.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${
                          isDeposit ? 'text-green-600' : 
                          isWithdrawal ? 'text-blue-600' : 
                          'text-purple-600'
                        }`}>
                          {isDeposit ? '+' : isWithdrawal ? '-' : '+'}
                          ${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {transaction.transactionType.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Main Content Grid - Market Data + Economic Calendar + Market Timeline */} 
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Live Markets - 3x3 Grid */}
            <div className="bg-white rounded-lg shadow p-3">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-gray-900">Live Markets</h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${cryptoUpdating ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
                  <span className={`text-[10px] font-medium ${cryptoUpdating ? 'text-blue-600' : 'text-green-600'}`}>
                    {cryptoUpdating ? 'Updating...' : 'Real-time'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {cryptoData.slice(0, 9).map((crypto, index) => {
                  const priceHistory = crypto.priceHistory.map(item => item.price);
                  const trend = crypto.change24h >= 0 ? 'up' : 'down';

                  return (
                    <div
                      key={index}
                      className="p-1.5 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-all duration-300"
                      style={{ transform: cryptoUpdating ? 'scale(0.95)' : 'scale(1)' }}
                    >
                      <div className="text-[10px] sm:text-xs font-bold text-gray-900 mb-1 truncate">
                        {crypto.symbol}
                      </div>
                      <div className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-1">
                        ${crypto.price < 1 
                          ? crypto.price.toFixed(4)
                          : crypto.price.toLocaleString('en-US', { maximumFractionDigits: 0 })
                        }
                      </div>
                      <div className="h-5 mb-1">
                        <MiniLineChart 
                          data={priceHistory}
                          trend={trend}
                          height={20}
                        />
                      </div>
                      <div className={`text-[9px] sm:text-[10px] font-semibold ${
                        crypto.change24h >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {crypto.change24h >= 0 ? '+' : ''}{crypto.change24h.toFixed(2)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Economic Calendar */}
            <div className="bg-white rounded-lg shadow p-3">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-gray-900">Economic Calendar</h2>
                </div>
              </div>

              <div className="overflow-y-auto max-h-62.5 pr-1 custom-scrollbar-light">
                {economicEvents.slice(0, 10).map((event) => (
                  <div key={event.id} className="mb-2 pb-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-700">{event.country}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          event.impact === 'high' ? 'bg-red-100 text-red-700' :
                          event.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {event.impact.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-medium">{event.time}</span>
                    </div>

                    <p className="text-xs font-semibold text-gray-900 mb-1.5 line-clamp-2">
                      {event.event}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-500">Forecast:</span>
                        <span className="text-[10px] font-semibold text-gray-700">{event.forecast}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-500">Prev:</span>
                        <span className="text-[10px] font-semibold text-gray-600">{event.previous}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Market Timeline Chart */}
            <div className="bg-white rounded-lg shadow p-3">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-gray-900">Market Timeline - 24H</h2>
                </div>
                <span className="text-xs text-gray-500">{cryptoData.length} Assets</span>
              </div>

              {/* Legend */}
              <div className="grid grid-cols-3 gap-1.5 mb-3 p-2 bg-gray-50 rounded">
                {cryptoData.slice(0, 9).map((crypto, index) => {
                  const colors = [
                    'rgb(59, 130, 246)', // blue
                    'rgb(147, 51, 234)', // purple
                    'rgb(236, 72, 153)', // pink
                    'rgb(34, 197, 94)', // green
                    'rgb(251, 146, 60)', // orange
                    'rgb(14, 165, 233)', // sky
                    'rgb(168, 85, 247)', // violet
                    'rgb(234, 88, 12)', // red-orange
                    'rgb(16, 185, 129)', // emerald
                  ];
                  const color = colors[index % colors.length];

                  return (
                    <div key={index} className="flex items-center gap-1">
                      <div 
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      ></div>
                      <span className="text-[10px] sm:text-xs font-semibold text-gray-700 truncate">{crypto.symbol}</span>
                      <span className={`text-[10px] sm:text-xs font-medium shrink-0 ${
                        crypto.change24h >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {crypto.change24h >= 0 ? '+' : ''}{crypto.change24h.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Combined Timeline Chart */}
              <div className="w-full min-h-25" style={{ height: '100px' }}>
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="w-full h-full"
                >
                  <defs>
                    {cryptoData.slice(0, 9).map((crypto, index) => {
                      const colors = [
                        'rgb(59, 130, 246)', // blue
                        'rgb(147, 51, 234)', // purple
                        'rgb(236, 72, 153)', // pink
                        'rgb(34, 197, 94)', // green
                        'rgb(251, 146, 60)', // orange
                        'rgb(14, 165, 233)', // sky
                        'rgb(168, 85, 247)', // violet
                        'rgb(234, 88, 12)', // red-orange
                        'rgb(16, 185, 129)', // emerald
                      ];
                      const color = colors[index % colors.length];

                      return (
                        <linearGradient key={index} id={`gradient-invest-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
                        </linearGradient>
                      );
                    })}
                  </defs>

                  {/* Draw all crypto lines */}
                  {cryptoData.slice(0, 9).map((crypto, index) => {
                    const colors = [
                      'rgb(59, 130, 246)', // blue
                      'rgb(147, 51, 234)', // purple
                      'rgb(236, 72, 153)', // pink
                      'rgb(34, 197, 94)', // green
                      'rgb(251, 146, 60)', // orange
                      'rgb(14, 165, 233)', // sky
                      'rgb(168, 85, 247)', // violet
                      'rgb(234, 88, 12)', // red-orange
                      'rgb(16, 185, 129)', // emerald
                    ];
                    const color = colors[index % colors.length];

                    // Get all prices from all cryptos to find global min/max for proper scaling
                    const allPrices = cryptoData.slice(0, 9).flatMap(c => 
                      c.priceHistory.map(item => item.price)
                    );
                    const globalMax = Math.max(...allPrices);
                    const globalMin = Math.min(...allPrices);
                    const range = globalMax - globalMin || 1;

                    // Normalize this instrument's prices
                    const prices = crypto.priceHistory.map(item => item.price);
                    const points = prices.map((price, i) => {
                      const x = (i / (prices.length - 1)) * 100;
                      const y = 100 - ((price - globalMin) / range) * 90; // Use 90% of height
                      return `${x},${y}`;
                    });

                    const pathD = `M ${points.join(' L ')}`;
                    const areaD = `M 0,100 L ${points.join(' L ')} L 100,100 Z`;

                    return (
                      <g key={index}>
                        {/* Area fill */}
                        <path 
                          d={areaD} 
                          fill={`url(#gradient-invest-${index})`}
                          className="transition-all duration-700"
                        />

                        {/* Line */}
                        <path
                          d={pathD}
                          fill="none"
                          stroke={color}
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                          className="transition-all duration-700"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.9"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Timeline labels */}
              <div className="flex justify-between mt-2 px-1">
                <span className="text-xs sm:text-sm text-gray-500 font-medium">24h ago</span>
                <span className="text-xs sm:text-sm text-gray-500 font-medium">Now</span>
              </div>

              {/* Stats Summary */}
              {cryptoData.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-200">
                  <div className="text-center">
                    <div className="text-[10px] sm:text-xs text-gray-500">Highest</div>
                    <div className="text-xs sm:text-sm font-bold text-green-600 truncate">
                      {cryptoData.slice(0, 9).reduce((max, c) => c.change24h > max.change24h ? c : max).symbol}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] sm:text-xs text-gray-500">Average</div>
                    <div className="text-xs sm:text-sm font-bold text-gray-900">
                      {(cryptoData.slice(0, 9).reduce((sum, c) => sum + c.change24h, 0) / cryptoData.slice(0, 9).length).toFixed(2)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] sm:text-xs text-gray-500">Lowest</div>
                    <div className="text-xs sm:text-sm font-bold text-red-600 truncate">
                      {cryptoData.slice(0, 9).reduce((min, c) => c.change24h < min.change24h ? c : min).symbol}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tokenization Section */}
          <div className="bg-linear-to-br from-blue-900 via-blue-800 to-indigo-900 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-400/20 rounded-xl flex items-center justify-center shrink-0">
                <Award className="w-6 h-6 text-blue-200" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-3">Tokenization</h2>
                <p className="text-blue-100 leading-relaxed">
                  Explore unique investment opportunities and raise capital with bank-grade tokenization for a variety of asset classes, such as traditional securities, private markets and art and collectibles.
                </p>
              </div>
            </div>
          </div>

          {/* Asset Management Section */}
          <div className="bg-linear-to-br from-white via-purple-800 to-white rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-purple-400/20 rounded-xl flex items-center justify-center shrink-0">
                <PieChart className="w-6 h-6 text-purple-200" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-3">Asset Management</h2>
                <p className="text-purple-100 leading-relaxed">
                  Access a range of passive and active investment products to gain exposure to growth, trends and excess return opportunities in the crypto market.
                </p>
              </div>
            </div>
          </div>

          {/* Timeline Section */}
          <div className="bg-linear-to-br from-[#c1ff72] via-green-800 to-[#c1ff72] rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-400/20 rounded-xl flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-green-200" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-3">Timeline</h2>
                <p className="text-green-100 leading-relaxed">
                  For 17 years, Acredis has built a track record of generating sustainable investment yields and exponential growth for our clients. We are a guaranteed partner for long-term value.
                </p>
              </div>
            </div>
          </div>

          {/* Investment Tips */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Investment Tips</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex gap-4 p-4 bg-blue-50 rounded-lg">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-blue-600 font-bold">💡</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Diversify Your Portfolio</h3>
                  <p className="text-sm text-gray-600">Spread investments across different plans to minimize risk</p>
                </div>
              </div>
              <div className="flex gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-purple-600 font-bold">📊</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Monitor Market Trends</h3>
                  <p className="text-sm text-gray-600">Stay informed with our real-time market data and analysis</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Deposit to Investment</h2>
              <button
                onClick={() => {
                  setShowDepositModal(false);
                  setDepositMethod(null);
                  setDepositAmount('');
                  setCryptoTransactionId('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!depositMethod ? (
              <div className="space-y-4">
                <p className="text-gray-600 mb-4">Choose your deposit method</p>
                
                <button
                  onClick={() => setDepositMethod('bank')}
                  className="w-full p-4 border-2 border-gray-200 hover:border-green-500 rounded-xl transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 group-hover:bg-green-200 rounded-lg flex items-center justify-center">
                      <Wallet className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">Bank Wallet</h3>
                      <p className="text-sm text-gray-600">Transfer from your main wallet</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setDepositMethod('crypto')}
                  className="w-full p-4 border-2 border-gray-200 hover:border-blue-500 rounded-xl transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 group-hover:bg-blue-200 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">Crypto Deposit</h3>
                      <p className="text-sm text-gray-600">Deposit via cryptocurrency</p>
                    </div>
                  </div>
                </button>
              </div>
            ) : depositMethod === 'bank' ? (
              <div>
                <button
                  onClick={() => setDepositMethod(null)}
                  className="mb-4 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    This will transfer funds from your main wallet to your investment balance.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDepositModal(false);
                      setDepositMethod(null);
                      setDepositAmount('');
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
                    disabled={isProcessing}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeposit}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors disabled:bg-gray-400"
                    disabled={isProcessing}
                  >
                    {isProcessing ? 'Processing...' : 'Deposit'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setDepositMethod(null)}
                  className="mb-4 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>

                {cryptoDepositInfo && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-3">Deposit Information</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-600">Token:</span>
                        <span className="ml-2 font-semibold text-gray-900">{cryptoDepositInfo.tokenName}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Network:</span>
                        <span className="ml-2 font-semibold text-gray-900">{cryptoDepositInfo.network}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Wallet Address:</span>
                        <div className="mt-1 p-2 bg-white rounded border border-gray-200 break-all font-mono text-xs">
                          {cryptoDepositInfo.walletAddress}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Amount (USD)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
                      <input
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Transaction ID</label>
                    <input
                      type="text"
                      value={cryptoTransactionId}
                      onChange={(e) => setCryptoTransactionId(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter transaction hash/ID"
                    />
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  Your deposit will be confirmed by admin after verification.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDepositModal(false);
                      setDepositMethod(null);
                      setDepositAmount('');
                      setCryptoTransactionId('');
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
                    disabled={isProcessing}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeposit}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors disabled:bg-gray-400"
                    disabled={isProcessing}
                  >
                    {isProcessing ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Withdraw from Investment</h2>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={stats.investmentBalance}
                />
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Available balance: ${stats.investmentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors disabled:bg-gray-400"
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Detail Modal */}
      {showTransactionModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Transaction Details</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors text-sm"
                >
                  Print
                </button>
                <button
                  onClick={() => setShowTransactionModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="space-y-4" id="transaction-print">
              {/* Status Badge */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <span className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium ${
                    selectedTransaction.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                    selectedTransaction.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {selectedTransaction.status}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Type</p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {selectedTransaction.transactionType.replace('_', ' ')}
                  </p>
                </div>
              </div>

              {/* Amount */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Amount</p>
                <p className={`text-3xl font-bold ${
                  selectedTransaction.transactionType === 'DEPOSIT' ? 'text-green-600' :
                  selectedTransaction.transactionType === 'WITHDRAWAL' ? 'text-blue-600' :
                  'text-purple-600'
                }`}>
                  {selectedTransaction.transactionType === 'DEPOSIT' ? '+' : 
                   selectedTransaction.transactionType === 'WITHDRAWAL' ? '-' : '+'}
                  ${selectedTransaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>

              {/* Transaction Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Reference</p>
                  <p className="font-mono text-sm font-semibold text-gray-900 break-all">
                    {selectedTransaction.reference}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Date</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(selectedTransaction.createdAt).toLocaleString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </p>
                </div>
              </div>

              {/* Balance Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Balance Before</p>
                  <p className="text-lg font-bold text-gray-900">
                    ${selectedTransaction.balanceBefore.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Balance After</p>
                  <p className="text-lg font-bold text-gray-900">
                    ${selectedTransaction.balanceAfter.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Description</p>
                <p className="font-semibold text-gray-900">{selectedTransaction.description}</p>
              </div>

              {/* Metadata */}
              {selectedTransaction.metadata && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Additional Information</p>
                  <div className="space-y-2">
                    {Object.entries(selectedTransaction.metadata).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-sm text-gray-600 capitalize">{key.replace(/_/g, ' ')}:</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowTransactionModal(false)}
                className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Acredis Plus Modal */}
      <AcredisPlusModal
        isOpen={showPlusModal}
        onClose={() => setShowPlusModal(false)}
      />
    </div>
  );
}
