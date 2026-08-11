'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  Search, Filter, Download, Eye, Check, X, Edit, Trash2,
  Loader2, AlertCircle, ChevronDown, ChevronUp, DollarSign,
  Calendar, User, Building, MapPin, Coins
} from 'lucide-react';

interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  method: 'BANK' | 'CRYPTO';
  beneficiaryName: string | null;
  beneficiaryEmail: string | null;
  beneficiaryPhone: string | null;
  bankName: string | null;
  bankAddress: string | null;
  accountNumber: string | null;
  swiftCode: string | null;
  iban: string | null;
  routingNumber: string | null;
  sortCode: string | null;
  beneficiaryAddress: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  countryCode: string | null;
  cryptoToken: string | null;
  cryptoNetwork: string | null;
  cryptoAddress: string | null;
  reference: string;
  status: string;
  description: string | null;
  fee: number;
  totalAmount: number;
  adminNotes: string | null;
  processedBy: string | null;
  processedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    name: string | null;
    email: string;
  };
}

export default function AdminWithdrawalsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [filteredWithdrawals, setFilteredWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);

      if (parsedUser.role !== 'ADMIN') {
        router.push('/dashboard');
        return;
      }

      fetchWithdrawals();
    }
  }, [router]);

  useEffect(() => {
    filterWithdrawals();
  }, [searchTerm, statusFilter, withdrawals]);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/withdrawals');
      setWithdrawals(response.data.withdrawals || []);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterWithdrawals = () => {
    let filtered = [...withdrawals];

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(w => w.status === statusFilter);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(w =>
        w.reference.toLowerCase().includes(term) ||
        w.beneficiaryName?.toLowerCase().includes(term) ||
        w.user.email.toLowerCase().includes(term) ||
        w.user.name?.toLowerCase().includes(term) ||
        w.bankName?.toLowerCase().includes(term) ||
        w.cryptoToken?.toLowerCase().includes(term) ||
        w.cryptoAddress?.toLowerCase().includes(term)
      );
    }

    setFilteredWithdrawals(filtered);
  };

  const handleApprove = async () => {
    if (!selectedWithdrawal) return;

    setProcessing(true);
    try {
      await axios.put(`/api/admin/withdrawals/${selectedWithdrawal.id}`, {
        action: 'approve',
        adminNotes
      });

      alert('Withdrawal approved successfully');
      setShowApproveModal(false);
      setSelectedWithdrawal(null);
      setAdminNotes('');
      fetchWithdrawals();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to approve withdrawal');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedWithdrawal || !rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    setProcessing(true);
    try {
      await axios.put(`/api/admin/withdrawals/${selectedWithdrawal.id}`, {
        action: 'reject',
        rejectionReason,
        adminNotes
      });

      alert('Withdrawal rejected successfully');
      setShowRejectModal(false);
      setSelectedWithdrawal(null);
      setRejectionReason('');
      setAdminNotes('');
      fetchWithdrawals();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to reject withdrawal');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (withdrawal: Withdrawal) => {
    if (!confirm(`Are you sure you want to delete withdrawal ${withdrawal.reference}?`)) {
      return;
    }

    try {
      await axios.delete(`/api/admin/withdrawals/${withdrawal.id}`);
      alert('Withdrawal deleted successfully');
      fetchWithdrawals();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete withdrawal');
    }
  };

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      APPROVED: 'bg-green-100 text-green-800',
      COMPLETED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  const stats = {
    total: withdrawals.length,
    pending: withdrawals.filter(w => w.status === 'PENDING').length,
    approved: withdrawals.filter(w => w.status === 'APPROVED' || w.status === 'COMPLETED').length,
    rejected: withdrawals.filter(w => w.status === 'REJECTED').length,
    totalAmount: withdrawals.reduce((sum, w) => sum + w.amount, 0)
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Withdrawal Management</h1>
        <p className="text-gray-600 mt-2">Manage and process user withdrawal requests</p>
      </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600">Total Requests</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <p className="text-sm text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-600">Approved</p>
            <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <p className="text-sm text-gray-600">Rejected</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <p className="text-sm text-gray-600">Total Amount</p>
            <p className="text-2xl font-bold text-purple-600">${stats.totalAmount.toLocaleString()}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by reference, name, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="APPROVED">Approved</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <button
              onClick={fetchWithdrawals}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
            >
              <Download className="w-5 h-5 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Withdrawals Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredWithdrawals.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No withdrawal requests found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Reference</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Method</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Beneficiary</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredWithdrawals.map((withdrawal, index) => (
                    <Fragment key={withdrawal.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <button
                              onClick={() => toggleRowExpansion(withdrawal.id)}
                              className="mr-2 text-gray-400 hover:text-gray-600"
                            >
                              {expandedRows.has(withdrawal.id) ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                            <span className="font-mono text-sm font-semibold text-blue-600">
                              {withdrawal.reference}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{withdrawal.user.name || 'N/A'}</p>
                            <p className="text-xs text-gray-500">{withdrawal.user.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              {withdrawal.currency} {withdrawal.amount.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">
                              Fee: {withdrawal.currency} {withdrawal.fee.toFixed(2)}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {withdrawal.method === 'CRYPTO' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                              <Coins className="w-3 h-3" />
                              Crypto
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                              <Building className="w-3 h-3" />
                              Bank
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {withdrawal.method === 'CRYPTO' ? (
                            <div>
                              <p className="text-sm font-medium text-gray-900">{withdrawal.cryptoToken}</p>
                              <p className="text-xs text-gray-500 font-mono truncate max-w-[160px]">{withdrawal.cryptoAddress}</p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-sm font-medium text-gray-900">{withdrawal.beneficiaryName}</p>
                              <p className="text-xs text-gray-500">{withdrawal.bankName}</p>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(withdrawal.status)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-900">
                            {new Date(withdrawal.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(withdrawal.createdAt).toLocaleTimeString()}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedWithdrawal(withdrawal);
                                setShowDetailsModal(true);
                              }}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {withdrawal.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedWithdrawal(withdrawal);
                                    setShowApproveModal(true);
                                  }}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  title="Approve"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedWithdrawal(withdrawal);
                                    setShowRejectModal(true);
                                  }}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  title="Reject"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDelete(withdrawal)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedRows.has(withdrawal.id) && (
                        <tr>
                          <td colSpan={8} className="px-4 py-4 bg-gray-50">
                            {withdrawal.method === 'CRYPTO' ? (
                              <div>
                                <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                                  <Coins className="w-4 h-4 mr-2" />
                                  Crypto Wallet Details
                                </h4>
                                <dl className="space-y-1 text-sm">
                                  <div className="flex">
                                    <dt className="font-medium text-gray-600 w-32">Token:</dt>
                                    <dd className="text-gray-900">{withdrawal.cryptoToken}</dd>
                                  </div>
                                  <div className="flex">
                                    <dt className="font-medium text-gray-600 w-32">Network:</dt>
                                    <dd className="text-gray-900">{withdrawal.cryptoNetwork}</dd>
                                  </div>
                                  <div className="flex">
                                    <dt className="font-medium text-gray-600 w-32">Address:</dt>
                                    <dd className="text-gray-900 font-mono break-all">{withdrawal.cryptoAddress}</dd>
                                  </div>
                                </dl>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                                    <Building className="w-4 h-4 mr-2" />
                                    Bank Details
                                  </h4>
                                  <dl className="space-y-1">
                                    <div className="flex">
                                      <dt className="font-medium text-gray-600 w-32">Account:</dt>
                                      <dd className="text-gray-900">{withdrawal.accountNumber}</dd>
                                    </div>
                                    <div className="flex">
                                      <dt className="font-medium text-gray-600 w-32">SWIFT:</dt>
                                      <dd className="text-gray-900">{withdrawal.swiftCode}</dd>
                                    </div>
                                    {withdrawal.iban && (
                                      <div className="flex">
                                        <dt className="font-medium text-gray-600 w-32">IBAN:</dt>
                                        <dd className="text-gray-900">{withdrawal.iban}</dd>
                                      </div>
                                    )}
                                    {withdrawal.routingNumber && (
                                      <div className="flex">
                                        <dt className="font-medium text-gray-600 w-32">Routing:</dt>
                                        <dd className="text-gray-900">{withdrawal.routingNumber}</dd>
                                      </div>
                                    )}
                                  </dl>
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                                    <MapPin className="w-4 h-4 mr-2" />
                                    Address
                                  </h4>
                                  <p className="text-gray-900">
                                    {withdrawal.beneficiaryAddress}<br />
                                    {withdrawal.city}, {withdrawal.state} {withdrawal.zipCode}<br />
                                    {withdrawal.countryCode}
                                  </p>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      {/* Details Modal */}
      {showDetailsModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Withdrawal Details</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Reference</label>
                  <p className="text-gray-900 font-mono">{selectedWithdrawal.reference}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedWithdrawal.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Amount</label>
                  <p className="text-gray-900 font-bold">
                    {selectedWithdrawal.currency} {selectedWithdrawal.amount.toFixed(2)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Total (incl. fee)</label>
                  <p className="text-gray-900 font-bold">
                    {selectedWithdrawal.currency} {selectedWithdrawal.totalAmount.toFixed(2)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Method</label>
                  <p className="text-gray-900 font-bold">
                    {selectedWithdrawal.method === 'CRYPTO' ? 'Crypto Withdrawal' : 'Bank Transfer'}
                  </p>
                </div>
              </div>

              <hr />

              {selectedWithdrawal.method === 'CRYPTO' ? (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Crypto Wallet Information</h3>
                  <dl className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Token</dt>
                      <dd className="text-gray-900">{selectedWithdrawal.cryptoToken}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Network</dt>
                      <dd className="text-gray-900">{selectedWithdrawal.cryptoNetwork}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-sm font-medium text-gray-600">Wallet Address</dt>
                      <dd className="text-gray-900 font-mono break-all">{selectedWithdrawal.cryptoAddress}</dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Beneficiary Information</h3>
                    <dl className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-600">Name</dt>
                        <dd className="text-gray-900">{selectedWithdrawal.beneficiaryName}</dd>
                      </div>
                      {selectedWithdrawal.beneficiaryEmail && (
                        <div>
                          <dt className="text-sm font-medium text-gray-600">Email</dt>
                          <dd className="text-gray-900">{selectedWithdrawal.beneficiaryEmail}</dd>
                        </div>
                      )}
                      {selectedWithdrawal.beneficiaryPhone && (
                        <div>
                          <dt className="text-sm font-medium text-gray-600">Phone</dt>
                          <dd className="text-gray-900">{selectedWithdrawal.beneficiaryPhone}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <hr />

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Bank Information</h3>
                    <dl className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-600">Bank Name</dt>
                        <dd className="text-gray-900">{selectedWithdrawal.bankName}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-600">Account Number</dt>
                        <dd className="text-gray-900 font-mono">{selectedWithdrawal.accountNumber}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-600">SWIFT Code</dt>
                        <dd className="text-gray-900 font-mono">{selectedWithdrawal.swiftCode}</dd>
                      </div>
                      {selectedWithdrawal.iban && (
                        <div>
                          <dt className="text-sm font-medium text-gray-600">IBAN</dt>
                          <dd className="text-gray-900 font-mono">{selectedWithdrawal.iban}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </>
              )}

              {selectedWithdrawal.description && (
                <>
                  <hr />
                  <div>
                    <label className="text-sm font-medium text-gray-600">Description</label>
                    <p className="text-gray-900">{selectedWithdrawal.description}</p>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Approve Withdrawal</h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to approve this withdrawal request for {selectedWithdrawal.currency} {selectedWithdrawal.amount.toFixed(2)}?
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes (Optional)</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Add any notes..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowApproveModal(false);
                  setAdminNotes('');
                }}
                disabled={processing}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400 flex items-center justify-center"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Approve
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Reject Withdrawal</h2>
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejecting this withdrawal request.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Explain why this request is being rejected..."
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes (Optional)</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Add any notes..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setAdminNotes('');
                }}
                disabled={processing}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 flex items-center justify-center"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4 mr-2" />
                    Reject
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
