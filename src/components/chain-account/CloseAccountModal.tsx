'use client';

import { useState } from 'react';
import { X, Loader2, AlertTriangle, AlertCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface CloseAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  chainAccountId: string;
  accountName: string;
  balance: number;
  accessToken: string;
}

export default function CloseAccountModal({
  isOpen,
  onClose,
  chainAccountId,
  accountName,
  balance,
  accessToken,
}: CloseAccountModalProps) {
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      toast.error('Please provide a reason for closure');
      return;
    }

    if (confirmText !== 'CLOSE ACCOUNT') {
      toast.error('Please type "CLOSE ACCOUNT" to confirm');
      return;
    }

    if (balance > 0) {
      toast.error('Account must have zero balance before closure');
      return;
    }

    setSubmitting(true);

    try {
      const response = await axios.post(
        '/api/chain-account/close-account',
        {
          chainAccountId,
          reason,
        },
        {
          headers: {
            'X-Chain-Access-Token': accessToken,
          }
        }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        onClose();
        setReason('');
        setConfirmText('');
      }
    } catch (error: any) {
      console.error('Close account error:', error);
      toast.error(error.response?.data?.error || 'Failed to submit closure request');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
            <h2 className="text-xl font-bold text-gray-900">Close Chain Account</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Danger Warning */}
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="w-6 h-6 text-red-600 mr-3 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-900 mb-2">⚠️ Permanent Action</h3>
                <p className="text-sm text-red-800 mb-3">
                  Closing this account is <strong>permanent and irreversible</strong>. Once closed:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                  <li>All members will lose access immediately</li>
                  <li>Account history will be archived</li>
                  <li>The account cannot be reopened</li>
                  <li>All access tokens will be invalidated</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Balance Check */}
          {balance > 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Account Has Remaining Balance</p>
                  <p>
                    Current balance: <strong>${balance.toLocaleString()}</strong>
                  </p>
                  <p className="mt-2">
                    You must withdraw all funds before closing this account.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-green-600 mr-3 shrink-0 mt-0.5" />
                <div className="text-sm text-green-800">
                  <p className="font-semibold">✓ Account balance is zero</p>
                  <p>The account is eligible for closure.</p>
                </div>
              </div>
            </div>
          )}

          {/* Closure Process */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Closure Process:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
              <li>Every member will receive an email with a link to confirm or reject the closure</li>
              <li>Once all members confirm, an admin must give final approval</li>
              <li>If any member rejects, the closure is cancelled</li>
              <li>Once approved, the account closes permanently</li>
            </ol>
          </div>

          {/* Account Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Account Details</h3>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Account Name:</span>
                <span className="font-medium">{accountName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Current Balance:</span>
                <span className="font-medium">${balance.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Closure *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Explain why this account should be closed..."
              disabled={balance > 0}
            />
            <p className="text-xs text-gray-500 mt-1">
              This reason will be shared with all members
            </p>
          </div>

          {/* Confirmation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type <strong>CLOSE ACCOUNT</strong> to confirm *
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono"
              placeholder="CLOSE ACCOUNT"
              disabled={balance > 0}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !reason || confirmText !== 'CLOSE ACCOUNT' || balance > 0}
              className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Closure Request'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
