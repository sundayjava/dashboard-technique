'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { CreditCard, Loader2, Search, CheckCircle, XCircle, Clock, Eye, Trash2 } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
}

interface CardApplication {
  id: string;
  userId: string;
  user: User;
  phoneNumber: string;
  accountNumber: string;
  cardType: string;
  status: string;
  adminNotes?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  // Card details
  cardNumber?: string;
  cardBrand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  cvv?: string;
  cardHolderName?: string;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  billingCountry?: string;
}

export default function CardApplicationsPage() {
  const [applications, setApplications] = useState<CardApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<CardApplication | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardBrand, setCardBrand] = useState('VISA');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('');
  const [billingZip, setBillingZip] = useState('');
  const [billingCountry, setBillingCountry] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/card-applications');
      setApplications(response.data.applications || []);
    } catch (err: any) {
      console.error('Error fetching card applications:', err);
      toast.error(err.response?.data?.error || 'Failed to fetch applications');
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Are you sure you want to approve this card application?')) return;

    // Validation for card details
    if (!cardNumber || !cardBrand || !expiryMonth || !expiryYear || !cvv || !cardHolderName) {
      toast.error('Please fill in all card details before approving');
      return;
    }

    if (!billingAddress || !billingCity || !billingState || !billingZip || !billingCountry) {
      toast.error('Please fill in all billing address details before approving');
      return;
    }

    try {
      setProcessing(id);
      await axios.patch(`/api/card-applications/${id}`, {
        status: 'APPROVED',
        adminNotes: adminNotes || undefined,
        cardNumber,
        cardBrand,
        expiryMonth: parseInt(expiryMonth),
        expiryYear: parseInt(expiryYear),
        cvv,
        cardHolderName,
        billingAddress,
        billingCity,
        billingState,
        billingZip,
        billingCountry,
      });
      toast.success('Card application approved successfully');
      setShowDetailsModal(false);
      setSelectedApp(null);
      resetCardForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to approve application');
    } finally {
      setProcessing(null);
    }
  };

  const handleUpdateCard = async (id: string) => {
    if (!confirm('Are you sure you want to update this card details?')) return;

    // Validation for card details
    if (!cardNumber || !cardBrand || !expiryMonth || !expiryYear || !cvv || !cardHolderName) {
      toast.error('Please fill in all card details');
      return;
    }

    if (!billingAddress || !billingCity || !billingState || !billingZip || !billingCountry) {
      toast.error('Please fill in all billing address details');
      return;
    }

    try {
      setProcessing(id);
      await axios.patch(`/api/card-applications/${id}`, {
        adminNotes: adminNotes || undefined,
        cardNumber,
        cardBrand,
        expiryMonth: parseInt(expiryMonth),
        expiryYear: parseInt(expiryYear),
        cvv,
        cardHolderName,
        billingAddress,
        billingCity,
        billingState,
        billingZip,
        billingCountry,
      });
      toast.success('Card details updated successfully');
      setShowDetailsModal(false);
      setSelectedApp(null);
      resetCardForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update card details');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
      setProcessing(id);
      await axios.patch(`/api/card-applications/${id}`, {
        status: 'REJECTED',
        adminNotes: reason,
      });
      toast.success('Card application rejected');
      setShowDetailsModal(false);
      setSelectedApp(null);
      resetCardForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reject application');
    } finally {
      setProcessing(null);
    }
  };

  const resetCardForm = () => {
    setAdminNotes('');
    setCardNumber('');
    setCardBrand('VISA');
    setExpiryMonth('');
    setExpiryYear('');
    setCvv('');
    setCardHolderName('');
    setBillingAddress('');
    setBillingCity('');
    setBillingState('');
    setBillingZip('');
    setBillingCountry('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this application?')) return;

    try {
      await axios.delete(`/api/card-applications/${id}`);
      toast.success('Application deleted successfully');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete application');
    }
  };

  const handleViewDetails = (app: CardApplication) => {
    setSelectedApp(app);
    setAdminNotes(app.adminNotes || '');
    setCardNumber(app.cardNumber || '');
    setCardBrand(app.cardBrand || 'VISA');
    setExpiryMonth(app.expiryMonth?.toString() || '');
    setExpiryYear(app.expiryYear?.toString() || '');
    setCvv(app.cvv || '');
    setCardHolderName(app.cardHolderName || app.user.name || '');
    setBillingAddress(app.billingAddress || '');
    setBillingCity(app.billingCity || '');
    setBillingState(app.billingState || '');
    setBillingZip(app.billingZip || '');
    setBillingCountry(app.billingCountry || '');
    setShowDetailsModal(true);
  };

  const filteredApplications = applications.filter(app => {
    const matchesSearch = 
      (app.user.name?.toLowerCase() || '').includes(search.toLowerCase()) ||
      app.user.email.toLowerCase().includes(search.toLowerCase()) ||
      app.phoneNumber.includes(search) ||
      app.accountNumber.includes(search);
    
    const matchesStatus = statusFilter === 'ALL' || app.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold flex items-center gap-1">
            <Clock className="w-4 h-4" />
            Pending
          </span>
        );
      case 'APPROVED':
      case 'ISSUED':
        return (
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            {status === 'ISSUED' ? 'Issued' : 'Approved'}
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold flex items-center gap-1">
            <XCircle className="w-4 h-4" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-semibold">
            {status}
          </span>
        );
    }
  };

  const getStats = () => {
    return {
      total: applications.length,
      pending: applications.filter(app => app.status === 'PENDING').length,
      approved: applications.filter(app => app.status === 'APPROVED' || app.status === 'ISSUED').length,
      rejected: applications.filter(app => app.status === 'REJECTED').length,
    };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Card Applications</h1>
        <p className="mt-2 text-gray-600">Review and manage user card applications</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Applications</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="text-sm text-yellow-700">Pending</div>
          <div className="text-2xl font-bold text-yellow-900 mt-1">{stats.pending}</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-sm text-green-700">Approved</div>
          <div className="text-2xl font-bold text-green-900 mt-1">{stats.approved}</div>
        </div>
        <div className="bg-red-50 rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="text-sm text-red-700">Rejected</div>
          <div className="text-2xl font-bold text-red-900 mt-1">{stats.rejected}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, email, phone, or account number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="ISSUED">Issued</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredApplications.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-900 font-medium text-lg">No card applications found</p>
            <p className="text-gray-500 mt-2">
              {search || statusFilter !== 'ALL' 
                ? 'Try adjusting your filters' 
                : 'Card applications will appear here when users apply'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Card Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date Applied
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold">
                            {(app.user.name || app.user.email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{app.user.name || 'No name'}</div>
                          <div className="text-sm text-gray-500">{app.user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                        {app.cardType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {app.phoneNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                      {app.accountNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(app.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(app.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewDetails(app)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        {app.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApprove(app.id)}
                              disabled={processing === app.id}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                              title="Approve"
                            >
                              {processing === app.id ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <CheckCircle className="w-5 h-5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleReject(app.id)}
                              disabled={processing === app.id}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                              title="Reject"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(app.id)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedApp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 my-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Application Details</h2>
            
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
              {/* User Info */}
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">User Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600">User Name</label>
                    <p className="text-gray-900 font-semibold">{selectedApp.user.name || 'No name'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Email</label>
                    <p className="text-gray-900">{selectedApp.user.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Phone Number</label>
                    <p className="text-gray-900">{selectedApp.phoneNumber}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Account Number</label>
                    <p className="text-gray-900 font-mono">{selectedApp.accountNumber}</p>
                  </div>
                </div>
              </div>

              {/* Application Info */}
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Application Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Card Type</label>
                    <p className="text-gray-900 font-semibold">{selectedApp.cardType}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Status</label>
                    <div className="mt-1">{getStatusBadge(selectedApp.status)}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Date Applied</label>
                    <p className="text-gray-900">{new Date(selectedApp.createdAt).toLocaleString()}</p>
                  </div>
                  {selectedApp.approvedAt && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Date Approved</label>
                      <p className="text-gray-900">{new Date(selectedApp.approvedAt).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedApp.rejectedAt && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Date Rejected</label>
                      <p className="text-gray-900">{new Date(selectedApp.rejectedAt).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Details */}
              {(selectedApp.status === 'PENDING' || selectedApp.cardNumber) && (
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Card Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Card Holder Name *</label>
                      <input
                        type="text"
                        value={cardHolderName}
                        onChange={(e) => setCardHolderName(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="JOHN DOE"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Card Brand *</label>
                      <select
                        value={cardBrand}
                        onChange={(e) => setCardBrand(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="VISA">VISA</option>
                        <option value="MASTERCARD">MASTERCARD</option>
                        <option value="AMEX">AMEX</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Card Number (16 digits) *</label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          if (value.length <= 16) setCardNumber(value);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                        placeholder="1234567812345678"
                        maxLength={16}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">CVV (3-4 digits) *</label>
                      <input
                        type="text"
                        value={cvv}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          if (value.length <= 4) setCvv(value);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                        placeholder="123"
                        maxLength={4}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Expiry Month (MM) *</label>
                      <input
                        type="text"
                        value={expiryMonth}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          if (value.length <= 2 && (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 12))) {
                            setExpiryMonth(value);
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="12"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Expiry Year (YYYY) *</label>
                      <input
                        type="text"
                        value={expiryYear}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          if (value.length <= 4) setExpiryYear(value);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="2028"
                        maxLength={4}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Billing Address */}
              {(selectedApp.status === 'PENDING' || selectedApp.billingAddress) && (
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Billing Address</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Street Address *</label>
                      <input
                        type="text"
                        value={billingAddress}
                        onChange={(e) => setBillingAddress(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="123 Main Street"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">City *</label>
                      <input
                        type="text"
                        value={billingCity}
                        onChange={(e) => setBillingCity(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="New York"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">State/Province *</label>
                      <input
                        type="text"
                        value={billingState}
                        onChange={(e) => setBillingState(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="NY"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">ZIP/Postal Code *</label>
                      <input
                        type="text"
                        value={billingZip}
                        onChange={(e) => setBillingZip(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="10001"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Country *</label>
                      <input
                        type="text"
                        value={billingCountry}
                        onChange={(e) => setBillingCountry(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="United States"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Admin Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Add notes (optional)"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 mt-6 pt-4 border-t">
              {selectedApp.status === 'PENDING' && (
                <>
                  <button
                    onClick={() => handleApprove(selectedApp.id)}
                    disabled={processing === selectedApp.id}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processing === selectedApp.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Approve & Issue Card
                  </button>
                  <button
                    onClick={() => handleReject(selectedApp.id)}
                    disabled={processing === selectedApp.id}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </>
              )}
              {(selectedApp.status === 'APPROVED' || selectedApp.status === 'ISSUED') && (
                <button
                  onClick={() => handleUpdateCard(selectedApp.id)}
                  disabled={processing === selectedApp.id}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processing === selectedApp.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Update Card Details
                </button>
              )}
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedApp(null);
                  resetCardForm();
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
