'use client';

import { useState, useEffect } from 'react';
import { SessionManager } from '@/lib/session';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { XCircle, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface ClosureRequest {
  id: string;
  reason: string;
  reference: string;
  createdAt: string;
  chainAccount: {
    accountNumber: string;
    accountName: string;
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

export default function AdminChainAccountRequestsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [closureRequests, setClosureRequests] = useState<ClosureRequest[]>([]);

  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    const userData = SessionManager.getUser();
    if (!userData || userData.role !== 'ADMIN') {
      router.push('/login');
      return;
    }
    setUser(userData);
    fetchAllRequests();
  }, [router]);

  const fetchAllRequests = async () => {
    try {
      // Closure is the only lifecycle request that still waits on an admin.
      // Member removals and account modifications are settled by the account's
      // own parties and never reach this page.
      const closures = await axios.get('/api/admin/chain-accounts/closure-requests');

      if (closures.data.success) setClosureRequests(closures.data.requests);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleClosureAction = async (requestId: string, action: 'approve' | 'reject', notes: string) => {
    setProcessing(requestId);
    try {
      const response = await axios.post('/api/admin/chain-accounts/closure-requests', {
        requestId,
        action,
        adminNotes: notes,
        adminId: user.id,
      });

      if (response.data.success) {
        toast.success(response.data.message);
        fetchAllRequests();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to process request');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Chain Account Closure Requests</h1>
          <p className="text-gray-600">
            Give final approval to accounts whose members have all agreed to close them. Member
            removals and account changes are settled by the account&apos;s own parties and do not
            appear here.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex items-center px-6 py-4 border-b border-gray-200">
            <XCircle className="w-4 h-4 mr-2 text-red-600" />
            <span className="font-medium text-sm text-gray-900">Account Closures</span>
            {closureRequests.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {closureRequests.length}
              </span>
            )}
          </div>

          <div className="p-6">
            <div className="space-y-4">
              {closureRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <XCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>No pending closure requests</p>
                </div>
              ) : (
                closureRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    icon={XCircle}
                    iconColor="text-red-600"
                    title={`Close ${request.chainAccount.accountName}`}
                    subtitle={request.chainAccount.accountNumber}
                    initiator={request.initiator.user.name || request.initiator.user.email}
                    reason={request.reason}
                    reference={request.reference}
                    createdAt={request.createdAt}
                    processing={processing === request.id}
                    onApprove={(notes) => handleClosureAction(request.id, 'approve', notes)}
                    onReject={(notes) => handleClosureAction(request.id, 'reject', notes)}
                  >
                    <div className="bg-gray-50 rounded p-3 text-sm">
                      <p className="text-gray-600"><strong>Current Balance:</strong> {request.chainAccount.currency} ${request.chainAccount.balance.toLocaleString()}</p>
                      {request.chainAccount.balance > 0 && (
                        <div className="mt-2 flex items-start space-x-2 text-red-600">
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <p className="text-xs">Warning: Account has remaining balance. Cannot be closed until balance is $0.</p>
                        </div>
                      )}
                    </div>
                  </RequestCard>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestCard({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  initiator,
  reason,
  reference,
  createdAt,
  processing,
  children,
  onApprove,
  onReject,
}: {
  icon: any;
  iconColor: string;
  title: string;
  subtitle: string;
  initiator: string;
  reason: string;
  reference: string;
  createdAt: string;
  processing: boolean;
  children?: React.ReactNode;
  onApprove: (notes: string) => void;
  onReject: (notes: string) => void;
}) {
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);

  const handleSubmit = () => {
    if (action) {
      if (action === 'approve') {
        onApprove(notes);
      } else {
        onReject(notes);
      }
      setNotes('');
      setShowNotes(false);
      setAction(null);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-3">
          <Icon className={`w-6 h-6 ${iconColor} mt-1`} />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600">{subtitle}</p>
            <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
              <span>Initiated by: <strong>{initiator}</strong></span>
              <span>•</span>
              <span>{new Date(createdAt).toLocaleString()}</span>
              <span>•</span>
              <span className="font-mono">{reference}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700 mb-1">Reason:</p>
        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{reason}</p>
      </div>

      {children}

      {!showNotes ? (
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => {
              setAction('reject');
              setShowNotes(true);
            }}
            disabled={processing}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={() => {
              setAction('approve');
              setShowNotes(true);
            }}
            disabled={processing}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            {processing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Admin Notes {action === 'reject' && '(Required for rejection)'}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Add notes about this decision..."
          />
          <div className="flex gap-3 mt-3">
            <button
              onClick={() => {
                setShowNotes(false);
                setNotes('');
                setAction(null);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={processing || (action === 'reject' && !notes)}
              className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
                action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {processing ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                `Confirm ${action === 'approve' ? 'Approval' : 'Rejection'}`
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
