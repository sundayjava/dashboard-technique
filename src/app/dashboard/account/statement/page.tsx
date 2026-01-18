'use client';

import { useState, useEffect } from 'react';
import { DashboardLayoutWrapper } from '@/components/layout/DashboardLayoutWrapper';
import { TransactionDetailModal } from '@/components/modals/TransactionDetailModal';
import axios from 'axios';
import { ArrowUpRight, ArrowDownLeft, Download, Printer } from 'lucide-react';

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
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const getUserId = (): string | null => {
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

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  return (
    <DashboardLayoutWrapper>
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
              <Download className="w-5 h-5" />
              Export CSV
            </button>
            <button
              onClick={printStatement}
              disabled={transactions.length === 0}
              className="px-4 py-2 bg-[#c1ff72] text-black font-medium rounded-lg hover:bg-[#b0ef62] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Printer className="w-5 h-5" />
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
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
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
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
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
                          <div className="font-medium">{transaction.description}</div>
                          {transaction.recipientName && (
                            <div className="text-xs text-gray-500">To: {transaction.recipientName}</div>
                          )}
                          {transaction.senderName && (
                            <div className="text-xs text-gray-500">From: {transaction.senderName}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className="font-medium">{transaction.transactionType.replace(/_/g, ' ')}</span>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${getTransactionTypeColor(transaction.transactionType)}`}>
                          {getTransactionTypeSign(transaction.transactionType)}
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleTransactionClick(transaction)}
                            className="text-[#c1ff72] hover:text-[#b0ef62] font-medium"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4 p-4">
                {transactions.map((transaction) => {
                  const isDebit = transaction.transactionType.includes('OUT') || 
                                  transaction.transactionType.includes('WITHDRAWAL') || 
                                  transaction.amount < 0;
                  
                  return (
                    <div
                      key={transaction.id}
                      onClick={() => handleTransactionClick(transaction)}
                      className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${isDebit ? 'bg-red-50' : 'bg-green-50'}`}>
                            {isDebit ? (
                              <ArrowUpRight className={`w-5 h-5 ${isDebit ? 'text-red-600' : 'text-green-600'}`} />
                            ) : (
                              <ArrowDownLeft className="w-5 h-5 text-green-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{transaction.description}</p>
                            <p className="text-xs text-gray-500">{formatDate(transaction.createdAt)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
                            {isDebit ? '-' : '+'}{formatCurrency(Math.abs(transaction.amount), transaction.currency)}
                          </p>
                          {getStatusBadge(transaction.status)}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Type:</span>
                          <span className="text-xs font-medium text-gray-700">
                            {transaction.transactionType.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {(transaction.recipientName || transaction.senderName) && (
                          <div className="text-xs text-gray-500">
                            {transaction.recipientName && `To: ${transaction.recipientName}`}
                            {transaction.senderName && `From: ${transaction.senderName}`}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Transaction Detail Modal */}
        <TransactionDetailModal
          transaction={selectedTransaction}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedTransaction(null);
          }}
        />
      </div>
    </DashboardLayoutWrapper>
  );
}