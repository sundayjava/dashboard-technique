'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FileCheck, Loader2, Search, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';

interface LoanApplication {
  id: string;
  userId: string;
  fromDate: string;
  fullName: string;
  amount: number;
  duration: number;
  loanType: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNotes: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    authorizationCode: string;
  };
}

export default function LoanManagementPage() {
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/loans');
      setLoans(response.data.loans || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fetch loan applications');
      setLoans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveLoan = async (loanId: string) => {
    if (!confirm('Are you sure you want to approve this loan application?')) return;

    const adminId = localStorage.getItem('userId');
    try {
      await axios.patch(`/api/loans/${loanId}`, { 
        status: 'APPROVED',
        approvedBy: adminId
      });
      toast.success('Loan approved successfully');
      fetchLoans();
      setShowModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to approve loan');
    }
  };

  const handleRejectLoan = async (loanId: string) => {
    const notes = prompt('Please provide a reason for rejection:');
    if (!notes) return;

    try {
      await axios.patch(`/api/loans/${loanId}`, { 
        status: 'REJECTED',
        adminNotes: notes
      });
      toast.success('Loan rejected');
      fetchLoans();
      setShowModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reject loan');
    }
  };

  const filteredLoans = loans.filter(loan => {
    const matchesSearch = 
      loan.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      loan.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
      loan.loanType?.toLowerCase().includes(search.toLowerCase()) ||
      loan.reason?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || loan.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle className="w-4 h-4" />;
      case 'REJECTED':
        return <XCircle className="w-4 h-4" />;
      case 'PENDING':
        return <Clock className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading loan applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Loan Applications</h1>
        <p className="mt-2 text-gray-600">Review and approve user loan applications</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by applicant, email, loan type, or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">
                {loans.filter(l => l.status === 'PENDING').length}
              </p>
            </div>
            <Clock className="w-12 h-12 text-yellow-600 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">
                {loans.filter(l => l.status === 'APPROVED').length}
              </p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-600 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600">
                {loans.filter(l => l.status === 'REJECTED').length}
              </p>
            </div>
            <XCircle className="w-12 h-12 text-red-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* Loans Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Applicant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Loan Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Applied
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <DollarSign className="w-16 h-16 text-gray-400 mb-2" />
                      <p className="text-gray-900 font-medium text-lg">No loan applications found</p>
                      <p className="text-gray-500 text-sm">
                        {search || statusFilter !== 'ALL' 
                          ? 'Try adjusting your filters' 
                          : 'Loan applications will appear here when users submit them'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLoans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{loan.fullName}</p>
                        <p className="text-xs text-gray-500">{loan.user.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm text-gray-900">{loan.loanType}</p>
                        <p className="text-xs text-gray-500">{loan.duration} months</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-semibold text-gray-900">${loan.amount.toLocaleString()}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(loan.status)}`}>
                        {getStatusIcon(loan.status)}
                        {loan.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(loan.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => {
                          setSelectedLoan(loan);
                          setShowModal(true);
                        }}
                        className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        <FileCheck className="w-4 h-4 mr-2" />
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Loan Review Modal */}
      {showModal && selectedLoan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Loan Application Review</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-6">
                {/* User Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-3">Applicant Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <p className="font-medium">{selectedLoan.user.name || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Email:</span>
                      <p className="font-medium">{selectedLoan.user.email}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Auth Code:</span>
                      <p className="font-medium font-mono">{selectedLoan.user.authorizationCode}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Applied On:</span>
                      <p className="font-medium">
                        {new Date(selectedLoan.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Loan Details */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Loan Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Full Name on Application:</span>
                      <p className="font-medium">{selectedLoan.fullName}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Loan Type:</span>
                      <p className="font-medium">{selectedLoan.loanType}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Loan Amount:</span>
                      <p className="font-medium text-lg text-blue-600">
                        ${selectedLoan.amount.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Duration:</span>
                      <p className="font-medium">{selectedLoan.duration} months</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Start Date:</span>
                      <p className="font-medium">
                        {new Date(selectedLoan.fromDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Current Status:</span>
                      <p className="font-medium">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedLoan.status)}`}>
                          {selectedLoan.status}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Loan Purpose</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-700">{selectedLoan.reason}</p>
                  </div>
                </div>

                {/* Admin Notes (if any) */}
                {selectedLoan.adminNotes && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Admin Notes</h3>
                    <div className="bg-red-50 p-4 rounded-lg">
                      <p className="text-sm text-red-700">{selectedLoan.adminNotes}</p>
                    </div>
                  </div>
                )}

                {/* Approval/Rejection Information */}
                {selectedLoan.approvedAt && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-green-700">
                      <strong>Approved on:</strong>{' '}
                      {new Date(selectedLoan.approvedAt).toLocaleString()}
                    </p>
                    {selectedLoan.approvedBy && (
                      <p className="text-sm text-green-700 mt-1">
                        <strong>Approved by:</strong> Admin ID {selectedLoan.approvedBy}
                      </p>
                    )}
                  </div>
                )}

                {selectedLoan.rejectedAt && (
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-sm text-red-700">
                      <strong>Rejected on:</strong>{' '}
                      {new Date(selectedLoan.rejectedAt).toLocaleString()}
                    </p>
                  </div>
                )}

                {/* Actions */}
                {selectedLoan.status === 'PENDING' && (
                  <div className="flex gap-4 pt-4 border-t">
                    <button
                      onClick={() => handleApproveLoan(selectedLoan.id)}
                      className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                    >
                      Approve Loan
                    </button>
                    <button
                      onClick={() => handleRejectLoan(selectedLoan.id)}
                      className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                    >
                      Reject Loan
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
