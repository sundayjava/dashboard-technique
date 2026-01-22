'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { TransactionFilters } from '@/components/admin/TransactionFilters';
import { getTypeBadge, getStatusBadge, getTypeLabel } from '@/components/admin/TransactionBadges';

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface Account {
  accountNumber: string;
  accountName: string;
  currency: string;
}

interface Transaction {
  id: string;
  transactionType: string;
  userId: string;
  accountId: string;
  amount: number;
  status: string;
  createdAt: string;
  reference?: string;
  description?: string;
  currency?: string;
  user?: User;
  account?: Account;
  
  // Deposit-specific fields
  tokenName?: string;
  network?: string;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  rejectedAt?: string | null;
  referenceNumber?: string;
  submittedAt?: string;
  processedAt?: string | null;
  processedBy?: string | null;
  chequeNumber?: string;
  chequeImage?: string;
  
  // Transfer fields
  recipientAccount?: string;
  recipientName?: string;
  senderAccount?: string;
  senderName?: string;
  
  metadata?: any;
  adminNotes?: string | null;
  balanceAfter?: number;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  
  // Filters
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Form fields for editing
  const [editForm, setEditForm] = useState({
    amount: '',
    status: '',
    adminNotes: '',
    tokenName: '',
    network: '',
    reference: '',
    chequeNumber: '',
  });

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [transactions, filterType, filterStatus, searchTerm]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      // Fetch all transaction types including transfers
      const [cryptoRes, bankRes, chequeRes, transactionsRes] = await Promise.all([
        axios.get('/api/crypto-deposits'),
        axios.get('/api/admin/bank-deposits'),
        axios.get('/api/admin/cheque-deposits'),
        axios.get('/api/admin/transactions'),
      ]);

      const allTransactions: Transaction[] = [
        ...cryptoRes.data.deposits.map((d: any) => ({
          ...d,
          transactionType: 'CRYPTO_DEPOSIT',
        })),
        ...bankRes.data.deposits.map((d: any) => ({
          ...d,
          transactionType: 'BANK_DEPOSIT',
        })),
        ...chequeRes.data.deposits.map((d: any) => ({
          ...d,
          transactionType: 'CHEQUE_DEPOSIT',
        })),
        ...transactionsRes.data.transactions,
      ];

      // Sort by date descending
      allTransactions.sort((a, b) => 
        new Date(b.createdAt || b.submittedAt || '').getTime() - 
        new Date(a.createdAt || a.submittedAt || '').getTime()
      );

      setTransactions(allTransactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...transactions];
    
    if (filterType) {
      filtered = filtered.filter(t => t.transactionType === filterType);
    }

    if (filterStatus) {
      // Normalize status comparison to handle case sensitivity
      filtered = filtered.filter(t => {
        if (!t.status) return false; // Exclude transactions without status
        const transactionStatus = t.status.toUpperCase();
        const selectedStatus = filterStatus.toUpperCase();
        return transactionStatus === selectedStatus;
      });
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        t.reference?.toLowerCase().includes(term) ||
        t.user?.email?.toLowerCase().includes(term) ||
        t.user?.name?.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term) ||
        t.id.toLowerCase().includes(term)
      );
    }

    setFilteredTransactions(filtered);
  };

  const openEditModal = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setEditForm({
      amount: transaction.amount.toString(),
      status: transaction.status,
      adminNotes: (transaction.metadata?.adminNotes || transaction.adminNotes || '') as string,
      tokenName: transaction.tokenName || '',
      network: transaction.network || '',
      reference: transaction.reference || '',
      chequeNumber: transaction.metadata?.chequeNumber || transaction.chequeNumber || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTransaction(null);
  };

  const handleUpdate = async () => {
    if (!selectedTransaction) return;

    setUpdating(true);
    try {
      let endpoint = '';
      let payload: any = {
        amount: parseFloat(editForm.amount),
        status: editForm.status,
        adminNotes: editForm.adminNotes,
      };

      const txType = selectedTransaction.transactionType;

      if (txType === 'CRYPTO_DEPOSIT') {
        endpoint = '/api/crypto-deposits';
        payload = {
          ...payload,
          tokenName: editForm.tokenName,
          network: editForm.network,
          transactionId: selectedTransaction.id,
        };
      } else if (txType === 'BANK_DEPOSIT') {
        endpoint = '/api/bank-deposits';
        payload = {
          ...payload,
          reference: editForm.reference,
        };
      } else if (txType === 'CHEQUE_DEPOSIT') {
        endpoint = '/api/cheque-deposits';
        payload = {
          ...payload,
          chequeNumber: editForm.chequeNumber,
        };
      } else {
        // For transfers and other transaction types
        endpoint = '/api/admin/transactions';
      }
      
      await axios.patch(`${endpoint}/${selectedTransaction.id}`, payload);
      
      // Send email notification if transaction is being approved
      if (editForm.status === 'COMPLETED' && selectedTransaction.status !== 'COMPLETED') {
        try {
          await axios.post('/api/notifications/transaction-approved', {
            userEmail: selectedTransaction.user?.email,
            userName: selectedTransaction.user?.name || 'User',
            transactionType: selectedTransaction.transactionType,
            amount: parseFloat(editForm.amount),
            currency: selectedTransaction.currency || 'USD',
            reference: selectedTransaction.reference || selectedTransaction.id,
          });
        } catch (emailError) {
          console.error('Failed to send approval email:', emailError);
          // Don't fail the update if email fails
        }
      }
      
      toast.success('Transaction updated successfully');
      closeModal();
      fetchTransactions();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update transaction');
    } finally {
      setUpdating(false);
    }
  };

  const openDeleteModal = (transaction: Transaction) => {
    setTransactionToDelete(transaction);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setTransactionToDelete(null);
  };

  const handleDelete = async () => {
    if (!transactionToDelete) return;

    try {
      let endpoint = '';
      const txType = transactionToDelete.transactionType;

      if (txType === 'CRYPTO_DEPOSIT') {
        endpoint = '/api/crypto-deposits';
      } else if (txType === 'BANK_DEPOSIT') {
        endpoint = '/api/bank-deposits';
      } else if (txType === 'CHEQUE_DEPOSIT') {
        endpoint = '/api/cheque-deposits';
      } else {
        endpoint = '/api/admin/transactions';
      }
      
      await axios.delete(`${endpoint}/${transactionToDelete.id}`);
      toast.success('Transaction deleted successfully');
      closeDeleteModal();
      fetchTransactions();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete transaction');
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">All Transactions</h1>
            <p className="text-gray-600 mt-1">View and manage all financial transactions</p>
          </div>
          <div className="text-sm text-gray-500">
            Total: {filteredTransactions.length} transactions
          </div>
        </div>
      </div>

      {/* Filters */}
      <TransactionFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterType={filterType}
        setFilterType={setFilterType}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        onClear={() => {
          setFilterType('');
          setFilterStatus('');
          setSearchTerm('');
        }}
      />

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-600">No transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.map((transaction, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getTypeBadge(transaction.transactionType)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{transaction.user?.name || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{transaction.user?.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {transaction.currency || ''} {Math.abs(transaction.amount).toFixed(2)}
                      </div>
                      {transaction.transactionType === 'TRANSFER_OUT' && (
                        <div className="text-xs text-gray-500">To: {transaction.recipientName}</div>
                      )}
                      {transaction.transactionType === 'TRANSFER_IN' && (
                        <div className="text-xs text-gray-500">From: {transaction.senderName}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-mono text-gray-600">
                        {transaction.reference && transaction.reference.length > 20
                          ? `${transaction.reference.slice(0, 20)}...`
                          : transaction.reference || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(transaction.createdAt || transaction.submittedAt || '').toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(transaction.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openEditModal(transaction)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        View
                      </button>
                      <button
                        onClick={() => openDeleteModal(transaction)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isModalOpen && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Edit Transaction</h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Transaction Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Type:</span>
                      <span className="ml-2 font-medium">{getTypeLabel(selectedTransaction.transactionType)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">ID:</span>
                      <span className="ml-2 font-mono text-xs">{selectedTransaction.id}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">User:</span>
                      <span className="ml-2 font-medium">{selectedTransaction.user?.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <span className="ml-2">{selectedTransaction.user?.email}</span>
                    </div>
                    {selectedTransaction.description && (
                      <div className="col-span-2">
                        <span className="text-gray-500">Description:</span>
                        <span className="ml-2">{selectedTransaction.description}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.amount}
                    onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="PROCESSING">Processing</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="FAILED">Failed</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="REVERSED">Reversed</option>
                  </select>
                </div>

                {/* Crypto Deposit Fields */}
                {selectedTransaction.transactionType === 'CRYPTO_DEPOSIT' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Token Name</label>
                      <input
                        type="text"
                        value={editForm.tokenName}
                        onChange={(e) => setEditForm({ ...editForm, tokenName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Network</label>
                      <input
                        type="text"
                        value={editForm.network}
                        onChange={(e) => setEditForm({ ...editForm, network: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </>
                )}

                {/* Bank Deposit Fields */}
                {selectedTransaction.transactionType === 'BANK_DEPOSIT' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                    <input
                      type="text"
                      value={editForm.reference}
                      onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}

                {/* Cheque Deposit Fields */}
                {selectedTransaction.transactionType === 'CHEQUE_DEPOSIT' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Number</label>
                      <input
                        type="text"
                        value={editForm.chequeNumber}
                        onChange={(e) => setEditForm({ ...editForm, chequeNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    {selectedTransaction.chequeImage && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Image</label>
                        <div className="border border-gray-300 rounded-lg p-2 bg-gray-50">
                          <img
                            src={selectedTransaction.chequeImage}
                            alt="Cheque"
                            className="w-full rounded max-h-96 object-contain"
                            onError={(e) => {
                              console.error('Failed to load cheque image:', selectedTransaction.chequeImage);
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                parent.innerHTML = '<div class="w-full h-48 flex items-center justify-center bg-gray-100 rounded"><p class="text-gray-500">Failed to load cheque image</p></div>';
                              }
                            }}
                          />
                        </div>
                        <a
                          href={selectedTransaction.chequeImage}
                          download
                          className="mt-2 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </a>
                      </div>
                    )}
                  </>
                )}

                {/* Transfer Details */}
                {(selectedTransaction.transactionType === 'TRANSFER_OUT' || selectedTransaction.transactionType === 'TRANSFER_IN') && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">Transfer Details</h4>
                    <div className="space-y-2 text-sm">
                      {selectedTransaction.senderName && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">From:</span>
                          <span className="font-medium">{selectedTransaction.senderName}</span>
                        </div>
                      )}
                      {selectedTransaction.senderAccount && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">From Account:</span>
                          <span className="font-mono text-xs">{selectedTransaction.senderAccount}</span>
                        </div>
                      )}
                      {selectedTransaction.recipientName && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">To:</span>
                          <span className="font-medium">{selectedTransaction.recipientName}</span>
                        </div>
                      )}
                      {selectedTransaction.recipientAccount && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">To Account:</span>
                          <span className="font-mono text-xs">{selectedTransaction.recipientAccount}</span>
                        </div>
                      )}
                      {selectedTransaction.balanceAfter !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Balance After:</span>
                          <span className="font-medium">
                            {selectedTransaction.currency} {selectedTransaction.balanceAfter.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Admin Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes</label>
                  <textarea
                    value={editForm.adminNotes}
                    onChange={(e) => setEditForm({ ...editForm, adminNotes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add notes about this transaction..."
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleUpdate}
                  disabled={updating}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {updating && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  )}
                  {updating ? 'Updating...' : 'Update Transaction'}
                </button>
                <button
                  onClick={closeModal}
                  disabled={updating}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && transactionToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Transaction</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <p className="text-sm text-gray-700">
                Are you sure you want to delete this {getTypeLabel(transactionToDelete.transactionType).toLowerCase()}?
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Amount: {transactionToDelete.currency || ''} {Math.abs(transactionToDelete.amount).toFixed(2)} | Reference: {transactionToDelete.reference || 'N/A'}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={closeDeleteModal}
                className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
