'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SessionManager } from '@/lib/session';
import axios from 'axios';
import { AlertCircle, Loader2, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';

interface ClosureData {
  reference: string;
  status: string;
  reason: string;
  myDecision: string | null;
  chainAccount: {
    accountName: string;
    accountNumber: string;
    balance: number;
    currency: string;
  };
  initiator: {
    user: {
      name: string;
      email: string;
    };
  };
}

export default function ApproveClosurePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading closure request...</p>
          </div>
        </div>
      }
    >
      <ApproveClosureContent />
    </Suspense>
  );
}

function ApproveClosureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference = searchParams.get('ref');
  const memberId = searchParams.get('member');

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [data, setData] = useState<ClosureData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userData = SessionManager.getUser();
    if (userData) {
      loadClosureRequest();
    } else {
      const returnUrl = `/chain-account/approve-closure?ref=${reference}&member=${memberId}`;
      router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  }, [reference, memberId, router]);

  const loadClosureRequest = async () => {
    if (!reference || !memberId) {
      setError('Invalid closure link');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`/api/chain-account/approve-closure?ref=${reference}&member=${memberId}`);

      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load closure request');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (action: 'approve' | 'reject') => {
    if (!reference || !memberId) return;

    setProcessing(true);

    try {
      SessionManager.updateActivity();

      const response = await axios.post('/api/chain-account/approve-closure', {
        reference,
        memberId,
        action,
      });

      if (response.data.success) {
        toast.success(response.data.message);
        SessionManager.updateActivity();
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      }
    } catch (err: any) {
      console.error('Closure decision error:', err);
      toast.error(err.response?.data?.error || 'Failed to process decision');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading closure request...</p>
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
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (data.status !== 'PENDING_APPROVAL' || data.myDecision) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Already Processed</h1>
          <p className="text-gray-600 mb-6">
            {data.myDecision
              ? 'You have already voted on this closure request.'
              : 'This closure request has already been processed.'}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
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
              <p className="text-xs text-gray-500">Chain Account Closure Request</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">
            Closure Request
          </h1>
          <p className="text-center text-gray-600 mb-8">
            A member has requested to permanently close this Chain Account
          </p>

          {/* Account Details */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Chain Account Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Account Name:</span>
                <span className="font-medium">{data.chainAccount.accountName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Account Number:</span>
                <span className="font-medium">{data.chainAccount.accountNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Balance:</span>
                <span className="font-medium">{data.chainAccount.currency} {data.chainAccount.balance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Requested By:</span>
                <span className="font-medium">{data.initiator.user.name || data.initiator.user.email}</span>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-red-900 mb-2">Reason for Closure</h3>
            <p className="text-red-800">{data.reason}</p>
          </div>

          {/* Important Notice */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <div className="flex items-start">
              <AlertCircle className="w-6 h-6 text-red-600 mr-3 shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-red-900 mb-2">Important Notice</h3>
                <ul className="text-red-800 text-sm space-y-1">
                  <li>• This will permanently close the Chain Account and cannot be undone</li>
                  <li>• The account will only be deleted once ALL members confirm and the admin gives final sign-off</li>
                  <li>• If you reject, this closure request will be cancelled</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => handleDecision('reject')}
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
              onClick={() => handleDecision('approve')}
              disabled={processing}
              className="flex-1 flex items-center justify-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Confirm Deletion
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
