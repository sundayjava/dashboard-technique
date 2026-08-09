'use client';

import { useState, useEffect } from 'react';
import { X, ArrowUpCircle, Loader2, AlertCircle, Clock, Users } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ChainAccountSessionManager } from '@/lib/chain-account-session';

interface Member {
  id: string;
  role: string;
  hasConfirmed: boolean;
  user: {
    name: string | null;
    email: string;
  };
}

interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  chainAccountId: string;
  members: Member[];
  accountBalance: number;
  authorizationModel: string;
  thresholdAmount: number | null;
  onSuccess: () => void;
}

export default function WithdrawalModal({
  isOpen,
  onClose,
  chainAccountId,
  members,
  accountBalance,
  authorizationModel,
  thresholdAmount,
  onSuccess,
}: WithdrawalModalProps) {
  const [step, setStep] = useState<'amounts' | 'confirm'>('amounts');
  const [memberDistributions, setMemberDistributions] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Initialize distributions with empty strings
      const initial: Record<string, string> = {};
      members.forEach(member => {
        initial[member.id] = '';
      });
      setMemberDistributions(initial);
    }
  }, [isOpen, members]);

  useEffect(() => {
    checkApprovalRequirement();
  }, [memberDistributions, authorizationModel, thresholdAmount]);

  const getTotalAmount = () => {
    return Object.values(memberDistributions).reduce((sum, amount) => {
      return sum + (parseFloat(amount) || 0);
    }, 0);
  };

  const checkApprovalRequirement = () => {
    const totalAmount = getTotalAmount();
    
    if (authorizationModel === 'INDEPENDENT') {
      setRequiresApproval(false);
    } else if (authorizationModel === 'THRESHOLD') {
      setRequiresApproval(thresholdAmount !== null && totalAmount >= thresholdAmount);
    } else if (authorizationModel === 'MAJORITY') {
      setRequiresApproval(true);
    }
  };

  const handleDistributionChange = (memberId: string, value: string) => {
    setMemberDistributions(prev => ({
      ...prev,
      [memberId]: value,
    }));
  };

  const handleEqualDistribution = () => {
    const equalAmount = (accountBalance / members.length).toFixed(2);
    const distributions: Record<string, string> = {};
    members.forEach(member => {
      distributions[member.id] = equalAmount;
    });
    setMemberDistributions(distributions);
  };

  const validateAmounts = () => {
    const totalAmount = getTotalAmount();
    
    if (totalAmount <= 0) {
      toast.error('Please enter withdrawal amounts');
      return false;
    }

    if (totalAmount > accountBalance) {
      toast.error('Total withdrawal exceeds available balance');
      return false;
    }

    // Check if at least one member has an amount
    const hasAmount = Object.values(memberDistributions).some(amount => parseFloat(amount) > 0);
    if (!hasAmount) {
      toast.error('At least one member must receive funds');
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (validateAmounts()) {
      setStep('confirm');
    }
  };

  const handleSubmit = async () => {
    if (!validateAmounts()) return;

    setSubmitting(true);

    try {
      const token = ChainAccountSessionManager.getToken();
      if (!token) {
        toast.error('Chain Account session expired. Please log in again.');
        return;
      }

      // Convert distributions to array format
      const distributions = Object.entries(memberDistributions)
        .filter(([_, amount]) => parseFloat(amount) > 0)
        .map(([memberId, amount]) => ({
          memberId,
          amount: parseFloat(amount),
        }));

      const response = await axios.post(
        '/api/chain-account/withdraw',
        {
          chainAccountId,
          distributions,
          currency: 'USD',
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        if (requiresApproval) {
          toast.success('Withdrawal request submitted! Awaiting member approvals.');
        } else {
          toast.success('Withdrawal processed successfully!');
        }
        onSuccess();
        handleClose();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to process withdrawal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('amounts');
    setMemberDistributions({});
    setRequiresApproval(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Withdrawal</h2>
            <p className="text-sm text-gray-600 mt-1">
              {step === 'amounts' ? 'Distribute funds to members' : 'Review and confirm'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Enter Amounts */}
          {step === 'amounts' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <ArrowUpCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-900 mb-1">
                      Chain Account Withdrawal
                    </h4>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-blue-700">
                        Available Balance: <span className="font-semibold">${accountBalance.toLocaleString()}</span>
                      </p>
                      <button
                        onClick={handleEqualDistribution}
                        className="text-xs text-blue-700 hover:text-blue-900 underline font-medium"
                      >
                        Split Equally
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Member Distribution Inputs */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-gray-600" />
                  Distribution to Members
                </h3>
                
                {members.map((member) => (
                  <div key={member.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {member.user.name || 'User'}
                      </p>
                      <p className="text-xs text-gray-600">{member.role.replace('_', ' ')}</p>
                    </div>
                    <div className="w-40">
                      <input
                        type="number"
                        value={memberDistributions[member.id] || ''}
                        onChange={(e) => handleDistributionChange(member.id, e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        max={accountBalance}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
                      />
                    </div>
                    <span className="text-gray-600 text-sm w-8">USD</span>
                  </div>
                ))}
              </div>

              {/* Total Summary */}
              <div className="bg-gray-100 rounded-lg p-4 border border-gray-300">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700 font-medium">Total Withdrawal</span>
                  <span className="text-2xl font-bold text-gray-900">
                    ${getTotalAmount().toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Remaining Balance</span>
                  <span className={`font-semibold ${
                    accountBalance - getTotalAmount() < 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    ${(accountBalance - getTotalAmount()).toLocaleString()}
                  </span>
                </div>
              </div>

              {getTotalAmount() > accountBalance && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-2 shrink-0" />
                    <p className="text-sm text-red-700">
                      Total withdrawal exceeds available balance
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={handleNext}
                disabled={getTotalAmount() <= 0 || getTotalAmount() > accountBalance}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold"
              >
                Continue to Review
              </button>
            </div>
          )}

          {/* Step 2: Confirm */}
          {step === 'confirm' && (
            <div className="space-y-6">
              <button
                onClick={() => setStep('amounts')}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
              >
                ← Back to amounts
              </button>

              {/* Approval Warning */}
              {requiresApproval && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <Clock className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-yellow-900 mb-1">
                        Approval Required
                      </h4>
                      <p className="text-xs text-yellow-700">
                        {authorizationModel === 'THRESHOLD' && 
                          `This withdrawal exceeds the threshold of $${thresholdAmount?.toLocaleString()}. `
                        }
                        {authorizationModel === 'MAJORITY' && 
                          'All withdrawals require majority approval. '
                        }
                        Other members will be notified to approve this withdrawal before it's processed.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Withdrawal Summary */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h3 className="font-semibold text-gray-900 text-lg mb-4">
                  Withdrawal Summary
                </h3>
                
                <div className="space-y-3 mb-4">
                  {members
                    .filter(member => parseFloat(memberDistributions[member.id]) > 0)
                    .map((member) => (
                      <div key={member.id} className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900">
                            {member.user.name || 'User'}
                          </p>
                          <p className="text-xs text-gray-600">{member.user.email}</p>
                        </div>
                        <p className="font-semibold text-gray-900">
                          ${parseFloat(memberDistributions[member.id]).toLocaleString()}
                        </p>
                      </div>
                    ))}
                </div>

                <div className="pt-4 border-t border-gray-300">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-900">Total Withdrawal</span>
                    <span className="font-bold text-gray-900 text-xl">
                      ${getTotalAmount().toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setStep('amounts')}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold flex items-center justify-center"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : requiresApproval ? (
                    'Submit for Approval'
                  ) : (
                    'Confirm Withdrawal'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
