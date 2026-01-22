'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { CheckCircle, XCircle, Eye, Search } from 'lucide-react';

interface InvestmentTransaction {
  id: string;
  userId: string;
  transactionType: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  reference: string;
  status: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
  };
}

export default function InvestmentTransactionsPage() {
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<InvestmentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<InvestmentTransaction | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [transactions, searchTerm, filterStatus, filterType]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/investment-transactions');
      if (response.data.success) {
        setTransactions(response.data.transactions);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...transactions];

    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.user?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.user?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus) {
      filtered = filtered.filter(t => t.status === filterStatus);
    }

    if (filterType) {
      filtered = filtered.filter(t => t.transactionType === filterType);
    }

    setFilteredTransactions(filtered);
  };

  const handleApprove = async (transactionId: string) => {
    try {
      setProcessing(true);
      const response = await axios.post(`/api/admin/investment-transactions/${transactionId}/approve`);
      
      if (response.data.success) {
        toast.success('Transaction approved successfully');
        fetchTransactions();
        setShowModal(false);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to approve transaction');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (transactionId: string) => {
    try {
      setProcessing(true);
      const response = await axios.post(`/api/admin/investment-transactions/${transactionId}/reject`);
      
      if (response.data.success) {
        toast.success('Transaction rejected successfully');
        fetchTransactions();
        setShowModal(false);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reject transaction');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      COMPLETED: 'bg-green-100 text-green-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      FAILED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  const getTypeBadge = (type: string) => {
    const styles = {
      DEPOSIT: 'bg-blue-100 text-blue-800',
      WITHDRAWAL: 'bg-purple-100 text-purple-800',
      INVESTMENT_PURCHASE: 'bg-indigo-100 text-indigo-800',
      INVESTMENT_PROFIT: 'bg-green-100 text-green-800',
      INVESTMENT_RETURN: 'bg-cyan-100 text-cyan-800',
    };
    return styles[type as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Investment Transactions</h1>
        <p className="text-gray-600">Manage all investment wallet transactions</p>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          <option value="DEPOSIT">Deposit</option>
          <option value="WITHDRAWAL">Withdrawal</option>
          <option value="INVESTMENT_PURCHASE">Investment Purchase</option>
          <option value="INVESTMENT_PROFIT">Investment Profit</option>
          <option value="INVESTMENT_RETURN">Investment Return</option>
        </select>

        <div className="text-sm text-gray-600 flex items-center">
          Total: {filteredTransactions.length} transactions
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reference
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
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
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {transaction.reference}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{transaction.user?.name || 'N/A'}</div>
                    <div className="text-sm text-gray-500">{transaction.user?.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getTypeBadge(transaction.transactionType)}`}>
                      {transaction.transactionType.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    ${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(transaction.status)}`}>
                      {transaction.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(transaction.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => {
                        setSelectedTransaction(transaction);
                        setShowModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 mr-3"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    {transaction.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleApprove(transaction.id)}
                          className="text-green-600 hover:text-green-800 mr-3"
                          disabled={processing}
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleReject(transaction.id)}
                          className="text-red-600 hover:text-red-800"
                          disabled={processing}
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTransactions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No transactions found</p>
          </div>
        )}
      </div>

      {/* Transaction Details Modal */}
      {showModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Transaction Details</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Reference</label>
                  <p className="font-semibold font-mono">{selectedTransaction.reference}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Status</label>
                  <p>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(selectedTransaction.status)}`}>
                      {selectedTransaction.status}
                    </span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Type</label>
                  <p className="font-semibold">{selectedTransaction.transactionType.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Amount</label>
                  <p className="font-semibold text-lg">${selectedTransaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Balance Before</label>
                  <p className="font-semibold">${selectedTransaction.balanceBefore.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Balance After</label>
                  <p className="font-semibold">${selectedTransaction.balanceAfter.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-600">Description</label>
                <p className="font-semibold">{selectedTransaction.description}</p>
              </div>

              <div>
                <label className="text-sm text-gray-600">User</label>
                <p className="font-semibold">{selectedTransaction.user?.name || 'N/A'}</p>
                <p className="text-sm text-gray-500">{selectedTransaction.user?.email}</p>
              </div>

              {selectedTransaction.metadata && (
                <div>
                  <label className="text-sm text-gray-600">Additional Information</label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    {selectedTransaction.metadata.method && (
                      <p><span className="font-semibold">Method:</span> {selectedTransaction.metadata.method}</p>
                    )}
                    {selectedTransaction.metadata.transactionId && (
                      <p className="break-all"><span className="font-semibold">Crypto TX ID:</span> {selectedTransaction.metadata.transactionId}</p>
                    )}
                    {selectedTransaction.metadata.sourceAccount && (
                      <p><span className="font-semibold">Source Account:</span> {selectedTransaction.metadata.sourceAccount}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Created At</label>
                  <p className="text-sm">{new Date(selectedTransaction.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Updated At</label>
                  <p className="text-sm">{new Date(selectedTransaction.updatedAt).toLocaleString()}</p>
                </div>
              </div>

              {selectedTransaction.status === 'PENDING' && (
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => handleApprove(selectedTransaction.id)}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-semibold disabled:bg-gray-400"
                    disabled={processing}
                  >
                    {processing ? 'Processing...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleReject(selectedTransaction.id)}
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-semibold disabled:bg-gray-400"
                    disabled={processing}
                  >
                    {processing ? 'Processing...' : 'Reject'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
