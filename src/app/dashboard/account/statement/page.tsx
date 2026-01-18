'use client';

import { useState, useEffect } from 'react';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { DashboardTopBar } from '@/components/layout/DashboardTopBar';
import { sidebarItems } from '@/config/sidebar.config';
import axios from 'axios';

interface Transaction {
  id: string;
  transactionType: string;
  amount: number;
  balanceAfter: number;
  currency: string;
  description: string;
  reference: string;
  status: string;
  recipientName?: string;
  recipientAccount?: string;
  senderName?: string;
  senderAccount?: string;
  fee: number;
  createdAt: string;
  account: {
    accountNumber: string;
    accountName: string;
    currency: string;
  };
}

interface Summary {
  totalTransactions: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalFees: number;
}

interface Account {
  id: string;
  accountNumber: string;
  accountName: string;
  currency: string;
  balance: number;
  availableBalance: number;
  status: string;
}

export default function StatementPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchUser();
    fetchAccounts();
  }, []);

  const getUserId = (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userId');
    }
    return null;
  };

  const fetchUser = async () => {
    const userId = getUserId();
    if (!userId) return;

    try {
      const response = await axios.get(`/api/profile?userId=${userId}`);
      setUser(response.data);
    } catch (err: any) {
      console.error('Error fetching user:', err);
    }
  };

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccount) {
      setSelectedAccount(accounts[0].id);
    }
  }, [accounts]);

  useEffect(() => {
    if (selectedAccount) {
      fetchStatement();
    }
  }, [selectedAccount, startDate, endDate, filterType, filterStatus]);

  const fetchAccounts = async () => {
    const userId = getUserId();
    if (!userId) return;

    try {
      const response = await axios.get(`/api/accounts?userId=${userId}`);
      setAccounts(response.data.accounts);
    } catch (err: any) {
      console.error('Error fetching accounts:', err);
      setError(err.response?.data?.error || 'Failed to fetch accounts');
    }
  };

  const exportToCSV = () => {
    if (transactions.length === 0) return;

    const headers = [
      'Date',
      'Description',
      'Reference',
      'Type',
      'Amount',
      'Fee',
      'Balance After',
      'Status',
    ];

    const rows = transactions.map((t) => [
      new Date(t.createdAt).toLocaleString(),
      t.description,
      t.reference,
      t.transactionType.replace(/_/g, ' '),
      `${getTransactionTypeSign(t.transactionType)}${t.amount}`,
      t.fee,
      t.balanceAfter,
      t.status,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `statement_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const printStatement = () => {
    window.print();
  };

  const fetchStatement = async () => {
    const userId = getUserId();
    if (!userId) return;

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        userId,
        ...(selectedAccount && { accountId: selectedAccount }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        ...(filterType && { type: filterType }),
        ...(filterStatus && { status: filterStatus }),
      });

      const response = await axios.get(`/api/statements?${params}`);
      setTransactions(response.data.transactions);
      setSummary(response.data.summary);
    } catch (err: any) {
      console.error('Error fetching statement:', err);
      setError(err.response?.data?.error || 'Failed to fetch statement');
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionTypeColor = (type: string) => {
    if (['DEPOSIT', 'TRANSFER_IN', 'REFUND', 'INTEREST', 'DIVIDEND', 'BONUS'].includes(type)) {
      return 'text-green-600';
    }
    return 'text-red-600';
  };

  const getTransactionTypeSign = (type: string) => {
    if (['DEPOSIT', 'TRANSFER_IN', 'REFUND', 'INTEREST', 'DIVIDEND', 'BONUS'].includes(type)) {
      return '+';
    }
    return '-';
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      COMPLETED: 'bg-green-100 text-green-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      FAILED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
      REVERSED: 'bg-orange-100 text-orange-800',
    };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Sidebar */}
      <DashboardSidebar 
        items={sidebarItems} 
        userId={getUserId() || undefined}
        onCollapseChange={setSidebarCollapsed}
        isMobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Top Bar */}
      <DashboardTopBar 
        user={user}
        sidebarCollapsed={sidebarCollapsed}
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Main Content */}
      <main
        className={`pt-24 pb-8 px-4 md:px-6 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex flex-wrap justify-between items-start gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Account Statement</h1>
              <p className="text-gray-600">View and filter your transaction history</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={exportToCSV}
                disabled={transactions.length === 0}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </button>
              <button
                onClick={printStatement}
                disabled={transactions.length === 0}
                className="px-4 py-2 bg-[#c1ff72] text-black font-medium rounded-lg hover:bg-[#b0ef62] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {/* Account Selection */}
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account
                </label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountName} - {account.accountNumber}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                />
              </div>

              {/* End Date */}
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                />
              </div>

              {/* Transaction Type */}
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                >
                  <option value="">All Types</option>
                  <option value="DEPOSIT">Deposit</option>
                  <option value="WITHDRAWAL">Withdrawal</option>
                  <option value="TRANSFER_IN">Transfer In</option>
                  <option value="TRANSFER_OUT">Transfer Out</option>
                  <option value="PAYMENT">Payment</option>
                  <option value="REFUND">Refund</option>
                </select>
              </div>

              {/* Status */}
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="PENDING">Pending</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900">{summary.totalTransactions}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">Total Deposits</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary.totalDeposits, accounts.find(a => a.id === selectedAccount)?.currency || 'USD')}
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">Total Withdrawals</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(summary.totalWithdrawals, accounts.find(a => a.id === selectedAccount)?.currency || 'USD')}
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">Total Fees</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(summary.totalFees, accounts.find(a => a.id === selectedAccount)?.currency || 'USD')}
                </p>
              </div>
            </div>
          )}

          {/* Transactions Table */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
            </div>
            {loading ? (
              <div className="p-12 text-center">
                <p className="text-gray-500 text-lg">Loading your transaction history...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-12 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500 text-lg font-medium mb-2">No transactions found</p>
                <p className="text-gray-400 text-sm">Try adjusting your filters or select a different account</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reference
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Balance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(transaction.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div>{transaction.description}</div>
                          {transaction.recipientName && (
                            <div className="text-xs text-gray-500">To: {transaction.recipientName}</div>
                          )}
                          {transaction.senderName && (
                            <div className="text-xs text-gray-500">From: {transaction.senderName}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {transaction.reference}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className="font-medium">{transaction.transactionType.replace(/_/g, ' ')}</span>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${getTransactionTypeColor(transaction.transactionType)}`}>
                          {getTransactionTypeSign(transaction.transactionType)}
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {formatCurrency(transaction.balanceAfter, transaction.currency)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {getStatusBadge(transaction.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
