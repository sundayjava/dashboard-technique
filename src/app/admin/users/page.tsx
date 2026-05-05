'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Settings, Trash2, Edit2, FileCheck, ZoomIn, X } from 'lucide-react';
import { ManageUserModal } from '@/components/modals/ManageUserModal';

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  canTransfer: boolean;
  accountDisabled: boolean;
  isVerified: boolean;
  requireOTPForInternational: boolean;
  phoneNumber: string;
  authorizationCode: string;
  createdAt: string;
  accounts?: Array<{
    id: string;
    accountNumber: string;
    accountName: string;
    balance: number;
    currency: string;
  }>;
}

interface KYCSubmission {
  id: string;
  userId: string;
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  documentType: string;
  documentNumber: string;
  documentFrontImage: string;
  documentBackImage: string | null;
  selfieImage: string;
  occupation: string | null;
  employerName: string | null;
  annualIncome: string | null;
  sourceOfFunds: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  submittedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'users' | 'kyc'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [kycSubmissions, setKycSubmissions] = useState<KYCSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedKyc, setSelectedKyc] = useState<KYCSubmission | null>(null);
  const [showKycModal, setShowKycModal] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else {
      fetchKycSubmissions();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/users');
      const usersData = response.data.users || [];
      setUsers(usersData);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fetch users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchKycSubmissions = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/kyc');
      setKycSubmissions(response.data.submissions || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fetch KYC submissions');
      setKycSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveKyc = async (kycId: string) => {
    if (!confirm('Are you sure you want to approve this KYC submission?')) return;

    try {
      await axios.patch(`/api/kyc/${kycId}`, { status: 'APPROVED' });
      toast.success('KYC approved successfully');
      fetchKycSubmissions();
      setShowKycModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to approve KYC');
    }
  };

  const handleRejectKyc = async (kycId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
      await axios.patch(`/api/kyc/${kycId}`, { 
        status: 'REJECTED',
        rejectionReason: reason
      });
      toast.success('KYC rejected');
      fetchKycSubmissions();
      setShowKycModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reject KYC');
    }
  };

  const handleEditUser = (userId: string) => {
    router.push(`/admin/users/${userId}/edit`);
  };

  const handleManageUser = (user: User) => {
    setSelectedUser(user);
    setShowManageModal(true);
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName || 'this user'}? This action cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`/api/admin/users/${userId}`);
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleModalClose = () => {
    setShowManageModal(false);
    setSelectedUser(null);
    fetchUsers(); // Refresh the users list
  };

  const filteredUsers = users.filter((user) => {
    // Filter out admin accounts
    if (user.role === 'ADMIN') return false;

    const matchesSearch =
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.authorizationCode?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const filteredKyc = kycSubmissions.filter((kyc) => {
    const matchesSearch =
      kyc.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kyc.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kyc.documentNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="mt-2 text-gray-600">
            Manage users, permissions, account transactions, and KYC verifications
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'users'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                All Users
              </button>
              <button
                onClick={() => setActiveTab('kyc')}
                className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'kyc'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                KYC Verifications
              </button>
            </nav>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search {activeTab === 'users' ? 'Users' : 'KYC Submissions'}
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                activeTab === 'users'
                  ? 'Search by name, email, or authorization code...'
                  : 'Search by name, email, or document number...'
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Content */}
        {activeTab === 'users' ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Auth Code
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900 truncate max-w-37.5 sm:max-w-none">
                              {user.name || 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500 truncate max-w-37.5 sm:max-w-none">{user.email}</p>
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-mono text-gray-600">{user.authorizationCode}</p>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            {user.accountDisabled ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                Disabled
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                Active
                              </span>
                            )}
                            {user.isVerified && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                Verified
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditUser(user.id)}
                              title="Edit user details"
                              className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleManageUser(user)}
                              title="Manage permissions"
                              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id, user.name || user.email)}
                              title="Delete user"
                              className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Applicant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Document
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submitted
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredKyc.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        No KYC submissions found
                      </td>
                    </tr>
                  ) : (
                    filteredKyc.map((kyc) => (
                      <tr key={kyc.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{kyc.fullName}</p>
                            <p className="text-xs text-gray-500">{kyc.user.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm text-gray-900">{kyc.documentType}</p>
                            <p className="text-xs text-gray-500 font-mono">{kyc.documentNumber}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              kyc.status === 'APPROVED'
                                ? 'bg-green-100 text-green-800'
                                : kyc.status === 'REJECTED'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {kyc.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(kyc.submittedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => {
                              setSelectedKyc(kyc);
                              setShowKycModal(true);
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
        )}
      </div>

      {/* Modals */}
      <ManageUserModal
        user={selectedUser}
        isOpen={showManageModal}
        onClose={handleModalClose}
      />

      {/* KYC Review Modal */}
      {showKycModal && selectedKyc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">KYC Review</h2>
                  <p className="text-gray-600 mt-1">
                    Submitted on {new Date(selectedKyc.submittedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => setShowKycModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* User Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">User Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <p className="font-medium">{selectedKyc.user.name || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Email:</span>
                      <p className="font-medium">{selectedKyc.user.email}</p>
                    </div>
                  </div>
                </div>

                {/* Personal Details */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Personal Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Full Name:</span>
                      <p className="font-medium">{selectedKyc.fullName}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Date of Birth:</span>
                      <p className="font-medium">
                        {new Date(selectedKyc.dateOfBirth).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Nationality:</span>
                      <p className="font-medium">{selectedKyc.nationality}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Document Type:</span>
                      <p className="font-medium">{selectedKyc.documentType}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-600">Document Number:</span>
                      <p className="font-medium font-mono">{selectedKyc.documentNumber}</p>
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Address</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="col-span-2">
                      <span className="text-gray-600">Street Address:</span>
                      <p className="font-medium">{selectedKyc.address}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">City:</span>
                      <p className="font-medium">{selectedKyc.city}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">State:</span>
                      <p className="font-medium">{selectedKyc.state}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Postal Code:</span>
                      <p className="font-medium">{selectedKyc.postalCode}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Country:</span>
                      <p className="font-medium">{selectedKyc.country}</p>
                    </div>
                  </div>
                </div>

                {/* Documents */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Verification Documents</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Document Front</p>
                      <div className="relative group">
                        <img
                          src={selectedKyc.documentFrontImage}
                          alt="Document Front"
                          className="w-full h-48 object-cover rounded-lg border"
                        />
                        <button
                          onClick={() => setZoomedImage(selectedKyc.documentFrontImage)}
                          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                        >
                          <ZoomIn className="w-8 h-8 text-white" />
                        </button>
                      </div>
                    </div>

                    {selectedKyc.documentBackImage && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Document Back</p>
                        <div className="relative group">
                          <img
                            src={selectedKyc.documentBackImage}
                            alt="Document Back"
                            className="w-full h-48 object-cover rounded-lg border"
                          />
                          <button
                            onClick={() => setZoomedImage(selectedKyc.documentBackImage!)}
                            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                          >
                            <ZoomIn className="w-8 h-8 text-white" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-sm text-gray-600 mb-2">Selfie</p>
                      <div className="relative group">
                        <img
                          src={selectedKyc.selfieImage}
                          alt="Selfie"
                          className="w-full h-48 object-cover rounded-lg border"
                        />
                        <button
                          onClick={() => setZoomedImage(selectedKyc.selfieImage)}
                          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                        >
                          <ZoomIn className="w-8 h-8 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {selectedKyc.status === 'PENDING' && (
                  <div className="flex gap-4 pt-4 border-t">
                    <button
                      onClick={() => handleApproveKyc(selectedKyc.id)}
                      className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                    >
                      Approve KYC
                    </button>
                    <button
                      onClick={() => handleRejectKyc(selectedKyc.id)}
                      className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                    >
                      Reject KYC
                    </button>
                  </div>
                )}

                {selectedKyc.status !== 'PENDING' && (
                  <div className="pt-4 border-t">
                    <div
                      className={`px-4 py-2 rounded-lg text-center ${
                        selectedKyc.status === 'APPROVED'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      Status: {selectedKyc.status}
                      {selectedKyc.rejectionReason && (
                        <p className="text-sm mt-1">Reason: {selectedKyc.rejectionReason}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-6xl max-h-full">
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={zoomedImage}
              alt="Zoomed"
              className="max-w-full max-h-[90vh] object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
