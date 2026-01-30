'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayoutWrapper } from '@/components/layout/DashboardLayoutWrapper';
import MiniLineChart from '@/components/MiniLineChart';
import CardDisplay from '@/components/sections/CardDisplay';
import AcredisPlusModal from '@/components/modals/AcredisPlusModal';
import HoldingsModal from '@/components/modals/HoldingsModal';
import axios from 'axios';
import { 
  TrendingUp, Send, CreditCard, 
  ArrowUpRight, ArrowDownRight, DollarSign, Wallet,
  BarChart3, Activity, Calendar,
  ArrowRight, Copy, Check, MoreVertical
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  authorizationCode: string;
  isPlusUser?: boolean;
}

interface CryptoToken {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  icon: string;
  priceHistory: Array<{ time: string; price: number }>;
}

interface EconomicEvent {
  id: number;
  date: string;
  time: string;
  country: string;
  event: string;
  impact: string;
  forecast: string;
  previous: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  createdAt: string;
  description?: string;
  currency?: string;
  reference?: string;
  recipientName?: string;
  senderName?: string;
  balanceAfter?: number;
}

interface Investment {
  id: string;
  planName: string;
  amount: number;
  status: string;
  startDate: string;
  endDate: string;
  profitEarned: number;
}

interface Message {
  id: string;
  subject: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  senderId: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [cryptoData, setCryptoData] = useState<CryptoToken[]>([]);
  const [economicEvents, setEconomicEvents] = useState<EconomicEvent[]>([]);
  const [accountBalance, setAccountBalance] = useState(0);
  const [accountCurrency, setAccountCurrency] = useState('USD');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [totalInvestments, setTotalInvestments] = useState(0);
  const [totalInflow, setTotalInflow] = useState(0);
  const [totalOutflow, setTotalOutflow] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeInvestments, setActiveInvestments] = useState<Investment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cryptoUpdating, setCryptoUpdating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTradeKeyModal, setShowTradeKeyModal] = useState(false);
  const [tradeKey, setTradeKey] = useState('');
  const [validatingKey, setValidatingKey] = useState(false);
  const [showPlusModal, setShowPlusModal] = useState(false);
  const [showHoldingsModal, setShowHoldingsModal] = useState(false);
  const [showHighYieldModal, setShowHighYieldModal] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getCurrencySymbol = (currency: string): string => {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      NGN: '₦',
      ZAR: 'R',
      KES: 'KSh',
      GHS: 'GH₵',
      CAD: 'CA$',
      AUD: 'A$',
      JPY: '¥',
      CNY: '¥',
      INR: '₹',
    };
    return symbols[currency] || currency;
  };

  const fetchDashboardData = async (userId: string) => {
    try {
      const [accountRes, investmentsRes, transactionsRes, transactionStatsRes, investmentsListRes, messagesRes] = await Promise.all([
        axios.get(`/api/accounts?userId=${userId}`),
        axios.get(`/api/investments/stats?userId=${userId}`),
        axios.get(`/api/transactions?userId=${userId}&limit=5`).catch(() => ({ data: { transactions: [] } })),
        axios.get(`/api/transactions/stats?userId=${userId}`).catch(() => ({ data: { totalInflow: 0, totalOutflow: 0 } })),
        axios.get(`/api/investments?userId=${userId}&status=ACTIVE`).catch(() => ({ data: { investments: [] } })),
        axios.get(`/api/messages?userId=${userId}`).catch(() => ({ data: { messages: [] } }))
      ]);

      if (accountRes.data.accounts?.length > 0) {
        setAccountBalance(accountRes.data.accounts[0].balance);
        setAccountCurrency(accountRes.data.accounts[0].currency || 'USD');
        setAccountNumber(accountRes.data.accounts[0].accountNumber || '');
      }

      if (investmentsRes.data) {
        setTotalInvestments(investmentsRes.data.totalInvested || 0);
      }

      if (transactionsRes.data.transactions) {
        setTransactions(transactionsRes.data.transactions.slice(0, 4));
      }

      // Set inflow and outflow from dedicated stats endpoint
      if (transactionStatsRes.data) {
        setTotalInflow(transactionStatsRes.data.totalInflow || 0);
        setTotalOutflow(transactionStatsRes.data.totalOutflow || 0);
      }

      if (investmentsListRes.data.investments) {
        setActiveInvestments(investmentsListRes.data.investments.slice(0, 3));
      }

      if (messagesRes.data.messages) {
        setMessages(messagesRes.data.messages.slice(0, 3));
        const unread = messagesRes.data.messages.filter((m: Message) => !m.isRead).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      
      if (parsedUser.role === 'ADMIN') {
        router.push('/admin/dashboard');
        return;
      }

      fetchDashboardData(parsedUser.id);
    }
  }, [router]);

  useEffect(() => {
    // Fetch crypto prices every 10 seconds
    const interval = setInterval(() => {
      fetchCryptoData();
    }, 10000);

    fetchCryptoData();
    fetchEconomicCalendar();

    return () => clearInterval(interval);
  }, []);

  const fetchCryptoData = async () => {
    try {
      setCryptoUpdating(true);
      const response = await axios.get('/api/crypto/prices');
      if (response.data.success) {
        setCryptoData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching crypto data:', error);
    } finally {
      setTimeout(() => setCryptoUpdating(false), 500);
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

  const handleViewInvestments = () => {
    setShowTradeKeyModal(true);
  };

  const handleValidateTradeKey = async () => {
    if (!tradeKey.trim()) {
      alert('Please enter a trade key');
      return;
    }

    if (!user) return;

    setValidatingKey(true);
    try {
      const response = await axios.post('/api/trade-key/validate', {
        userId: user.id,
        tradeKey: tradeKey.trim()
      });

      if (response.data.message) {
        setShowTradeKeyModal(false);
        setTradeKey('');
        router.push('/investment/plans');
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Invalid trade key');
    } finally {
      setValidatingKey(false);
    }
  };

  const quickActions = [
    { icon: Send, label: 'Transfer', color: 'blue', href: '/dashboard/transfer/acredis-to-acredis' },
    { icon: CreditCard, label: 'Deposit', color: 'green', href: '/dashboard/monetary/digital-deposit' },
    { icon: BarChart3, label: 'Invest', color: 'purple', href: '/dashboard/investment' },
    { icon: ArrowDownRight, label: 'Withdraw', color: 'orange', href: '/dashboard/monetary/cards' },
  ];

  return (
    <DashboardLayoutWrapper>
      <div className="space-y-4">
        {/* Welcome Section */}
        <div className="bg-linear-to-r from-gray-900 via-gray-800 to-black rounded-lg p-3 text-white">
          <h1 className="text-lg font-bold mb-0.5">
            Welcome back{user?.name ? `, ${user.name}` : ''}! 👋
          </h1>
          <p className="text-xs text-gray-300">Here's what's happening with your finances today</p>
        </div>


        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg shadow p-3 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Wallet className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-600 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +2.5%
                </span>
                <button
                  onClick={() => setShowHoldingsModal(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="View Crypto Holdings"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Holdings</span>
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-600 mb-1">Total Balance</p>
            <p className="text-lg font-bold text-gray-900">
              {getCurrencySymbol(accountCurrency)}{accountBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            {accountNumber && (
              <div className="flex items-center gap-2 mt-1.5">
                <p className="text-xs text-gray-500 font-mono flex-1">
                  Acc: {accountNumber}
                </p>
                <button
                  onClick={() => copyToClipboard(accountNumber)}
                  className="p-1 hover:bg-blue-50 rounded transition-colors"
                  title="Copy account number"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-green-600" />
                  ) : (
                    <Copy className="w-3 h-3 text-blue-600" />
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-3 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-xs text-green-600 flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                Inflow
              </span>
            </div>
            <p className="text-xs text-gray-600 mb-1">Total Money In</p>
            <p className="text-lg font-bold text-gray-900">
              {getCurrencySymbol(accountCurrency)}{totalInflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-3 border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-red-600" />
              </div>
              <span className="text-xs text-red-600 flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                Outflow
              </span>
            </div>
            <p className="text-xs text-gray-600 mb-1">Total Money Out</p>
            <p className="text-lg font-bold text-gray-900">
              {getCurrencySymbol(accountCurrency)}{totalOutflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-orange-600" />
              </div>
              <span className="text-xs text-green-600 flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                +8.5%
              </span>
            </div>
            <p className="text-xs text-gray-600 mb-1">Total Assets</p>
            <p className="text-lg font-bold text-gray-900">
              {getCurrencySymbol(accountCurrency)}{(accountBalance + totalInvestments).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-3">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={index}
                  onClick={() => router.push(action.href)}
                  className={`p-2 rounded-lg border-2 hover:shadow transition-all duration-200 group ${
                    action.color === 'blue' ? 'border-blue-200 hover:border-blue-500 hover:bg-blue-50' :
                    action.color === 'green' ? 'border-green-200 hover:border-green-500 hover:bg-green-50' :
                    action.color === 'purple' ? 'border-purple-200 hover:border-purple-500 hover:bg-purple-50' :
                    'border-orange-200 hover:border-orange-500 hover:bg-orange-50'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-0.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      action.color === 'blue' ? 'bg-blue-100' :
                      action.color === 'green' ? 'bg-green-100' :
                      action.color === 'purple' ? 'bg-purple-100' :
                      'bg-orange-100'
                    } group-hover:scale-110 transition-transform`}>
                      <Icon className={`w-4 h-4 ${
                        action.color === 'blue' ? 'text-blue-600' :
                        action.color === 'green' ? 'text-green-600' :
                        action.color === 'purple' ? 'text-purple-600' :
                        'text-orange-600'
                      }`} />
                    </div>
                    <span className="text-xs font-semibold text-gray-900">{action.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>


        {/* High Yield Investment Promo Banner */}
        <div className="bg-gray-800 rounded-lg px-6 pt-6 pb-1 text-white shadow-lg">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl md:text-3xl font-bold mb-2">
                Building your capital has never been this easy (or smart)
              </h2>
              <p className="text-base md:text-lg text-white/80">  
                Say hello to top-tier rates, no fees.
              </p>
            </div>
            <button
              onClick={() => setShowHighYieldModal(true)}
              className="flex items-center gap-2 px-6 py-3 text-gray-800 bg-[#c1ff72] font-bold rounded-lg hover:bg-blue-50 transition-all duration-200 shadow-md hover:shadow-xl transform hover:scale-105 whitespace-nowrap"
            >
              <TrendingUp className="w-5 h-5" />
              Explore High Yield Investment
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Grid - 3 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Card Display */}
          {user && <CardDisplay userId={user.id} />}

          {/* Transaction History */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">Recent Transactions</h2>
              <Activity className="w-4 h-4 text-gray-500" />
            </div>

            <div className="space-y-2">
              {transactions.length > 0 ? (
                <>
                  {transactions.map((transaction) => {
                    const isCredit = transaction.type === 'DEPOSIT' || 
                                   transaction.type === 'TRANSFER_IN' || 
                                   transaction.type === 'REFUND' ||
                                   transaction.type === 'INTEREST' ||
                                   transaction.type === 'BONUS';
                    const isDebit = transaction.type === 'WITHDRAWAL' || 
                                  transaction.type === 'TRANSFER_OUT' || 
                                  transaction.type === 'PAYMENT' ||
                                  transaction.type === 'FEE';
                    
                    const getTypeLabel = (type: string) => {
                      const labels: Record<string, string> = {
                        'DEPOSIT': 'Deposit',
                        'WITHDRAWAL': 'Withdrawal',
                        'TRANSFER_IN': 'Transfer In',
                        'TRANSFER_OUT': 'Transfer Out',
                        'PAYMENT': 'Payment',
                        'REFUND': 'Refund',
                        'FEE': 'Fee',
                        'INTEREST': 'Interest',
                        'BONUS': 'Bonus',
                      };
                      return labels[type] || type.replace('_', ' ');
                    };

                    return (
                      <div key={transaction.id} className="flex items-start justify-between p-2 rounded bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex items-start gap-2 flex-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isCredit ? 'bg-green-100' : isDebit ? 'bg-red-100' : 'bg-blue-100'
                          }`}>
                            {isCredit ? (
                              <ArrowDownRight className={`w-4 h-4 ${isCredit ? 'text-green-600' : 'text-blue-600'}`} />
                            ) : isDebit ? (
                              <ArrowUpRight className="w-4 h-4 text-red-600" />
                            ) : (
                              <Activity className="w-4 h-4 text-blue-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900">{getTypeLabel(transaction.type)}</p>
                            {/* {transaction.description && (
                              <p className="text-xs text-gray-500 truncate line-clamp-1">{transaction.description}</p>
                            )} */}
                            {transaction.recipientName && transaction.type === 'TRANSFER_OUT' && (
                              <p className="text-xs text-gray-500">To: {transaction.recipientName}</p>
                            )}
                            {transaction.senderName && transaction.type === 'TRANSFER_IN' && (
                              <p className="text-xs text-gray-500">From: {transaction.senderName}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">
                              {new Date(transaction.createdAt).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <p className={`text-sm font-bold ${
                            isCredit ? 'text-green-600' : isDebit ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            {isCredit ? '+' : isDebit ? '-' : ''}{getCurrencySymbol(transaction.currency || accountCurrency)}{transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <span className={`text-xs px-1.5 py-0.5 rounded inline-block mt-1 ${
                            transaction.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            transaction.status === 'PENDING' || transaction.status === 'PROCESSING' ? 'bg-yellow-100 text-yellow-700' :
                            transaction.status === 'FAILED' || transaction.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {transaction.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <button 
                    onClick={() => router.push('/dashboard/transfer/history')}
                    className="w-full py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors flex items-center justify-center"
                  >
                    View All Transactions <ArrowRight className="w-3 h-3 ml-1" />
                  </button>
                </>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Activity className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-xs">No transactions yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Inflow vs Outflow Doughnut Chart */}
          <div className="bg-white rounded-lg shadow p-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-900">Money Flow</h2>
              <Activity className="w-4 h-4 text-gray-500" />
            </div>

            <div className="flex flex-col items-center">
              {totalInflow > 0 || totalOutflow > 0 ? (
                <>
                  {/* Doughnut Chart */}
                  <div className="relative w-40 h-40 mb-3">
                    <svg viewBox="0 0 100 100" className="transform -rotate-90">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#f3f4f6"
                        strokeWidth="12"
                      />
                      {(() => {
                        const total = totalInflow + totalOutflow;
                        const inflowPercent = (totalInflow / total) * 100;
                        const outflowPercent = (totalOutflow / total) * 100;
                        const circumference = 2 * Math.PI * 40;
                        const inflowLength = (inflowPercent / 100) * circumference;
                        const outflowLength = (outflowPercent / 100) * circumference;

                        return (
                          <>
                            {/* Inflow arc */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="12"
                              strokeDasharray={`${inflowLength} ${circumference}`}
                              strokeLinecap="round"
                            />
                            {/* Outflow arc */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke="#ef4444"
                              strokeWidth="12"
                              strokeDasharray={`${outflowLength} ${circumference}`}
                              strokeDashoffset={-inflowLength}
                              strokeLinecap="round"
                            />
                          </>
                        );
                      })()}
                    </svg>
                    
                    {/* Center text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-xs text-gray-500">Total Flow</p>
                      <p className="text-lg font-bold text-gray-900">
                        {getCurrencySymbol(accountCurrency)}{(totalInflow + totalOutflow).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="w-full space-y-2">
                    <div className="flex items-center justify-between p-2 rounded bg-green-50 border border-green-200">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-xs font-medium text-gray-700">Inflow</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-green-600">
                          {getCurrencySymbol(accountCurrency)}{totalInflow.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {totalInflow + totalOutflow > 0 ? ((totalInflow / (totalInflow + totalOutflow)) * 100).toFixed(1) : 0}%
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded bg-red-50 border border-red-200">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-xs font-medium text-gray-700">Outflow</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-red-600">
                          {getCurrencySymbol(accountCurrency)}{totalOutflow.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {totalInflow + totalOutflow > 0 ? ((totalOutflow / (totalInflow + totalOutflow)) * 100).toFixed(1) : 0}%
                        </p>
                      </div>
                    </div>

                    {/* Net Flow */}
                    <div className={`flex items-center justify-between p-2 rounded border ${
                      totalInflow >= totalOutflow 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'bg-orange-50 border-orange-200'
                    }`}>
                      <span className="text-xs font-medium text-gray-700">Net Flow</span>
                      <p className={`text-xs font-bold ${
                        totalInflow >= totalOutflow ? 'text-blue-600' : 'text-orange-600'
                      }`}>
                        {totalInflow >= totalOutflow ? '+' : '-'}
                        {getCurrencySymbol(accountCurrency)}{Math.abs(totalInflow - totalOutflow).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Activity className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-xs">No transaction data yet</p>
                  <button 
                    onClick={() => router.push('/dashboard/transfer/acredis-to-acredis')}
                    className="mt-2 text-xs text-blue-600 hover:underline"
                  >
                    Make a Transaction →
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Horizontal Layout: Crypto + Economic Calendar + Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          {/* Live Crypto Markets - Compact 3x3 Grid */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">Live Crypto</h2>
              <div className="flex items-center text-xs text-gray-500">
                <div className={`w-1.5 h-1.5 rounded-full mr-1 ${cryptoUpdating ? 'bg-blue-500 animate-pulse' : 'bg-green-500 animate-pulse'}`}></div>
                {cryptoUpdating ? 'Updating...' : 'Real-time'}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {loading ? (
                // Loading skeleton
                Array.from({ length: 9 }).map((_, index) => (
                  <div
                    key={index}
                    className="p-2.5 bg-gray-100 border border-gray-200 animate-pulse"
                  >
                    <div className="h-4 bg-gray-300 rounded mb-2 w-16"></div>
                    <div className="h-5 bg-gray-300 rounded mb-2 w-16"></div>
                    <div className="h-8 bg-gray-300 rounded"></div>
                  </div>
                ))
              ) : (
                cryptoData.slice(0, 9).map((crypto, index) => (
                  <div
                    key={index}
                    className={`p-1.5 bg-gray-50 border border-gray-200 hover:border-blue-500 transition-all duration-300 cursor-pointer ${
                      cryptoUpdating ? 'scale-95 opacity-80' : 'scale-100 opacity-100'
                    }`}
                  >
                    {/* Pair Name */}
                    <div className="font-medium text-[10px] mb-0.5 text-gray-900">
                      {crypto.symbol}
                    </div>

                    {/* Price and Change */}
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-xs font-bold text-gray-900 transition-all duration-300">
                        ${crypto.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                      <span
                        className={`text-[9px] font-medium flex items-center gap-0.5 transition-all duration-300 ${
                          crypto.change24h >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        <span>{crypto.change24h >= 0 ? '↑' : '↓'}</span>
                        {Math.abs(crypto.change24h).toFixed(1)}%
                      </span>
                    </div>

                    {/* Mini Line Chart */}
                    <div className="h-6">
                      <MiniLineChart
                        data={crypto.priceHistory.map(item => item.price)}
                        trend={crypto.change24h >= 0 ? 'up' : 'down'}
                        height={24}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Economic Calendar */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-gray-900">Economic Calendar</h2>
              </div>
              <span className="text-xs text-gray-500">{economicEvents.length} Events</span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-62.5 pr-1 custom-scrollbar-light">
              {economicEvents.slice(0, 10).map((event) => (
                <div 
                  key={event.id} 
                  className="group p-2 rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer bg-gray-50/50 hover:bg-blue-50/50"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200">
                        {event.country}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        event.impact === 'high' 
                          ? 'bg-red-100 text-red-700' :
                        event.impact === 'medium' 
                          ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                      }`}>
                        {event.impact}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500">
                      {event.date === new Date().toISOString().split('T')[0] 
                        ? 'Today' 
                        : event.date === new Date(Date.now() + 86400000).toISOString().split('T')[0]
                        ? 'Tomorrow'
                        : new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      }
                    </span>
                  </div>
                  
                  <h3 className="text-xs font-semibold text-gray-900 mb-1 line-clamp-1 group-hover:text-blue-700 transition-colors">
                    {event.event}
                  </h3>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">
                      {event.time}
                    </span>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-gray-500">F: <span className="font-semibold text-gray-700">{event.forecast}</span></span>
                      <span className="text-gray-400">P: <span className="font-medium text-gray-500">{event.previous}</span></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Crypto Values Chart */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
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
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: color }}
                    ></div>
                    <span className="text-[9px] font-semibold text-gray-700">{crypto.symbol}</span>
                    <span className={`text-[8px] font-medium ${
                      crypto.change24h >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {crypto.change24h >= 0 ? '+' : ''}{crypto.change24h.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Combined Timeline Chart */}
            <div className="w-full" style={{ height: '100px' }}>
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="w-full"
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
                      <linearGradient key={index} id={`gradient-combined-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
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

                  // Normalize this crypto's prices
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
                        fill={`url(#gradient-combined-${index})`}
                        className="transition-all duration-700"
                      />

                      {/* Line */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={color}
                        strokeWidth="1.5"
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
              <span className="text-[10px] text-gray-500 font-medium">24h ago</span>
              <span className="text-[10px] text-gray-500 font-medium">Now</span>
            </div>

            {/* Stats Summary */}
            {cryptoData.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-200">
                <div className="text-center">
                  <div className="text-[10px] text-gray-500">Highest</div>
                  <div className="text-xs font-bold text-green-600">
                    {cryptoData.slice(0, 9).reduce((max, c) => c.change24h > max.change24h ? c : max).symbol}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-gray-500">Average</div>
                  <div className="text-xs font-bold text-gray-900">
                    {(cryptoData.slice(0, 9).reduce((sum, c) => sum + c.change24h, 0) / cryptoData.slice(0, 9).length).toFixed(2)}%
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-gray-500">Lowest</div>
                  <div className="text-xs font-bold text-red-600">
                    {cryptoData.slice(0, 9).reduce((min, c) => c.change24h < min.change24h ? c : min).symbol}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trade Key Modal */}
      {showTradeKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Enter Trade Key</h2>
            <p className="text-sm text-gray-600 mb-4">
              Please enter your trade key to access the investment dashboard
            </p>
            
            <input
              type="text"
              value={tradeKey}
              onChange={(e) => setTradeKey(e.target.value)}
              placeholder="Enter your trade key"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
              onKeyDown={(e) => e.key === 'Enter' && handleValidateTradeKey()}
              disabled={validatingKey}
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTradeKeyModal(false);
                  setTradeKey('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={validatingKey}
              >
                Cancel
              </button>
              <button
                onClick={handleValidateTradeKey}
                disabled={validatingKey}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-purple-400"
              >
                {validatingKey ? 'Validating...' : 'Verify'}
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

      {/* Holdings Modal */}
      {user && (
        <HoldingsModal
          isOpen={showHoldingsModal}
          onClose={() => setShowHoldingsModal(false)}
          userId={user.id}
          accountBalance={accountBalance}
          accountCurrency={accountCurrency}
          onSuccess={() => {
            // Refresh dashboard data
            fetchDashboardData(user.id);
          }}
        />
      )}

      {/* High Yield Investment Modal */}
      {showHighYieldModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">High Yield Investment Plans</h2>
              <button
                onClick={() => setShowHighYieldModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* AI & Blockchain Inspired Image */}
            <div className="relative mb-6 rounded-xl overflow-hidden">
              <div className="absolute inset-0 bg-linear-to-br from-blue-600 via-purple-600 to-indigo-600 opacity-10"></div>
              <div className="relative bg-linear-to-br from-blue-50 via-purple-50 to-indigo-50 p-12 flex items-center justify-center">
                {/* Abstract AI/Blockchain Visual */}
                <div className="relative w-full max-w-md">
                  {/* Central Node */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl animate-pulse">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                      <TrendingUp className="w-10 h-10 text-blue-600" />
                    </div>
                  </div>
                  
                  {/* Orbiting Nodes */}
                  <div className="relative w-64 h-64 mx-auto">
                    {[0, 60, 120, 180, 240, 300].map((angle, i) => {
                      const rad = (angle * Math.PI) / 180;
                      const x = Math.cos(rad) * 100 + 128;
                      const y = Math.sin(rad) * 100 + 128;
                      return (
                        <div
                          key={i}
                          className="absolute w-12 h-12 bg-linear-to-br from-indigo-400 to-blue-500 rounded-lg shadow-lg"
                          style={{
                            left: `${x}px`,
                            top: `${y}px`,
                            transform: 'translate(-50%, -50%)',
                            animation: `float ${3 + i * 0.5}s ease-in-out infinite alternate`
                          }}
                        >
                          <div className="w-full h-full flex items-center justify-center text-white font-bold text-xs">
                            {['AI', 'BTC', 'ETH', 'XRP', 'LTC', 'ADA'][i]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Connecting Lines */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                    {[0, 60, 120, 180, 240, 300].map((angle, i) => {
                      const rad = (angle * Math.PI) / 180;
                      const x = Math.cos(rad) * 100;
                      const y = Math.sin(rad) * 100;
                      return (
                        <line
                          key={i}
                          x1="50%"
                          y1="50%"
                          x2={`calc(50% + ${x}px)`}
                          y2={`calc(50% + ${y}px)`}
                          stroke="url(#gradient)"
                          strokeWidth="2"
                          strokeDasharray="5,5"
                          opacity="0.3"
                        />
                      );
                    })}
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#9333ea" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
            </div>

            {/* Content Text */}
            <div className="prose prose-lg max-w-none">
              <p className="text-gray-700 text-lg leading-relaxed text-center">
                <span className="font-semibold text-gray-900">Fully digital and powered by blockchain on a banking level security.</span>
                <br />
                <br />
                Acredis is where innovation meets experience. It's where a seamless digital banking platform combines with crypto and a global banking expertise. It's where top rates, no fees and 24/7 access are made possible by stability and security. This is where smart crypto meets banking.
              </p>
            </div>

            {/* CTA Button */}
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => {
                  setShowHighYieldModal(false);
                  handleViewInvestments();
                }}
                className="px-8 py-4 bg-linear-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-2"
              >
                <TrendingUp className="w-5 h-5" />
                View Investment Plans
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <style jsx>{`
            @keyframes float {
              from {
                transform: translate(-50%, -50%) translateY(0px);
              }
              to {
                transform: translate(-50%, -50%) translateY(-10px);
              }
            }
          `}</style>
        </div>
      )}
    </DashboardLayoutWrapper>
  );
}
