'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { DashboardTopBar } from '@/components/layout/DashboardTopBar';
import { sidebarItems } from '@/config/sidebar.config';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  authorizationCode: string;
}

interface Loan {
  id: string;
  fromDate: string;
  fullName: string;
  amount: number;
  duration: number;
  loanType: string;
  reason: string;
  status: string;
  adminNotes?: string;
  approvedAt?: string;
  rejectedAt?: string;
  createdAt: string;
}

export default function LoanStatusPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.role === 'ADMIN') {
      router.push('/admin/dashboard');
      return;
    }

    setUser(parsedUser);
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchLoans();
    }
  }, [user]);

  const fetchLoans = async () => {
    if (!user) return;

    try {
      const response = await axios.get(`/api/loans?userId=${user.id}`);
      setLoans(response.data.loans);
    } catch (error) {
      console.error('Error fetching loans:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
      APPROVED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approved' },
      REJECTED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
      DISBURSED: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Disbursed' },
      COMPLETED: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Completed' },
      CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelled' },
    };

    const badge = badges[status] || badges.PENDING;
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getLoanTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      PERSONAL: 'Personal Loan',
      BUSINESS: 'Business Loan',
      AUTO: 'Auto Loan',
      HOME: 'Home Loan',
      EDUCATION: 'Education Loan',
      MEDICAL: 'Medical Loan',
      EMERGENCY: 'Emergency Loan',
    };
    return labels[type] || type;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredLoans = filter === 'ALL' 
    ? loans 
    : loans.filter(loan => loan.status === filter);

  if (!user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c1ff72]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardSidebar 
        items={sidebarItems}
        userId={user.id}
        onCollapseChange={setSidebarCollapsed}
        isMobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <DashboardTopBar 
        user={user} 
        sidebarCollapsed={sidebarCollapsed}
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Main Content */}
      <main className={`pt-16 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <div className="p-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-[#c1ff72] rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 md:w-6 md:h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg md:text-2xl font-bold text-gray-900">Loan Status</h1>
                  <p className="text-sm md:text-base text-gray-600 hidden sm:block">Track your loan applications</p>
                </div>
              </div>
              <button
                onClick={() => router.push('/dashboard/loan/application')}
                className="bg-[#c1ff72] text-black font-semibold py-2 px-4 md:px-6 rounded-lg hover:bg-[#b0ef62] transition-colors text-sm md:text-base whitespace-nowrap"
              >
                <span className="md:hidden">New</span>
                <span className="hidden md:inline">New Application</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm p-3 md:p-4 mb-6">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'DISBURSED'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-3 md:px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors text-sm ${
                    filter === status
                      ? 'bg-[#c1ff72] text-black'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Loan Applications List */}
          <div className="space-y-3 md:space-y-4">
            {filteredLoans.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-8 md:p-12 text-center">
                <svg className="w-12 h-12 md:w-16 md:h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2">No loan applications found</h3>
                <p className="text-sm md:text-base text-gray-600 mb-6">
                  {filter === 'ALL' 
                    ? "You haven't submitted any loan applications yet."
                    : `No ${filter.toLowerCase()} loan applications found.`
                  }
                </p>
                <button
                  onClick={() => router.push('/dashboard/loan/application')}
                  className="bg-[#c1ff72] text-black font-semibold py-2 px-6 rounded-lg hover:bg-[#b0ef62] transition-colors text-sm md:text-base"
                >
                  Apply for Loan
                </button>
              </div>
            ) : (
              filteredLoans.map((loan) => (
                <div key={loan.id} className="bg-white rounded-lg shadow-sm p-4 md:p-6 hover:shadow-md transition-shadow">
                  {/* Mobile Compact View */}
                  <div className="md:hidden">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-bold text-gray-900">
                            {getLoanTypeLabel(loan.loanType)}
                          </h3>
                          {getStatusBadge(loan.status)}
                        </div>
                        <p className="text-xs text-gray-500">
                          {formatDate(loan.createdAt)}
                        </p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="text-lg font-bold text-gray-900">
                          ${loan.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-600">{loan.duration}mo</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedLoan(loan)}
                      className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      <span>View Details</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  {/* Desktop Full View */}
                  <div className="hidden md:block">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">
                            {getLoanTypeLabel(loan.loanType)}
                          </h3>
                          {getStatusBadge(loan.status)}
                        </div>
                        <p className="text-sm text-gray-600">
                          Applied on {formatDate(loan.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">
                          ${loan.amount.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">{loan.duration} months</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Applicant Name</p>
                        <p className="font-medium text-gray-900">{loan.fullName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Start Date</p>
                        <p className="font-medium text-gray-900">{formatDate(loan.fromDate)}</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-1">Reason</p>
                      <p className="text-gray-900">{loan.reason}</p>
                    </div>

                    {loan.adminNotes && (
                      <div className={`p-4 rounded-lg ${
                        loan.status === 'APPROVED' ? 'bg-green-50' : 'bg-red-50'
                      }`}>
                        <p className="text-sm font-medium mb-1">
                          {loan.status === 'APPROVED' ? 'Approval Notes' : 'Admin Notes'}
                        </p>
                        <p className="text-sm text-gray-700">{loan.adminNotes}</p>
                      </div>
                    )}

                    {loan.approvedAt && (
                      <p className="text-sm text-gray-600 mt-4">
                        Approved on {formatDate(loan.approvedAt)}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Mobile Detail Modal */}
          {selectedLoan && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
              <div className="bg-white w-full md:max-w-2xl md:rounded-lg rounded-t-2xl max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900">Loan Details</h2>
                  <button
                    onClick={() => setSelectedLoan(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-4 space-y-4">
                  {/* Header Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                          {getLoanTypeLabel(selectedLoan.loanType)}
                        </h3>
                        {getStatusBadge(selectedLoan.status)}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">
                          ${selectedLoan.amount.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">{selectedLoan.duration} months</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">
                      Applied on {formatDate(selectedLoan.createdAt)}
                    </p>
                  </div>

                  {/* Details Grid */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Applicant Name</p>
                      <p className="font-medium text-gray-900">{selectedLoan.fullName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Start Date</p>
                      <p className="font-medium text-gray-900">{formatDate(selectedLoan.fromDate)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Loan Amount</p>
                      <p className="font-medium text-gray-900">${selectedLoan.amount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Duration</p>
                      <p className="font-medium text-gray-900">{selectedLoan.duration} months</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Reason for Loan</p>
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedLoan.reason}</p>
                    </div>
                  </div>

                  {/* Admin Notes */}
                  {selectedLoan.adminNotes && (
                    <div className={`p-4 rounded-lg ${
                      selectedLoan.status === 'APPROVED' ? 'bg-green-50' : 'bg-red-50'
                    }`}>
                      <p className="text-sm font-medium mb-2">
                        {selectedLoan.status === 'APPROVED' ? 'Approval Notes' : 'Admin Notes'}
                      </p>
                      <p className="text-sm text-gray-700">{selectedLoan.adminNotes}</p>
                    </div>
                  )}

                  {/* Approval Date */}
                  {selectedLoan.approvedAt && (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Approval Date</p>
                      <p className="font-medium text-gray-900">{formatDate(selectedLoan.approvedAt)}</p>
                    </div>
                  )}

                  {/* Rejection Date */}
                  {selectedLoan.rejectedAt && (
                    <div className="bg-red-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Rejection Date</p>
                      <p className="font-medium text-gray-900">{formatDate(selectedLoan.rejectedAt)}</p>
                    </div>
                  )}

                  {/* Close Button */}
                  <button
                    onClick={() => setSelectedLoan(null)}
                    className="w-full py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
