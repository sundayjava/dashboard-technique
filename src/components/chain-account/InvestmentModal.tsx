'use client';

import { useState, useEffect } from 'react';
import { X, TrendingUp, Loader2, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface InvestmentPlan {
  id: string;
  planName: string;
  minimumAmount: number;
  maximumAmount: number | null;
  returnRate: number;
  duration: number;
  durationType: string;
  riskLevel: string;
  isChainAccountEligible: boolean;
}

interface InvestmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  chainAccountId: string;
  accountBalance: number;
  authorizationModel: string;
  thresholdAmount: number | null;
  onSuccess: () => void;
}

export default function InvestmentModal({
  isOpen,
  onClose,
  chainAccountId,
  accountBalance,
  authorizationModel,
  thresholdAmount,
  onSuccess,
}: InvestmentModalProps) {
  const [step, setStep] = useState<'plans' | 'amount' | 'confirm'>('plans');
  const [plans, setPlans] = useState<InvestmentPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<InvestmentPlan | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);

  useEffect(() => {
    if (isOpen && step === 'plans') {
      fetchInvestmentPlans();
    }
  }, [isOpen, step]);

  useEffect(() => {
    if (amount && selectedPlan) {
      checkApprovalRequirement();
    }
  }, [amount, selectedPlan, authorizationModel, thresholdAmount]);

  const fetchInvestmentPlans = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/chain-account/investment-plans');
      if (response.data.success) {
        setPlans(response.data.plans.filter((p: InvestmentPlan) => p.isChainAccountEligible));
      }
    } catch (error) {
      console.error('Error fetching investment plans:', error);
      toast.error('Failed to load investment plans');
    } finally {
      setLoading(false);
    }
  };

  const checkApprovalRequirement = () => {
    const investAmount = parseFloat(amount);
    
    if (authorizationModel === 'INDEPENDENT') {
      setRequiresApproval(false);
    } else if (authorizationModel === 'THRESHOLD') {
      setRequiresApproval(thresholdAmount !== null && investAmount >= thresholdAmount);
    } else if (authorizationModel === 'MAJORITY') {
      setRequiresApproval(true);
    }
  };

  const handleSelectPlan = (plan: InvestmentPlan) => {
    setSelectedPlan(plan);
    setStep('amount');
  };

  const handleAmountNext = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!selectedPlan) return;

    const investAmount = parseFloat(amount);

    if (investAmount < selectedPlan.minimumAmount) {
      toast.error(`Minimum investment is $${selectedPlan.minimumAmount.toLocaleString()}`);
      return;
    }

    if (selectedPlan.maximumAmount && investAmount > selectedPlan.maximumAmount) {
      toast.error(`Maximum investment is $${selectedPlan.maximumAmount.toLocaleString()}`);
      return;
    }

    if (investAmount > accountBalance) {
      toast.error('Insufficient Chain Account balance');
      return;
    }

    setStep('confirm');
  };

  const handleSubmit = async () => {
    if (!selectedPlan) return;

    setSubmitting(true);

    try {
      const response = await axios.post('/api/chain-account/invest', {
        chainAccountId,
        investmentPlanId: selectedPlan.id,
        amount: parseFloat(amount),
        currency: 'USD',
      });

      if (response.data.success) {
        if (requiresApproval) {
          toast.success('Investment request submitted! Awaiting member approvals.');
        } else {
          toast.success('Investment created successfully!');
        }
        onSuccess();
        handleClose();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create investment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('plans');
    setSelectedPlan(null);
    setAmount('');
    setRequiresApproval(false);
    onClose();
  };

  if (!isOpen) return null;

  const calculateReturns = () => {
    if (!selectedPlan || !amount) return 0;
    const principal = parseFloat(amount);
    const rate = selectedPlan.returnRate / 100;
    return principal * rate;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">New Investment</h2>
            {selectedPlan && (
              <p className="text-sm text-gray-600 mt-1">
                {step === 'amount' && 'Enter investment amount'}
                {step === 'confirm' && 'Review and confirm'}
              </p>
            )}
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
          {/* Step 1: Select Plan */}
          {step === 'plans' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5 mr-3 shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold text-blue-900 mb-1">
                      Chain Account Investment
                    </h4>
                    <p className="text-xs text-blue-700">
                      Available Balance: <span className="font-semibold">${accountBalance.toLocaleString()}</span>
                      {requiresApproval && ' • This investment will require member approvals'}
                    </p>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Loading investment plans...</p>
                </div>
              ) : plans.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>No investment plans available for Chain Accounts</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => handleSelectPlan(plan)}
                      className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
                    >
                      <h3 className="font-semibold text-gray-900 text-lg mb-2">
                        {plan.planName}
                      </h3>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Return Rate</span>
                          <span className="font-bold text-green-600 text-lg">
                            {plan.returnRate}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Duration</span>
                          <span className="font-semibold text-gray-900">
                            {plan.duration} {plan.durationType}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Minimum</span>
                          <span className="font-semibold text-gray-900">
                            ${plan.minimumAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                        <span className={`text-xs px-2 py-1 rounded ${
                          plan.riskLevel === 'LOW' ? 'bg-green-100 text-green-700' :
                          plan.riskLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {plan.riskLevel} RISK
                        </span>
                        <span className="text-xs text-gray-500 group-hover:text-blue-600">
                          Select →
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Enter Amount */}
          {step === 'amount' && selectedPlan && (
            <div className="space-y-6">
              <button
                onClick={() => setStep('plans')}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
              >
                ← Back to plans
              </button>

              {/* Selected Plan Summary */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h3 className="font-semibold text-gray-900 text-lg mb-4">
                  {selectedPlan.planName}
                </h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 mb-1">Return Rate</p>
                    <p className="font-bold text-green-600 text-xl">{selectedPlan.returnRate}%</p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">Duration</p>
                    <p className="font-semibold text-gray-900">
                      {selectedPlan.duration} {selectedPlan.durationType}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">Risk Level</p>
                    <p className="font-semibold text-gray-900">{selectedPlan.riskLevel}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Investment Amount (USD)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min={selectedPlan.minimumAmount}
                  max={selectedPlan.maximumAmount || accountBalance}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                />
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>Min: ${selectedPlan.minimumAmount.toLocaleString()}</span>
                  <span>Available: ${accountBalance.toLocaleString()}</span>
                </div>
              </div>

              {amount && parseFloat(amount) > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-green-900 mb-2">
                    Projected Returns
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-green-700">Principal</p>
                      <p className="font-bold text-green-900 text-lg">
                        ${parseFloat(amount).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-green-700">Expected Return</p>
                      <p className="font-bold text-green-900 text-lg">
                        ${calculateReturns().toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-green-200">
                    <p className="text-green-700 text-xs">Total at Maturity</p>
                    <p className="font-bold text-green-900 text-xl">
                      ${(parseFloat(amount) + calculateReturns()).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={handleAmountNext}
                disabled={!amount || parseFloat(amount) <= 0}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold"
              >
                Continue to Review
              </button>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && selectedPlan && (
            <div className="space-y-6">
              <button
                onClick={() => setStep('amount')}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
              >
                ← Back to amount
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
                          `This investment exceeds the threshold of $${thresholdAmount?.toLocaleString()}. `
                        }
                        {authorizationModel === 'MAJORITY' && 
                          'All investments require majority approval. '
                        }
                        Other members will be notified to approve this investment before it's activated.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Investment Summary */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h3 className="font-semibold text-gray-900 text-lg mb-4">
                  Investment Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Plan</span>
                    <span className="font-semibold text-gray-900">{selectedPlan.planName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Investment Amount</span>
                    <span className="font-semibold text-gray-900">
                      ${parseFloat(amount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Return Rate</span>
                    <span className="font-semibold text-green-600">{selectedPlan.returnRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration</span>
                    <span className="font-semibold text-gray-900">
                      {selectedPlan.duration} {selectedPlan.durationType}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expected Return</span>
                    <span className="font-semibold text-green-600">
                      ${calculateReturns().toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-gray-300">
                    <span className="font-semibold text-gray-900">Total at Maturity</span>
                    <span className="font-bold text-gray-900 text-lg">
                      ${(parseFloat(amount) + calculateReturns()).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setStep('amount')}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold flex items-center justify-center"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : requiresApproval ? (
                    'Submit for Approval'
                  ) : (
                    'Confirm Investment'
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
