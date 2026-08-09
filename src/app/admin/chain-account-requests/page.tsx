'use client';

import { useState, useEffect } from 'react';
import { SessionManager } from '@/lib/session';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Users, UserX, Settings, XCircle, Loader2, CheckCircle, AlertCircle, FileEdit } from 'lucide-react';
import toast from 'react-hot-toast';

interface RemovalRequest {
  id: string;
  reason: string;
  reference: string;
  createdAt: string;
  chainAccount: {
    accountNumber: string;
    accountName: string;
  };
  initiator: {
    user: {
      name: string;
      email: string;
    };
  };
  target: {
    user: {
      name: string;
      email: string;
    };
  };
}

interface ModificationRequest {
  id: string;
  modificationType: string;
  proposedChanges: any;
  reason: string;
  reference: string;
  createdAt: string;
  chainAccount: {
    accountNumber: string;
    accountName: string;
    authorizationModel: string;
    thresholdAmount: number | null;
    thresholdCurrency: string;
    primaryPurpose: string;
    purposeDescription: string;
  };
  initiator: {
    user: {
      name: string;
      email: string;
    };
  };
}

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
  const [activeTab, setActiveTab] = useState<'removals' | 'modifications' | 'closures'>('removals');

  const [removalRequests, setRemovalRequests] = useState<RemovalRequest[]>([]);
  const [modificationRequests, setModificationRequests] = useState<ModificationRequest[]>([]);
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
      const [removals, modifications, closures] = await Promise.all([
        axios.get('/api/admin/chain-accounts/removal-requests'),
        axios.get('/api/admin/chain-accounts/modification-requests'),
        axios.get('/api/admin/chain-accounts/closure-requests'),
      ]);

      if (removals.data.success) setRemovalRequests(removals.data.requests);
      if (modifications.data.success) setModificationRequests(modifications.data.requests);
      if (closures.data.success) setClosureRequests(closures.data.requests);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleRemovalAction = async (requestId: string, action: 'approve' | 'reject', notes: string) => {
    setProcessing(requestId);
    try {
      const response = await axios.post('/api/admin/chain-accounts/removal-requests', {
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

  const handleModificationAction = async (requestId: string, action: 'approve' | 'reject', notes: string) => {
    setProcessing(requestId);
    try {
      const response = await axios.post('/api/admin/chain-accounts/modification-requests', {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Chain Account Lifecycle Requests</h1>
          <p className="text-gray-600">Review and approve pending member removals, modifications, and closures</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'removals', label: 'Member Removals', icon: UserX, count: removalRequests.length },
                { id: 'modifications', label: 'Account Modifications', icon: Settings, count: modificationRequests.length },
                { id: 'closures', label: 'Account Closures', icon: XCircle, count: closureRequests.length },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                      isActive
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {tab.label}
                    {tab.count > 0 && (
                      <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* Removal Requests */}
            {activeTab === 'removals' && (
              <div className="space-y-4">
                {removalRequests.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <UserX className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>No pending removal requests</p>
                  </div>
                ) : (
                  removalRequests.map((request) => (
                    <RequestCard
                      key={request.id}
                      icon={UserX}
                      iconColor="text-orange-600"
                      title={`Remove ${request.target.user.name || request.target.user.email}`}
                      subtitle={`From ${request.chainAccount.accountName} (${request.chainAccount.accountNumber})`}
                      initiator={request.initiator.user.name || request.initiator.user.email}
                      reason={request.reason}
                      reference={request.reference}
                      createdAt={request.createdAt}
                      processing={processing === request.id}
                      onApprove={(notes) => handleRemovalAction(request.id, 'approve', notes)}
                      onReject={(notes) => handleRemovalAction(request.id, 'reject', notes)}
                    >
                      <div className="bg-gray-50 rounded p-3 text-sm">
                        <p className="text-gray-600 mb-1"><strong>Target Member:</strong> {request.target.user.name} ({request.target.user.email})</p>
                      </div>
                    </RequestCard>
                  ))
                )}
              </div>
            )}

            {/* Modification Requests */}
            {activeTab === 'modifications' && (
              <div className="space-y-4">
                {modificationRequests.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Settings className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>No pending modification requests</p>
                  </div>
                ) : (
                  modificationRequests.map((request) => (
                    <RequestCard
                      key={request.id}
                      icon={Settings}
                      iconColor="text-blue-600"
                      title={`Modify ${request.modificationType.replace('_', ' ')}`}
                      subtitle={`For ${request.chainAccount.accountName} (${request.chainAccount.accountNumber})`}
                      initiator={request.initiator.user.name || request.initiator.user.email}
                      reason={request.reason}
                      reference={request.reference}
                      createdAt={request.createdAt}
                      processing={processing === request.id}
                      onApprove={(notes) => handleModificationAction(request.id, 'approve', notes)}
                      onReject={(notes) => handleModificationAction(request.id, 'reject', notes)}
                    >
                      <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded p-3 text-sm">
                        <div>
                          <p className="text-gray-600 font-semibold mb-2">Current Settings:</p>
                          {request.modificationType === 'AUTHORIZATION_MODEL' && (
                            <>
                              <p className="text-gray-700">Model: {request.chainAccount.authorizationModel}</p>
                              <p className="text-gray-700">Threshold: {request.chainAccount.thresholdCurrency} {request.chainAccount.thresholdAmount}</p>
                            </>
                          )}
                          {request.modificationType === 'THRESHOLD_AMOUNT' && (
                            <p className="text-gray-700">Threshold: {request.chainAccount.thresholdCurrency} {request.chainAccount.thresholdAmount}</p>
                          )}
                          {request.modificationType === 'ACCOUNT_PURPOSE' && (
                            <>
                              <p className="text-gray-700">Purpose: {request.chainAccount.primaryPurpose}</p>
                              <p className="text-gray-700 text-xs mt-1">{request.chainAccount.purposeDescription}</p>
                            </>
                          )}
                        </div>
                        <div>
                          <p className="text-blue-600 font-semibold mb-2">Proposed Changes:</p>
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap">{JSON.stringify(request.proposedChanges, null, 2)}</pre>
                        </div>
                      </div>
                    </RequestCard>
                  ))
                )}
              </div>
            )}

            {/* Closure Requests */}
            {activeTab === 'closures' && (
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
            )}
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
