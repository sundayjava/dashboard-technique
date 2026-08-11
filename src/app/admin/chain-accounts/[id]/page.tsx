'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
  ArrowLeft,
  Users,
  DollarSign,
  TrendingUp,
  Send,
  Bell,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  User,
  Calendar,
  Activity
} from 'lucide-react';

interface ChainAccountDetails {
  id: string;
  accountName: string;
  accountNumber: string;
  primaryPurpose: string;
  authorizationModel: string;
  thresholdAmount: number | null;
  balance: number;
  investmentBalance: number;
  status: string;
  createdAt: string;
  members: Array<{
    id: string;
    role: string;
    createdAt: string;
    user: {
      id: string;
      name: string | null;
      email: string;
      authorizationCode: string;
    };
  }>;
  deposits: Array<{
    id: string;
    depositMethod: string;
    amount: number;
    reference: string;
    status: string;
    createdAt: string;
    depositedBy: {
      name: string | null;
      email: string;
    };
  }>;
  investments: Array<{
    id: string;
    amount: number;
    expectedReturn: number;
    maturityDate: string;
    status: string;
    createdAt: string;
    closeRequestReason: string | null;
    closeRequestedAt: string | null;
    closeRequestedByUser: { name: string | null; email: string } | null;
    plan: {
      planName: string;
      profitPercentage: number;
    };
    initiatedBy: {
      name: string | null;
      email: string;
    };
  }>;
  withdrawals: Array<{
    id: string;
    amount: number;
    memberDistributions: any;
    status: string;
    createdAt: string;
    initiatedBy: {
      name: string | null;
      email: string;
    };
  }>;
  transactions: Array<{
    id: string;
    transactionType: string;
    amount: number;
    status: string;
    createdAt: string;
    initiatedBy: {
      name: string | null;
      email: string;
    } | null;
  }>;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: string;
  }>;
}

type TabType = 'overview' | 'deposits' | 'investments' | 'withdrawals' | 'transactions' | 'notifications';

const statusConfig = {
  PENDING: { label: 'Pending', bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
  ACTIVE: { label: 'Active', bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
  COMPLETED: { label: 'Completed', bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
  CONFIRMED: { label: 'Confirmed', bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
  REJECTED: { label: 'Rejected', bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
  FAILED: { label: 'Failed', bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
  SUSPENDED: { label: 'Suspended', bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
  PENDING_APPROVAL: { label: 'Pending Approval', bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
  APPROVED: { label: 'Awaiting Admin Approval', bg: 'bg-blue-100', text: 'text-blue-800', icon: Clock },
  PROCESSING: { label: 'Processing', bg: 'bg-blue-100', text: 'text-blue-800', icon: Clock },
  CANCELLED: { label: 'Cancelled', bg: 'bg-gray-100', text: 'text-gray-800', icon: XCircle },
  MATURED: { label: 'Matured', bg: 'bg-blue-100', text: 'text-blue-800', icon: CheckCircle },
  CLOSE_REQUESTED: { label: 'Close Requested', bg: 'bg-orange-100', text: 'text-orange-800', icon: Clock },
  CLOSED_EARLY: { label: 'Closed Early', bg: 'bg-gray-100', text: 'text-gray-800', icon: CheckCircle },
};

export default function AdminChainAccountDetailPage() {
  const router = useRouter();
  const params = useParams();
  const accountId = params.id as string;

  const [account, setAccount] = useState<ChainAccountDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    // Check admin authentication
    const userData = localStorage.getItem('user');
    if (!userData) {
      toast.error('Please log in to continue');
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'ADMIN') {
      toast.error('Unauthorized access');
      router.push('/dashboard');
      return;
    }

    if (accountId) {
      fetchAccountDetails();
    }
  }, [accountId, router]);

  const fetchAccountDetails = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`/api/admin/chain-accounts/${accountId}`);
      
      if (response.data.account) {
        setAccount(response.data.account);
      }
    } catch (error: any) {
      console.error('Error fetching account details:', error);
      toast.error(error.response?.data?.error || 'Failed to load account details');
      router.push('/admin/chain-accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveDeposit = async (depositId: string) => {
    if (!confirm('Are you sure you want to approve this deposit?')) return;

    try {
      setProcessingId(depositId);
      await axios.post(`/api/admin/chain-accounts/deposits/approve`, {
        depositId
      });
      toast.success('Deposit approved successfully');
      await fetchAccountDetails();
    } catch (error: any) {
      console.error('Error approving deposit:', error);
      toast.error(error.response?.data?.error || 'Failed to approve deposit');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectDeposit = async (depositId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
      setProcessingId(depositId);
      await axios.post(`/api/admin/chain-accounts/deposits/reject`, {
        depositId,
        reason
      });
      toast.success('Deposit rejected');
      await fetchAccountDetails();
    } catch (error: any) {
      console.error('Error rejecting deposit:', error);
      toast.error(error.response?.data?.error || 'Failed to reject deposit');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveWithdrawal = async (withdrawalId: string) => {
    if (!confirm('Are you sure you want to approve this withdrawal?')) return;

    try {
      setProcessingId(withdrawalId);
      await axios.post(`/api/admin/chain-accounts/withdrawals/approve`, {
        withdrawalId
      });
      toast.success('Withdrawal approved successfully');
      await fetchAccountDetails();
    } catch (error: any) {
      console.error('Error approving withdrawal:', error);
      toast.error(error.response?.data?.error || 'Failed to approve withdrawal');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectWithdrawal = async (withdrawalId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
      setProcessingId(withdrawalId);
      await axios.post(`/api/admin/chain-accounts/withdrawals/reject`, {
        withdrawalId,
        reason
      });
      toast.success('Withdrawal rejected');
      await fetchAccountDetails();
    } catch (error: any) {
      console.error('Error rejecting withdrawal:', error);
      toast.error(error.response?.data?.error || 'Failed to reject withdrawal');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveInvestmentClose = async (investmentId: string) => {
    if (!confirm('Approve this early close request? Principal + prorated profit will be refunded to the Chain Account balance.')) return;

    try {
      setProcessingId(investmentId);
      await axios.post(`/api/admin/chain-accounts/investments/close/approve`, {
        investmentId
      });
      toast.success('Investment close approved and refunded');
      await fetchAccountDetails();
    } catch (error: any) {
      console.error('Error approving investment close:', error);
      toast.error(error.response?.data?.error || 'Failed to approve investment close');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectInvestmentClose = async (investmentId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
      setProcessingId(investmentId);
      await axios.post(`/api/admin/chain-accounts/investments/close/reject`, {
        investmentId,
        reason
      });
      toast.success('Investment close request rejected');
      await fetchAccountDetails();
    } catch (error: any) {
      console.error('Error rejecting investment close:', error);
      toast.error(error.response?.data?.error || 'Failed to reject investment close');
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading account details...</p>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-lg text-gray-600">Account not found</p>
          <button
            onClick={() => router.push('/admin/chain-accounts')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Chain Accounts
          </button>
        </div>
      </div>
    );
  }

  const statusStyle = statusConfig[account.status as keyof typeof statusConfig];
  const StatusIcon = statusStyle?.icon;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 md:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.push('/admin/chain-accounts')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Chain Accounts
        </button>

        {/* Header */}
        <div className="bg-linear-to-r from-blue-600 to-indigo-700 rounded-xl shadow-lg p-6 mb-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">{account.accountName}</h1>
              <p className="text-blue-100 mt-1 font-mono text-sm">{account.accountNumber}</p>
              <div className="flex items-center gap-4 mt-4">
                <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold">
                  {account.primaryPurpose}
                </span>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${statusStyle?.bg} ${statusStyle?.text}`}>
                  {StatusIcon && <StatusIcon className="w-3 h-3" />}
                  {statusStyle?.label}
                </span>
              </div>
            </div>
          </div>

          {/* Balance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-blue-100 text-sm mb-1">Available Balance</p>
              <p className="text-2xl font-bold">${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-blue-100 text-sm mb-1">Investment Balance</p>
              <p className="text-2xl font-bold">${account.investmentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-blue-100 text-sm mb-1">Total Value</p>
              <p className="text-2xl font-bold">${(account.balance + account.investmentBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="flex gap-1 p-2">
              {[
                { id: 'overview', label: 'Overview', icon: Activity },
                { id: 'deposits', label: 'Deposits', icon: DollarSign },
                { id: 'investments', label: 'Investments', icon: TrendingUp },
                { id: 'withdrawals', label: 'Withdrawals', icon: Send },
                { id: 'transactions', label: 'Transactions', icon: FileText },
                { id: 'notifications', label: 'Notifications', icon: Bell },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Account Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Authorization Model</p>
                      <p className="font-semibold text-gray-900">{account.authorizationModel}</p>
                    </div>
                    {account.thresholdAmount && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-1">Threshold Amount</p>
                        <p className="font-semibold text-gray-900">${account.thresholdAmount.toLocaleString()}</p>
                      </div>
                    )}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">Created At</p>
                      <p className="font-semibold text-gray-900">{new Date(account.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Members */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Members ({account.members.length})
                  </h3>
                  <div className="space-y-3">
                    {account.members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{member.user.name || member.user.email}</p>
                            <p className="text-xs text-gray-500">{member.user.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                            {member.role}
                          </span>
                          <p className="text-xs text-gray-500 mt-1">
                            Joined {new Date(member.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Stats */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{account.deposits.length}</p>
                      <p className="text-sm text-gray-600 mt-1">Deposits</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{account.investments.length}</p>
                      <p className="text-sm text-gray-600 mt-1">Investments</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{account.withdrawals.length}</p>
                      <p className="text-sm text-gray-600 mt-1">Withdrawals</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{account.transactions.length}</p>
                      <p className="text-sm text-gray-600 mt-1">Transactions</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Deposits Tab */}
            {activeTab === 'deposits' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Deposits ({account.deposits.length})
                  </h3>
                </div>

                {account.deposits.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>No deposits yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {account.deposits.map((deposit) => {
                      const depositStatus = statusConfig[deposit.status as keyof typeof statusConfig];
                      const DepositStatusIcon = depositStatus?.icon;

                      return (
                        <div key={deposit.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${depositStatus?.bg} ${depositStatus?.text}`}>
                                  {DepositStatusIcon && <DepositStatusIcon className="w-3 h-3" />}
                                  {depositStatus?.label}
                                </span>
                                <span className="text-xs text-gray-500">{deposit.depositMethod}</span>
                              </div>
                              <p className="text-2xl font-bold text-gray-900 mb-1">
                                ${deposit.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-xs text-gray-500 font-mono">{deposit.reference}</p>
                              <p className="text-xs text-gray-500 mt-2">
                                By {deposit.depositedBy.name || deposit.depositedBy.email} • {new Date(deposit.createdAt).toLocaleString()}
                              </p>
                            </div>
                            
                            {deposit.status === 'PENDING' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApproveDeposit(deposit.id)}
                                  disabled={processingId === deposit.id}
                                  className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectDeposit(deposit.id)}
                                  disabled={processingId === deposit.id}
                                  className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Investments Tab */}
            {activeTab === 'investments' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Investments ({account.investments.length})
                </h3>

                {account.investments.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <TrendingUp className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>No investments yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {account.investments.map((investment) => {
                      const investmentStatus = statusConfig[investment.status as keyof typeof statusConfig];
                      const InvestmentStatusIcon = investmentStatus?.icon;

                      return (
                        <div key={investment.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${investmentStatus?.bg} ${investmentStatus?.text}`}>
                                  {InvestmentStatusIcon && <InvestmentStatusIcon className="w-3 h-3" />}
                                  {investmentStatus?.label}
                                </span>
                                <span className="text-xs font-semibold text-gray-700">{investment.plan.planName}</span>
                              </div>
                              <p className="text-2xl font-bold text-gray-900 mb-1">
                                ${investment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-gray-600 mt-2">
                                <span>ROI: {investment.plan.profitPercentage}%</span>
                                <span>Expected: ${investment.expectedReturn.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                <span>Matures: {new Date(investment.maturityDate).toLocaleDateString()}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                By {investment.initiatedBy.name || investment.initiatedBy.email} • {new Date(investment.createdAt).toLocaleString()}
                              </p>
                            </div>

                            {investment.status === 'CLOSE_REQUESTED' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApproveInvestmentClose(investment.id)}
                                  disabled={processingId === investment.id}
                                  className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectInvestmentClose(investment.id)}
                                  disabled={processingId === investment.id}
                                  className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>

                          {investment.status === 'CLOSE_REQUESTED' && (
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-3">
                              <p className="text-xs text-orange-800">
                                <strong>Early close requested</strong> by {investment.closeRequestedByUser?.name || investment.closeRequestedByUser?.email || 'a member'}
                                {investment.closeRequestedAt && ` on ${new Date(investment.closeRequestedAt).toLocaleString()}`}
                                {investment.closeRequestReason && `: "${investment.closeRequestReason}"`}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Withdrawals Tab */}
            {activeTab === 'withdrawals' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Withdrawals ({account.withdrawals.length})
                </h3>

                {account.withdrawals.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Send className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>No withdrawals yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {account.withdrawals.map((withdrawal) => {
                      const withdrawalStatus = statusConfig[withdrawal.status as keyof typeof statusConfig];
                      const WithdrawalStatusIcon = withdrawalStatus?.icon;
                      const distributions: Array<{ memberId: string; amount: number }> = withdrawal.memberDistributions || [];

                      return (
                        <div key={withdrawal.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${withdrawalStatus?.bg} ${withdrawalStatus?.text}`}>
                                  {WithdrawalStatusIcon && <WithdrawalStatusIcon className="w-3 h-3" />}
                                  {withdrawalStatus?.label}
                                </span>
                              </div>
                              <p className="text-2xl font-bold text-gray-900 mb-1">
                                ${withdrawal.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-xs text-gray-500 mt-2">
                                By {withdrawal.initiatedBy.name || withdrawal.initiatedBy.email} • {new Date(withdrawal.createdAt).toLocaleString()}
                              </p>
                            </div>

                            {withdrawal.status === 'APPROVED' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApproveWithdrawal(withdrawal.id)}
                                  disabled={processingId === withdrawal.id}
                                  className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectWithdrawal(withdrawal.id)}
                                  disabled={processingId === withdrawal.id}
                                  className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Member Distributions */}
                          <div className="bg-gray-50 rounded-lg p-3 mt-3">
                            <p className="text-xs font-semibold text-gray-700 mb-2">Distributions:</p>
                            <div className="space-y-1">
                              {distributions.map((dist) => {
                                const member = account.members.find(m => m.id === dist.memberId);
                                return (
                                  <div key={dist.memberId} className="flex justify-between text-xs">
                                    <span className="text-gray-600">{member?.user.name || member?.user.email}</span>
                                    <span className="font-semibold text-gray-900">${Number(dist.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Transactions Tab */}
            {activeTab === 'transactions' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  All Transactions ({account.transactions.length})
                </h3>

                {account.transactions.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>No transactions yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {account.transactions.map((txn) => {
                      const txnStatus = statusConfig[txn.status as keyof typeof statusConfig];
                      const TxnStatusIcon = txnStatus?.icon;

                      return (
                        <div key={txn.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${txnStatus?.bg}`}>
                              {TxnStatusIcon && <TxnStatusIcon className={`w-5 h-5 ${txnStatus?.text}`} />}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{txn.transactionType}</p>
                              <p className="text-xs text-gray-500">
                                {txn.initiatedBy ? (txn.initiatedBy.name || txn.initiatedBy.email) : 'System'} • {new Date(txn.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">${txn.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${txnStatus?.bg} ${txnStatus?.text}`}>
                              {txnStatus?.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Notifications ({account.notifications.length})
                </h3>

                {account.notifications.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>No notifications</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {account.notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 border rounded-lg ${
                          notification.isRead ? 'bg-white border-gray-200' : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Bell className={`w-5 h-5 mt-0.5 ${notification.isRead ? 'text-gray-400' : 'text-blue-600'}`} />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">{notification.title}</p>
                            <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">
                                {notification.type}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(notification.createdAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
