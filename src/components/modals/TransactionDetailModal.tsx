'use client';

import { useEffect } from 'react';
import { X, ArrowUpRight, ArrowDownLeft, Calendar, Hash, User, Building, CreditCard, Info } from 'lucide-react';

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

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TransactionDetailModal({ transaction, isOpen, onClose }: TransactionDetailModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !transaction) return null;

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(Math.abs(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
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

  const isDebit = transaction.transactionType.includes('OUT') || 
                  transaction.transactionType.includes('WITHDRAWAL') || 
                  transaction.amount < 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className={`sticky top-0 z-10 px-6 py-4 border-b ${isDebit ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-full ${isDebit ? 'bg-red-100' : 'bg-green-100'}`}>
                  {isDebit ? (
                    <ArrowUpRight className={`w-6 h-6 ${isDebit ? 'text-red-600' : 'text-green-600'}`} />
                  ) : (
                    <ArrowDownLeft className={`w-6 h-6 text-green-600`} />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {transaction.transactionType.replace(/_/g, ' ')}
                  </h2>
                  <p className={`text-2xl font-bold mt-1 ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
                    {isDebit ? '-' : '+'}{formatCurrency(transaction.amount, transaction.currency)}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/50 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Status */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Status</span>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(transaction.status)}`}>
                {transaction.status}
              </span>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Description</p>
                  <p className="text-base text-gray-900 mt-1">{transaction.description}</p>
                </div>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Transaction Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Reference */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Hash className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-600">Reference</p>
                    <p className="text-sm text-gray-900 font-mono break-all mt-1">{transaction.reference}</p>
                  </div>
                </div>

                {/* Date */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-600">Date & Time</p>
                    <p className="text-sm text-gray-900 mt-1">{formatDate(transaction.createdAt)}</p>
                  </div>
                </div>

                {/* Fee */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <CreditCard className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-600">Transaction Fee</p>
                    <p className="text-sm text-gray-900 mt-1">
                      {formatCurrency(transaction.fee, transaction.currency)}
                    </p>
                  </div>
                </div>

                {/* Balance After */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Building className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-600">Balance After</p>
                    <p className="text-sm text-gray-900 mt-1">
                      {formatCurrency(transaction.balanceAfter, transaction.currency)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Account Information</h3>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <User className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-blue-600">Your Account</p>
                    <p className="text-sm text-gray-900 font-semibold mt-1">{transaction.account.accountName}</p>
                    <p className="text-sm text-gray-600 font-mono">{transaction.account.accountNumber}</p>
                  </div>
                </div>

                {/* Recipient Info */}
                {transaction.recipientName && (
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <User className="w-5 h-5 text-gray-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-600">Recipient</p>
                      <p className="text-sm text-gray-900 font-semibold mt-1">{transaction.recipientName}</p>
                      {transaction.recipientAccount && (
                        <p className="text-sm text-gray-600 font-mono">{transaction.recipientAccount}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Sender Info */}
                {transaction.senderName && (
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <User className="w-5 h-5 text-gray-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-600">Sender</p>
                      <p className="text-sm text-gray-900 font-semibold mt-1">{transaction.senderName}</p>
                      {transaction.senderAccount && (
                        <p className="text-sm text-gray-600 font-mono">{transaction.senderAccount}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Currency Conversion Info */}
            {transaction.metadata?.exchangeRate && transaction.metadata?.exchangeRate !== 1 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Currency Conversion</h3>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Exchange Rate</span>
                    <span className="text-sm font-semibold text-gray-900">
                      1 {transaction.metadata.senderCurrency || transaction.currency} ≈ {transaction.metadata.exchangeRate.toFixed(2)} {transaction.metadata.recipientCurrency || transaction.currency}
                    </span>
                  </div>
                  {transaction.metadata.senderAmount && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Original Amount</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(transaction.metadata.senderAmount, transaction.metadata.senderCurrency)}
                      </span>
                    </div>
                  )}
                  {transaction.metadata.recipientAmount && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Converted Amount</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(transaction.metadata.recipientAmount, transaction.metadata.recipientCurrency)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                window.print();
              }}
              className="flex-1 px-4 py-2.5 bg-[#c1ff72] text-gray-900 font-bold rounded-lg hover:bg-[#b3e865] transition-colors"
            >
              Print Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
