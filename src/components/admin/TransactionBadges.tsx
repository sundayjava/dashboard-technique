import React from 'react';

export function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    CRYPTO_DEPOSIT: 'Crypto Deposit',
    BANK_DEPOSIT: 'Bank Deposit',
    CHEQUE_DEPOSIT: 'Cheque Deposit',
    TRANSFER_OUT: 'Transfer Out',
    TRANSFER_IN: 'Transfer In',
    WITHDRAWAL: 'Withdrawal',
  };
  return labels[type] || type;
}

export function getTypeBadge(type: string): React.ReactElement {
  const badges: Record<string, React.ReactElement> = {
    CRYPTO_DEPOSIT: (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
        Crypto Deposit
      </span>
    ),
    BANK_DEPOSIT: (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
        Bank Deposit
      </span>
    ),
    CHEQUE_DEPOSIT: (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
        Cheque Deposit
      </span>
    ),
    TRANSFER_OUT: (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
        Transfer Out
      </span>
    ),
    TRANSFER_IN: (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-teal-100 text-teal-800">
        Transfer In
      </span>
    ),
    WITHDRAWAL: (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
        Withdrawal
      </span>
    ),
  };
  return badges[type] || <span className="text-xs text-gray-500">{type}</span>;
}

export function getStatusBadge(status: string): React.ReactElement {
  const badges: Record<string, React.ReactElement> = {
    PENDING: (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
        Pending
      </span>
    ),
    PROCESSING: (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
        Processing
      </span>
    ),
    COMPLETED: (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
        Completed
      </span>
    ),
    FAILED: (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
        Failed
      </span>
    ),
    CANCELLED: (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
        Cancelled
      </span>
    ),
    REVERSED: (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
        Reversed
      </span>
    ),
  };
  return badges[status] || <span className="text-xs text-gray-500">{status}</span>;
}
