'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { FileCheck, Clock, CheckCircle, XCircle, Eye, User, Calendar } from 'lucide-react';

interface ChequeDeposit {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  chequeImage: string;
  status: string;
  submittedAt: string;
  processedAt: string | null;
  adminNotes: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  authorizationCode: string;
  
}

export default function AdminChequeDepositsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [deposits, setDeposits] = useState<ChequeDeposit[]>([]);
  const [filteredDeposits, setFilteredDeposits] = useState<ChequeDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('PENDING');
  const [selectedDeposit, setSelectedDeposit] = useState<ChequeDeposit | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }

    setUser(parsedUser);
    fetchDeposits();
  }, [router]);

  useEffect(() => {
    if (filterStatus === 'ALL') {
      setFilteredDeposits(deposits);
    } else {
      setFilteredDeposits(deposits.filter(d => d.status === filterStatus));
    }
  }, [filterStatus, deposits]);

  const fetchDeposits = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/cheque-deposits');
      setDeposits(response.data.deposits || []);
    } catch (err: any) {
      console.error('Error fetching deposits:', err);
      toast.error('Failed to fetch cheque deposits');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (deposit: ChequeDeposit) => {
    setSelectedDeposit(deposit);
    setAdminNotes('');
    setShowModal(true);
  };

  const handleApprove = async () => {
    if (!selectedDeposit || !user) return;

    setProcessing(true);
    try {
      await axios.post('/api/admin/cheque-deposits/approve', {
        depositId: selectedDeposit.id,
        adminId: user.id,
        adminNotes: adminNotes || undefined,
      });

      toast.success('Cheque deposit approved successfully');
      setShowModal(false);
      fetchDeposits();
    } catch (err: any) {
      console.error('Error approving deposit:', err);
      toast.error(err.response?.data?.error || 'Failed to approve deposit');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedDeposit || !user) return;

    if (!adminNotes.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setProcessing(true);
    try {
      await axios.post('/api/admin/cheque-deposits/reject', {
        depositId: selectedDeposit.id,
        adminId: user.id,
        adminNotes,
      });

      toast.success('Cheque deposit rejected successfully');
      setShowModal(false);
      fetchDeposits();
    } catch (err: any) {
      console.error('Error rejecting deposit:', err);
      toast.error(err.response?.data?.error || 'Failed to reject deposit');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-4 h-4 mr-1" />
            Pending
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-4 h-4 mr-1" />
            Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircle className="w-4 h-4 mr-1" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c1ff72]"></div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Cheque Deposits Management</h1>
        <p className="text-gray-600 mt-2">Review and process user cheque deposits</p>
      </div>

          {/* Status Filter */}
          <div className="flex gap-4 mb-6">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterStatus === status
                    ? 'bg-[#c1ff72] text-gray-900'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {status}
                {status !== 'ALL' && (
                  <span className="ml-2 px-2 py-0.5 bg-gray-200 rounded-full text-xs">
                    {deposits.filter(d => d.status === status).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Deposits Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c1ff72] mx-auto"></div>
                <p className="text-gray-500 mt-4">Loading deposits...</p>
              </div>
            ) : filteredDeposits.length === 0 ? (
              <div className="text-center py-16">
                <FileCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No {filterStatus.toLowerCase()} deposits found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredDeposits.map((deposit) => (
                      <tr key={deposit.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-gray-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{deposit.user.name}</p>
                              <p className="text-sm text-gray-500">{deposit.user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-900">
                          ${deposit.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {new Date(deposit.submittedAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(deposit.status)}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleViewDetails(deposit)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

      {/* Details Modal */}
      {showModal && selectedDeposit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Cheque Deposit Details</h2>
            </div>

            <div className="p-6 space-y-6">
              {/* User Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">User Name</p>
                  <p className="font-medium text-gray-900">{selectedDeposit.user.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{selectedDeposit.user.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="text-xl font-bold text-gray-900">${selectedDeposit.amount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  {getStatusBadge(selectedDeposit.status)}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Submitted Date</p>
                  <p className="font-medium text-gray-900">
                    {new Date(selectedDeposit.submittedAt).toLocaleString()}
                  </p>
                </div>
                {selectedDeposit.processedAt && (
                  <div>
                    <p className="text-sm text-gray-500">Processed Date</p>
                    <p className="font-medium text-gray-900">
                      {new Date(selectedDeposit.processedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Cheque Image */}
              <div>
                <p className="text-sm text-gray-500 mb-2">Cheque Image</p>
                <img
                  src={selectedDeposit.chequeImage}
                  alt="Cheque"
                  className="w-full border border-gray-300 rounded-lg"
                />
              </div>

              {/* Admin Notes */}
              {selectedDeposit.status === 'PENDING' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Notes {selectedDeposit.status === 'PENDING' && '(Required for rejection)'}
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                    placeholder="Enter notes or rejection reason..."
                  />
                </div>
              )}

              {selectedDeposit.adminNotes && selectedDeposit.status !== 'PENDING' && (
                <div>
                  <p className="text-sm text-gray-500">Admin Notes</p>
                  <p className="font-medium text-gray-900">{selectedDeposit.adminNotes}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-gray-200 flex gap-4">
              {selectedDeposit.status === 'PENDING' ? (
                <>
                  <button
                    onClick={handleApprove}
                    disabled={processing}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    {processing ? 'Processing...' : 'Approve & Credit'}
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={processing}
                    className="flex-1 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-5 h-5" />
                    {processing ? 'Processing...' : 'Reject'}
                  </button>
                </>
              ) : null}
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
