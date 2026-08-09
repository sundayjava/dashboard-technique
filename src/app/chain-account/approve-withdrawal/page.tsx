'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { AlertCircle, Loader2, CheckCircle, XCircle, ArrowUpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';

interface WithdrawalApprovalData {
  alreadyDecided: boolean;
  decision: 'APPROVED' | 'REJECTED' | null;
  withdrawalStatus: string;
  accountName: string;
  accountNumber: string;
  initiatorName: string;
  recipientName: string;
  totalAmount: number;
  currency: string;
  memberShare: number;
}

export default function ApproveWithdrawalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [data, setData] = useState<WithdrawalApprovalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    loadApproval();
  }, [token]);

  const loadApproval = async () => {
    if (!token) {
      setError('Invalid approval link');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`/api/chain-account/approve-withdrawal?token=${token}`);
      if (response.data.success) {
        setData(response.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load withdrawal request');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!token) return;

    setProcessing(true);
    try {
      const response = await axios.post('/api/chain-account/approve-withdrawal', {
        token,
        decision,
      });

      if (response.data.success) {
        toast.success(response.data.message);
        setResult(response.data.message);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to record your decision');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading withdrawal request...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-600 mb-6">
            {error || 'This link is invalid or has expired.'}
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (result || data.alreadyDecided || data.withdrawalStatus !== 'PENDING_APPROVAL') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {result ? 'Response Recorded' : 'Already Processed'}
          </h1>
          <p className="text-gray-600 mb-6">
            {result || 'This withdrawal request has already been processed.'}
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-black shadow-sm border-b border-gray-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-3">
            <Image src="/logo/WG_Gbg_Fin-No-bg.png" alt="Acredis Finance" width={150} height={40} className="h-12 w-auto" priority />
            <div>
              <span className="text-xl font-bold text-white whitespace-nowrap">
                <span className="text-[#c1ff72]">A</span>credis Finance
              </span>
              <p className="text-xs text-gray-500">Chain Account Withdrawal Approval</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
              <ArrowUpCircle className="w-8 h-8 text-orange-600" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">
            Withdrawal Approval
          </h1>
          <p className="text-center text-gray-600 mb-8">
            {data.initiatorName} has initiated a withdrawal from {data.accountName}
          </p>

          {/* Withdrawal Details */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Withdrawal Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Account Name:</span>
                <span className="font-medium">{data.accountName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Account Number:</span>
                <span className="font-medium">{data.accountNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Initiated By:</span>
                <span className="font-medium">{data.initiatorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Withdrawal Amount:</span>
                <span className="font-medium">
                  {data.currency} {data.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-gray-600 font-semibold">Your Share:</span>
                <span className="font-bold text-orange-600">
                  {data.currency} {data.memberShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Important Notice */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <div className="flex items-start">
              <AlertCircle className="w-6 h-6 text-red-600 mr-3 shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-red-900 mb-2">Important Notice</h3>
                <ul className="text-red-800 text-sm space-y-1">
                  <li>• This withdrawal only proceeds once ALL members approve</li>
                  <li>• Once fully approved, it goes to Acredis for final admin approval</li>
                  <li>• Funds are only credited to personal wallets after admin approval</li>
                  <li>• If you reject, this withdrawal is cancelled and funds returned to the account</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => handleDecision('REJECTED')}
              disabled={processing}
              className="flex-1 flex items-center justify-center px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <XCircle className="w-5 h-5 mr-2" />
                  Reject
                </>
              )}
            </button>

            <button
              onClick={() => handleDecision('APPROVED')}
              disabled={processing}
              className="flex-1 flex items-center justify-center px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Approve
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
