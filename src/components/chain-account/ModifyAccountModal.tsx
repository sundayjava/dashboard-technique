'use client';

import { useState } from 'react';
import { X, Loader2, Settings, AlertCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface ChainAccount {
  authorizationModel: string;
  thresholdAmount: number | null;
  thresholdCurrency: string;
  primaryPurpose: string;
  purposeDescription: string;
}

interface ModifyAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  chainAccountId: string;
  chainAccount: ChainAccount;
  accessToken: string;
}

export default function ModifyAccountModal({
  isOpen,
  onClose,
  chainAccountId,
  chainAccount,
  accessToken,
}: ModifyAccountModalProps) {
  const [modificationType, setModificationType] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form fields for different modification types
  const [authorizationModel, setAuthorizationModel] = useState(chainAccount.authorizationModel);
  const [thresholdAmount, setThresholdAmount] = useState(chainAccount.thresholdAmount?.toString() || '');
  const [thresholdCurrency, setThresholdCurrency] = useState(chainAccount.thresholdCurrency);
  const [primaryPurpose, setPrimaryPurpose] = useState(chainAccount.primaryPurpose);
  const [purposeOther, setPurposeOther] = useState('');
  const [purposeDescription, setPurposeDescription] = useState(chainAccount.purposeDescription);

  const handleSubmit = async () => {
    if (!modificationType || !reason) {
      toast.error('Please select modification type and provide a reason');
      return;
    }

    let proposedChanges: any = {};

    if (modificationType === 'AUTHORIZATION_MODEL') {
      if (!authorizationModel) {
        toast.error('Please select an authorization model');
        return;
      }
      proposedChanges = {
        authorizationModel,
        thresholdAmount: (authorizationModel === 'THRESHOLD' || authorizationModel === 'MAJORITY') ? parseFloat(thresholdAmount) : null,
        thresholdCurrency,
      };
    } else if (modificationType === 'THRESHOLD_AMOUNT') {
      if (!thresholdAmount) {
        toast.error('Please enter threshold amount');
        return;
      }
      proposedChanges = {
        thresholdAmount: parseFloat(thresholdAmount),
        thresholdCurrency,
      };
    } else if (modificationType === 'ACCOUNT_PURPOSE') {
      if (!primaryPurpose || !purposeDescription) {
        toast.error('Please fill in all purpose fields');
        return;
      }
      if (primaryPurpose === 'Other' && !purposeOther) {
        toast.error('Please specify the purpose');
        return;
      }
      proposedChanges = {
        primaryPurpose: primaryPurpose === 'Other' ? purposeOther : primaryPurpose,
        purposeDescription,
      };
    }

    setSubmitting(true);

    try {
      const response = await axios.post(
        '/api/chain-account/modify-account',
        {
          chainAccountId,
          modificationType,
          proposedChanges,
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
        setModificationType('');
        setReason('');
      }
    } catch (error: any) {
      console.error('Modify account error:', error);
      toast.error(error.response?.data?.error || 'Failed to apply account changes');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <Settings className="w-6 h-6 text-blue-600 mr-3" />
            <h2 className="text-xl font-bold text-gray-900">Modify Account Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Warning */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-blue-600 mr-3 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Modification Process:</p>
                <p>Changes take effect immediately. All other members will be notified by email.</p>
              </div>
            </div>
          </div>

          {/* Modification Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What would you like to modify? *
            </label>
            <select
              value={modificationType}
              onChange={(e) => setModificationType(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select modification type</option>
              <option value="AUTHORIZATION_MODEL">Authorization Model & Threshold</option>
              <option value="THRESHOLD_AMOUNT">Transaction Threshold Amount</option>
              <option value="ACCOUNT_PURPOSE">Account Purpose & Description</option>
            </select>
          </div>

          {/* Authorization Model Fields */}
          {modificationType === 'AUTHORIZATION_MODEL' && (
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900">New Authorization Model</h3>
              <div className="space-y-3">
                <label className="flex items-start p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                  <input
                    type="radio"
                    name="authModel"
                    value="INDEPENDENT"
                    checked={authorizationModel === 'INDEPENDENT'}
                    onChange={(e) => setAuthorizationModel(e.target.value)}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">Independent Authorization</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Any signatory can act independently
                    </div>
                  </div>
                </label>

                <label className="flex items-start p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                  <input
                    type="radio"
                    name="authModel"
                    value="THRESHOLD"
                    checked={authorizationModel === 'THRESHOLD'}
                    onChange={(e) => setAuthorizationModel(e.target.value)}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">Threshold Authorization</div>
                    <div className="text-sm text-gray-600 mt-1">
                      All must approve transactions ≥ threshold
                    </div>
                  </div>
                </label>

                <label className="flex items-start p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                  <input
                    type="radio"
                    name="authModel"
                    value="MAJORITY"
                    checked={authorizationModel === 'MAJORITY'}
                    onChange={(e) => setAuthorizationModel(e.target.value)}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">Majority Authorization</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Majority must approve transactions ≥ threshold
                    </div>
                  </div>
                </label>
              </div>

              {(authorizationModel === 'THRESHOLD' || authorizationModel === 'MAJORITY') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Threshold Amount *
                  </label>
                  <div className="flex gap-3">
                    <select
                      value={thresholdCurrency}
                      onChange={(e) => setThresholdCurrency(e.target.value)}
                      className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                    <input
                      type="number"
                      value={thresholdAmount}
                      onChange={(e) => setThresholdAmount(e.target.value)}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="5000"
                      min="0"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Threshold Amount Fields */}
          {modificationType === 'THRESHOLD_AMOUNT' && (
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900">New Threshold Amount</h3>
              <div className="flex gap-3">
                <select
                  value={thresholdCurrency}
                  onChange={(e) => setThresholdCurrency(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
                <input
                  type="number"
                  value={thresholdAmount}
                  onChange={(e) => setThresholdAmount(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="5000"
                  min="0"
                />
              </div>
              <p className="text-xs text-gray-600">
                Current: {chainAccount.thresholdCurrency} {chainAccount.thresholdAmount}
              </p>
            </div>
          )}

          {/* Account Purpose Fields */}
          {modificationType === 'ACCOUNT_PURPOSE' && (
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900">New Account Purpose</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Purpose *
                </label>
                <select
                  value={primaryPurpose}
                  onChange={(e) => setPrimaryPurpose(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select purpose</option>
                  <option value="Business Operations">Business Operations</option>
                  <option value="Investment Partnership">Investment Partnership</option>
                  <option value="Spousal / Family Account">Spousal / Family Account</option>
                  <option value="Estate & Wealth Management">Estate & Wealth Management</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              {primaryPurpose === 'Other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Please specify *
                  </label>
                  <input
                    type="text"
                    value={purposeOther}
                    onChange={(e) => setPurposeOther(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Specify the purpose"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Purpose Description *
                </label>
                <textarea
                  value={purposeDescription}
                  onChange={(e) => setPurposeDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the account purpose..."
                />
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Modification *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Explain why this modification is needed..."
            />
            <p className="text-xs text-gray-500 mt-1">
              This reason will be shared with all members
            </p>
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
              disabled={submitting || !modificationType || !reason}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Applying Changes...
                </>
              ) : (
                'Apply Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
