'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  canTransfer: boolean;
  accountDisabled: boolean;
  isVerified: boolean;
  requireOTPForInternational: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/users');
      setUsers(response.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const toggleTransferPermission = async (userId: string, currentValue: boolean) => {
    try {
      await axios.patch('/api/admin/users/permissions', {
        userId,
        canTransfer: !currentValue,
      });
      toast.success(`Transfer ${!currentValue ? 'enabled' : 'disabled'} successfully`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update permission');
    }
  };

  const toggleAccountStatus = async (userId: string, currentValue: boolean) => {
    try {
      await axios.patch('/api/admin/users/permissions', {
        userId,
        accountDisabled: !currentValue,
      });
      toast.success(`Account ${!currentValue ? 'disabled' : 'enabled'} successfully`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update account status');
    }
  };

  const toggleVerification = async (userId: string, currentValue: boolean) => {
    try {
      await axios.patch('/api/admin/users/permissions', {
        userId,
        isVerified: !currentValue,
      });
      toast.success(`User ${!currentValue ? 'verified' : 'unverified'} successfully`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update verification status');
    }
  };

  const toggleOTPRequirement = async (userId: string, currentValue: boolean) => {
    try {
      await axios.patch('/api/admin/users/permissions', {
        userId,
        requireOTPForInternational: !currentValue,
      });
      toast.success(`OTP ${!currentValue ? 'enabled' : 'disabled'} for international transfers`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update OTP requirement');
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'active' && !user.accountDisabled) ||
      (filterStatus === 'disabled' && user.accountDisabled) ||
      (filterStatus === 'verified' && user.isVerified) ||
      (filterStatus === 'unverified' && !user.isVerified);

    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        <p className="mt-2 text-gray-600">
          Manage user permissions, verification, and account status
        </p>
      </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Users
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Users</option>
                <option value="active">Active Accounts</option>
                <option value="disabled">Disabled Accounts</option>
                <option value="verified">Verified Users</option>
                <option value="unverified">Unverified Users</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Permissions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {user.name || 'N/A'}
                          </p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {user.role === 'ADMIN' && (
                              <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-800 font-medium">
                                Admin
                              </span>
                            )}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div>
                            {user.accountDisabled ? (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                                Disabled
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                Active
                              </span>
                            )}
                          </div>
                          <div>
                            {user.isVerified ? (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                ✓ Verified
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                                Unverified
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div>
                            {user.canTransfer ? (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                Can Transfer
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                                Transfer Disabled
                              </span>
                            )}
                          </div>
                          <div>
                            {user.requireOTPForInternational ? (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                                🔐 OTP Required
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                                No OTP
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {user.role !== 'ADMIN' && (
                          <div className="flex flex-col space-y-2">
                            <button
                              onClick={() => toggleTransferPermission(user.id, user.canTransfer)}
                              className={`px-3 py-1 text-xs font-medium rounded ${
                                user.canTransfer
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                              }`}
                            >
                              {user.canTransfer ? 'Disable Transfers' : 'Enable Transfers'}
                            </button>

                            <button
                              onClick={() => toggleAccountStatus(user.id, user.accountDisabled)}
                              className={`px-3 py-1 text-xs font-medium rounded ${
                                user.accountDisabled
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-red-100 text-red-700 hover:bg-red-200'
                              }`}
                            >
                              {user.accountDisabled ? 'Enable Account' : 'Disable Account'}
                            </button>

                            <button
                              onClick={() => toggleVerification(user.id, user.isVerified)}
                              className={`px-3 py-1 text-xs font-medium rounded ${
                                user.isVerified
                                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              }`}
                            >
                              {user.isVerified ? 'Unverify' : 'Verify'}
                            </button>

                            <button
                              onClick={() => toggleOTPRequirement(user.id, user.requireOTPForInternational)}
                              className={`px-3 py-1 text-xs font-medium rounded ${
                                user.requireOTPForInternational
                                  ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {user.requireOTPForInternational ? 'Disable OTP' : 'Enable OTP'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <div className="flex">
            <div className="shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Permission Controls</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Disable Transfers:</strong> User cannot initiate any transfers</li>
                  <li><strong>Disable Account:</strong> User cannot access their account</li>
                  <li><strong>Unverify:</strong> User cannot perform international transfers</li>
                  <li><strong>Enable OTP:</strong> User must verify with email OTP for international transfers</li>
                  <li>Admin accounts cannot be modified</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
