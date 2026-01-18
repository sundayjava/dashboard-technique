'use client';

import { useState, useEffect } from 'react';
import { DashboardLayoutWrapper } from '@/components/layout/DashboardLayoutWrapper';
import { TransactionDetailModal } from '@/components/modals/TransactionDetailModal';
import axios from 'axios';
import { ArrowUpRight, ArrowDownLeft, Download, History, Filter, Calendar } from 'lucide-react';

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
  metadata?: any;
  account: {
    accountNumber: string;
    accountName: string;
    currency: string;
  };
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

export default function TransferHistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccount) {
      setSelectedAccount(accounts[0].id);
    }
  }, [accounts]);

  useEffect(() => {
    if (selectedAccount) {
      fetchTransferHistory();
    }
  }, [selectedAccount, startDate, endDate, filterStatus]);

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

  const fetchAccounts = async () => {
    const userId = getUserId();
    if (!userId) return;

    try {
      const response = await axios.get(`/api/accounts?userId=${userId}`);
      setAccounts(response.data.accounts || []);
    } catch (err: any) {
      console.error('Error fetching accounts:', err);
      setError(err.response?.data?.error || 'Failed to fetch accounts');
    }
  };

  const fetchTransferHistory = async () => {
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
        ...(filterStatus && { status: filterStatus }),
      });

      const response = await axios.get(`/api/statements?${params}`);
      
      // Filter to show only transfer transactions
      const transferTransactions = response.data.transactions.filter((t: Transaction) => 
        t.transactionType === 'TRANSFER_IN' || t.transactionType === 'TRANSFER_OUT'
      );
      
      setTransactions(transferTransactions);
    } catch (err: any) {
      console.error('Error fetching transfer history:', err);
      setError(err.response?.data?.error || 'Failed to fetch transfer history');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(Math.abs(amount));
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'PENDING':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'PROCESSING':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'FAILED':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getStatusBadge = (status: string) => {
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(status)}`}>
        {status}
      </span>
    );
  };

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  const exportToCSV = () => {
    if (transactions.length === 0) return;

    const headers = ['Date', 'Type', 'Description', 'Reference', 'Amount', 'Currency', 'Status', 'Recipient/Sender'];
    const rows = transactions.map(t => [
      formatDate(t.createdAt),
      t.transactionType.replace(/_/g, ' '),
      t.description,
      t.reference,
      t.amount.toString(),
      t.currency,
      t.status,
      t.transactionType === 'TRANSFER_OUT' ? (t.recipientName || '') : (t.senderName || '')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transfer_history_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const totalSent = transactions
    .filter(t => t.transactionType === 'TRANSFER_OUT')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalReceived = transactions
    .filter(t => t.transactionType === 'TRANSFER_IN')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <DashboardLayoutWrapper>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <History className="w-8 h-8 text-gray-900" />
              <h1 className="text-3xl font-bold text-gray-900">Transfer History</h1>
            </div>
            <button
              onClick={exportToCSV}
              disabled={transactions.length === 0}
              className="px-4 py-2 bg-[#c1ff72] text-black font-medium rounded-lg hover:bg-[#b0ef62] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Download className="w-5 h-5" />
              Export CSV
            </button>
          </div>
          <p className="text-gray-600">View all your transfer transactions</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <Calendar className="w-4 h-4 inline mr-1" />
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
                <Calendar className="w-4 h-4 inline mr-1" />
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
              />
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
        {transactions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <p className="text-sm text-gray-600 mb-1">Total Transfers</p>
              <p className="text-2xl font-bold text-gray-900">{transactions.length}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpRight className="w-5 h-5 text-red-600" />
                <p className="text-sm text-gray-600">Total Sent</p>
              </div>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(totalSent, accounts.find(a => a.id === selectedAccount)?.currency || 'USD')}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownLeft className="w-5 h-5 text-green-600" />
                <p className="text-sm text-gray-600">Total Received</p>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(totalReceived, accounts.find(a => a.id === selectedAccount)?.currency || 'USD')}
              </p>
            </div>
          </div>
        )}

        {/* Transfer History */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Transfer Transactions</h2>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 border-4 border-[#c1ff72] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500 text-lg">Loading transfer history...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center">
              <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg font-medium mb-2">No transfers found</p>
              <p className="text-gray-400 text-sm mb-4">Try adjusting your filters or make your first transfer</p>
              <button
                onClick={() => window.location.href = '/dashboard/transfer/acredis-to-acredis'}
                className="px-6 py-2 bg-[#c1ff72] text-black font-medium rounded-lg hover:bg-[#b0ef62] transition-colors"
              >
                Make a Transfer
              </button>
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
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Recipient/Sender
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reference
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
                    {transactions.map((transaction) => {
                      const isOut = transaction.transactionType === 'TRANSFER_OUT';
                      return (
                        <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(transaction.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center gap-2">
                              {isOut ? (
                                <ArrowUpRight className="w-4 h-4 text-red-600" />
                              ) : (
                                <ArrowDownLeft className="w-4 h-4 text-green-600" />
                              )}
                              <span className="font-medium">
                                {isOut ? 'Sent' : 'Received'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="font-medium">
                              {isOut ? transaction.recipientName : transaction.senderName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {isOut ? transaction.recipientAccount : transaction.senderAccount}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                            {transaction.reference}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${isOut ? 'text-red-600' : 'text-green-600'}`}>
                            {isOut ? '-' : '+'}
                            {formatCurrency(transaction.amount, transaction.currency)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {getStatusBadge(transaction.status)}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4 p-4">
                {transactions.map((transaction) => {
                  const isOut = transaction.transactionType === 'TRANSFER_OUT';
                  
                  return (
                    <div
                      key={transaction.id}
                      onClick={() => handleTransactionClick(transaction)}
                      className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${isOut ? 'bg-red-50' : 'bg-green-50'}`}>
                            {isOut ? (
                              <ArrowUpRight className="w-5 h-5 text-red-600" />
                            ) : (
                              <ArrowDownLeft className="w-5 h-5 text-green-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {isOut ? 'Sent to' : 'Received from'}
                            </p>
                            <p className="text-sm text-gray-600">
                              {isOut ? transaction.recipientName : transaction.senderName}
                            </p>
                            <p className="text-xs text-gray-500">{formatDate(transaction.createdAt)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${isOut ? 'text-red-600' : 'text-green-600'}`}>
                            {isOut ? '-' : '+'}{formatCurrency(transaction.amount, transaction.currency)}
                          </p>
                          {getStatusBadge(transaction.status)}
                        </div>
                      </div>
                      
                      <div className="pt-3 border-t border-gray-100">
                        <div className="text-xs text-gray-500">
                          Ref: <span className="font-mono">{transaction.reference}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
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
    </DashboardLayoutWrapper>
  );
}
