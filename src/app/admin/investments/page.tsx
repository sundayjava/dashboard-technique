'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface Investment {
  id: string;
  amount: number;
  paymentMethod: 'BANK_WALLET' | 'CRYPTO';
  transactionRef: string | null;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  startDate: string | null;
  endDate: string | null;
  profitEarned: number;
  completedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  plan: {
    id: string;
    planName: string;
    duration: number;
    profitPercentage: number;
    arkIIAllocation: number;
    cryptoAddress: string | null;
  };
}

export default function AdminInvestmentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [filteredInvestments, setFilteredInvestments] = useState<Investment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'FAILED'>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [adminNote, setAdminNote] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
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

    setUser(parsedUser);
    fetchInvestments();
  }, [router]);

  useEffect(() => {
    if (activeFilter === 'ALL') {
      setFilteredInvestments(investments);
    } else {
      setFilteredInvestments(investments.filter(inv => inv.status === activeFilter));
    }
  }, [activeFilter, investments]);

  const fetchInvestments = async () => {
    try {
      const response = await axios.get('/api/admin/investments');
      setInvestments(response.data.investments);
      setFilteredInvestments(response.data.investments);
    } catch (error) {
      console.error('Error fetching investments:', error);
      toast.error('Failed to load investments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (investment: Investment) => {
    setSelectedInvestment(investment);
    setNewStatus(investment.status);
    setAdminNote('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedInvestment(null);
    setNewStatus('');
    setAdminNote('');
  };

  const handleUpdateStatus = async () => {
    if (!selectedInvestment || !newStatus) return;

    if (newStatus === selectedInvestment.status) {
      toast.error('Please select a different status');
      return;
    }

    setIsUpdating(true);

    try {
      await axios.put('/api/admin/investments', {
        id: selectedInvestment.id,
        status: newStatus,
        adminNote: adminNote || undefined
      });

      toast.success('Investment status updated successfully');
      handleCloseModal();
      fetchInvestments();
    } catch (error: any) {
      console.error('Error updating investment:', error);
      toast.error(error.response?.data?.error || 'Failed to update investment status');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'ACTIVE':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'FAILED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPaymentMethodBadge = (method: string) => {
    if (method === 'BANK_WALLET') {
      return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">Bank Wallet</span>;
    }
    return <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">Crypto</span>;
  };

  const calculateExpectedReturn = (investment: Investment) => {
    return investment.amount * (investment.plan.profitPercentage / 100);
  };

  const stats = {
    total: investments.length,
    pending: investments.filter(inv => inv.status === 'PENDING').length,
    active: investments.filter(inv => inv.status === 'ACTIVE').length,
    completed: investments.filter(inv => inv.status === 'COMPLETED').length,
    totalAmount: investments.reduce((sum, inv) => sum + inv.amount, 0),
    totalProfit: investments.reduce((sum, inv) => sum + inv.profitEarned, 0)
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 md:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Investment Management</h1>
          <p className="text-gray-600 mt-1">Review and manage all user investments</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs text-gray-600 mb-1">Total</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl shadow-sm border border-yellow-200 p-4">
            <p className="text-xs text-yellow-800 mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-900">{stats.pending}</p>
          </div>
          <div className="bg-green-50 rounded-xl shadow-sm border border-green-200 p-4">
            <p className="text-xs text-green-800 mb-1">Active</p>
            <p className="text-2xl font-bold text-green-900">{stats.active}</p>
          </div>
          <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-200 p-4">
            <p className="text-xs text-blue-800 mb-1">Completed</p>
            <p className="text-2xl font-bold text-blue-900">{stats.completed}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs text-gray-600 mb-1">Total Amount</p>
            <p className="text-xl font-bold text-gray-900">${stats.totalAmount.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs text-gray-600 mb-1">Total Profit</p>
            <p className="text-xl font-bold text-green-600">${stats.totalProfit.toLocaleString()}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['ALL', 'PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'FAILED'].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter as any)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all text-sm ${
                activeFilter === filter
                  ? 'bg-[#c1ff72] text-black'
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Investments Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Payment</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Expected Return</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInvestments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      No investments found
                    </td>
                  </tr>
                ) : (
                  filteredInvestments.map((investment) => (
                    <tr key={investment.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="text-sm font-semibold text-gray-900">
                          {investment.user.name || investment.user.email}
                        </div>
                        <div className="text-xs text-gray-500">{investment.user.email}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900">{investment.plan.planName}</div>
                        <div className="text-xs text-gray-500">{investment.plan.duration} days • {investment.plan.profitPercentage}%</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-semibold text-gray-900">${investment.amount.toLocaleString()}</div>
                      </td>
                      <td className="px-4 py-4">
                        {getPaymentMethodBadge(investment.paymentMethod)}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(investment.status)}`}>
                          {investment.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-semibold text-green-600">
                          ${calculateExpectedReturn(investment).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-xs text-gray-600">
                          {new Date(investment.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => handleOpenModal(investment)}
                          className="px-3 py-1.5 bg-[#c1ff72] text-black text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Status Update Modal */}
      {showModal && selectedInvestment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Manage Investment</h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Investment Details */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">User</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedInvestment.user.name || selectedInvestment.user.email}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Plan</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedInvestment.plan.planName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Amount</p>
                    <p className="text-sm font-semibold text-gray-900">${selectedInvestment.amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Payment Method</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedInvestment.paymentMethod === 'BANK_WALLET' ? 'Bank Wallet' : 'Crypto'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Current Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(selectedInvestment.status)}`}>
                      {selectedInvestment.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Expected Return</p>
                    <p className="text-sm font-semibold text-green-600">
                      ${calculateExpectedReturn(selectedInvestment).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Update */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Update Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                >
                  <option value="PENDING">Pending</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="FAILED">Failed</option>
                </select>
                <div className="mt-2 text-xs text-gray-600">
                  {newStatus === 'ACTIVE' && '✓ Will set start and end dates'}
                  {newStatus === 'COMPLETED' && '✓ Will calculate profit and credit user account'}
                  {(newStatus === 'CANCELLED' || newStatus === 'FAILED') && '✓ Will refund investment amount'}
                </div>
              </div>

              {/* Admin Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Note (Optional)
                </label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                  rows={3}
                  placeholder="Add a note for the user (will be included in notification)"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateStatus}
                  disabled={isUpdating || newStatus === selectedInvestment.status}
                  className="flex-1 px-6 py-3 bg-[#c1ff72] text-black font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdating ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
