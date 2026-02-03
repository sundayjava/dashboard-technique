'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  canTransfer: boolean;
  accountDisabled: boolean;
  isVerified: boolean;
  requireOTPForInternational: boolean;
  phoneNumber: string;
  authorizationCode: string;
  accounts?: Array<{
    id: string;
    accountNumber: string;
    accountName: string;
    balance: number;
    currency: string;
  }>;
}

interface ManageUserModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ManageUserModal({ user, isOpen, onClose }: ManageUserModalProps) {
  const [activeTab, setActiveTab] = useState<'actions' | 'transaction'>('actions');
  const [loading, setLoading] = useState(false);

  // Transaction form state
  const [transactionDate, setTransactionDate] = useState('');
  const [amount, setAmount] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderAccount, setSenderAccount] = useState('');
  const [senderBank, setSenderBank] = useState('');
  const [transactionType, setTransactionType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [description, setDescription] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Set default transaction date to today
      setTransactionDate(new Date().toISOString().split('T')[0]);
      // Set default account if available
      if (user?.accounts && user.accounts.length > 0) {
        setSelectedAccountId(user.accounts[0].id);
      }
    } else {
      document.body.style.overflow = 'unset';
      // Reset form
      resetTransactionForm();
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, user]);

  const resetTransactionForm = () => {
    setTransactionDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setSenderName('');
    setSenderAccount('');
    setSenderBank('');
    setTransactionType('CREDIT');
    setDescription('');
  };

  if (!isOpen || !user) return null;

  const handleToggleTransfer = async () => {
    try {
      setLoading(true);
      // If enabling direct transfer, disable OTP transfer
      const updates: any = {
        userId: user.id,
        canTransfer: !user.canTransfer,
      };
      
      if (!user.canTransfer) {
        // Enabling direct transfer, so disable OTP
        updates.requireOTPForInternational = false;
      }
      
      await axios.patch('/api/admin/users/permissions', updates);
      toast.success(`Direct transfer ${!user.canTransfer ? 'enabled' : 'disabled'} successfully`);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update transfer permission');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVerification = async () => {
    try {
      setLoading(true);
      await axios.patch('/api/admin/users/permissions', {
        userId: user.id,
        isVerified: !user.isVerified,
      });
      toast.success(`User ${!user.isVerified ? 'verified' : 'unverified'} successfully`);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update verification status');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAccount = async () => {
    try {
      setLoading(true);
      await axios.patch('/api/admin/users/permissions', {
        userId: user.id,
        accountDisabled: !user.accountDisabled,
      });
      toast.success(`Account ${!user.accountDisabled ? 'disabled' : 'enabled'} successfully`);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update account status');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOTPTransfer = async () => {
    try {
      setLoading(true);
      // If enabling OTP transfer, disable direct transfer
      const updates: any = {
        userId: user.id,
        requireOTPForInternational: !user.requireOTPForInternational,
      };
      
      if (!user.requireOTPForInternational) {
        // Enabling OTP transfer, so disable direct transfer
        updates.canTransfer = false;
      }
      
      await axios.patch('/api/admin/users/permissions', updates);
      toast.success(`Code transfer ${!user.requireOTPForInternational ? 'enabled' : 'disabled'} successfully`);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update OTP transfer');
    } finally {
      setLoading(false);
    }
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAccountId) {
      toast.error('Please select an account');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      setLoading(true);
      await axios.post('/api/admin/users/transaction', {
        userId: user.id,
        accountId: selectedAccountId,
        amount: parseFloat(amount),
        transactionType,
        senderName,
        senderAccount,
        senderBank,
        description,
        transactionDate,
      });
      toast.success(`${transactionType === 'CREDIT' ? 'Credit' : 'Debit'} transaction completed successfully`);
      resetTransactionForm();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to process transaction');
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = user.accounts?.find(acc => acc.id === selectedAccountId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        ></div>

        {/* Modal panel */}
        <div className="relative inline-block w-full max-w-3xl overflow-hidden text-left align-middle transition-all transform bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                Manage User: {user.name || user.email}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Auth Code: {user.authorizationCode}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('actions')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'actions'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                User Actions
              </button>
              <button
                onClick={() => setActiveTab('transaction')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'transaction'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Add/Debit Funds
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6 max-h-[calc(100vh-300px)] overflow-y-auto">
            {activeTab === 'actions' && (
              <div className="space-y-4">
                {/* User Status Overview */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Current Status</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-gray-600">Account Status:</span>
                      <p className={`text-sm font-medium ${user.accountDisabled ? 'text-red-600' : 'text-green-600'}`}>
                        {user.accountDisabled ? 'Disabled' : 'Active'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600">Verification:</span>
                      <p className={`text-sm font-medium ${user.isVerified ? 'text-blue-600' : 'text-gray-600'}`}>
                        {user.isVerified ? 'Verified' : 'Unverified'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600">Direct Transfer:</span>
                      <p className={`text-sm font-medium ${user.canTransfer ? 'text-green-600' : 'text-red-600'}`}>
                        {user.canTransfer ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600">Code Transfer (OTP):</span>
                      <p className={`text-sm font-medium ${user.requireOTPForInternational ? 'text-green-600' : 'text-red-600'}`}>
                        {user.requireOTPForInternational ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={handleToggleTransfer}
                    disabled={loading}
                    className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
                      user.canTransfer
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    } disabled:opacity-50`}
                  >
                    {user.canTransfer ? 'Disable Direct Transfer' : 'Enable Direct Transfer'}
                  </button>

                  <button
                    onClick={handleToggleOTPTransfer}
                    disabled={loading}
                    className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
                      user.requireOTPForInternational
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    } disabled:opacity-50`}
                  >
                    {user.requireOTPForInternational ? 'Disable Code Transfer (OTP Required)' : 'Enable Code Transfer (OTP Required)'}
                  </button>

                  <button
                    onClick={handleToggleVerification}
                    disabled={loading}
                    className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
                      user.isVerified
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    } disabled:opacity-50`}
                  >
                    {user.isVerified ? 'Unverify Account' : 'Verify Account'}
                  </button>

                  <button
                    onClick={handleToggleAccount}
                    disabled={loading}
                    className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
                      user.accountDisabled
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    } disabled:opacity-50`}
                  >
                    {user.accountDisabled ? 'Enable Account' : 'Disable Account'}
                  </button>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Direct Transfer and Code Transfer (OTP) are mutually exclusive. When Code Transfer is enabled, user must receive and enter an OTP code via email before completing any transfer. All changes take effect immediately.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'transaction' && (
              <form onSubmit={handleTransaction} className="space-y-4">
                {/* Account Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Account <span className="text-red-500">*</span>
                  </label>
                  {user.accounts && user.accounts.length > 0 ? (
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      {user.accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.accountName} - {account.accountNumber} ({account.currency} {account.balance.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-red-600">No accounts available for this user</p>
                  )}
                </div>

                {selectedAccount && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">
                      Current Balance: <span className="font-semibold text-gray-900">
                        {selectedAccount.currency} {selectedAccount.balance.toFixed(2)}
                      </span>
                    </p>
                  </div>
                )}

                {/* Transaction Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transaction Type <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setTransactionType('CREDIT')}
                      className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                        transactionType === 'CREDIT'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Credit (Add Money)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransactionType('DEBIT')}
                      className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                        transactionType === 'DEBIT'
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Debit (Remove Money)
                    </button>
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transaction Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Sender Details - Only show for CREDIT transactions */}
                {transactionType === 'CREDIT' && (
                  <>
                    {/* Sender's Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sender's Name
                      </label>
                      <input
                        type="text"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        placeholder="Enter sender's name"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* Sender's Account Number */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sender's Account Number
                      </label>
                      <input
                        type="text"
                        value={senderAccount}
                        onChange={(e) => setSenderAccount(e.target.value)}
                        placeholder="Enter sender's account number"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* Sender's Bank */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sender's Bank
                      </label>
                      <input
                        type="text"
                        value={senderBank}
                        onChange={(e) => setSenderBank(e.target.value)}
                        placeholder="Enter sender's bank"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </>
                )}

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {transactionType === 'CREDIT' ? 'Transfer Description' : 'Debit Reason'} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={transactionType === 'CREDIT' ? 'Enter transaction description' : 'Enter reason for debiting account'}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !selectedAccountId}
                  className={`w-full px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
                    transactionType === 'CREDIT'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading ? 'Processing...' : `${transactionType === 'CREDIT' ? 'Add' : 'Debit'} Funds`}
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
