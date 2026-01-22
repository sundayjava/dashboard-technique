'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { UserPlus, Trash2, Loader2, Search, Wallet, Building2, Edit2 } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
}

interface Address {
  id: string;
  type: string;
  tokenName?: string;
  address?: string;
  network?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  swiftCode?: string;
  routingNumber?: string;
  country?: string;
}

interface UserAddress {
  id: string;
  userId: string;
  addressId: string;
  user: User;
  address: Address;
  createdAt: string;
}

export default function AssignAddressesPage() {
  const [assignments, setAssignments] = useState<UserAddress[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [formData, setFormData] = useState({
    userId: '',
    addressId: '',
  });
  const [editFormData, setEditFormData] = useState({
    type: 'CRYPTO',
    tokenName: '',
    address: '',
    network: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
    swiftCode: '',
    routingNumber: '',
    country: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [assignmentsRes, usersRes, addressesRes] = await Promise.all([
        axios.get('/api/admin/user-addresses').catch(() => ({ data: [] })),
        axios.get('/api/admin/users').catch(() => ({ data: [] })),
        axios.get('/api/admin/addresses').catch(() => ({ data: [] })),
      ]);
      setAssignments(assignmentsRes.data);
      setUsers(usersRes.data);
      setAddresses(addressesRes.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fetch data');
      setAssignments([]);
      setUsers([]);
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await axios.post('/api/admin/user-addresses', formData);
      toast.success('Address assigned successfully');
      setShowModal(false);
      setFormData({ userId: '', addressId: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to assign address');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this address assignment?')) return;

    try {
      await axios.delete(`/api/admin/user-addresses/${id}`);
      toast.success('Address assignment removed successfully');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to remove assignment');
    }
  };

  const handleEditAddress = (address: Address) => {
    setEditingAddress(address);
    setEditFormData({
      type: address.type,
      tokenName: address.tokenName || '',
      address: address.address || '',
      network: address.network || '',
      bankName: address.bankName || '',
      accountNumber: address.accountNumber || '',
      accountName: address.accountName || '',
      swiftCode: address.swiftCode || '',
      routingNumber: address.routingNumber || '',
      country: address.country || '',
    });
    setShowEditModal(true);
  };

  const handleUpdateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAddress) return;

    setSaving(true);
    try {
      await axios.patch(`/api/admin/addresses/${editingAddress.id}`, editFormData);
      toast.success('Address updated successfully');
      setShowEditModal(false);
      setEditingAddress(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update address');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address? This will remove all assignments.')) return;

    try {
      await axios.delete(`/api/admin/addresses/${addressId}`);
      toast.success('Address deleted successfully');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete address');
    }
  };

  const filteredAssignments = assignments.filter(assignment =>
    assignment.user.name?.toLowerCase().includes(search.toLowerCase()) ||
    assignment.user.email.toLowerCase().includes(search.toLowerCase()) ||
    (assignment.address.tokenName?.toLowerCase().includes(search.toLowerCase())) ||
    (assignment.address.bankName?.toLowerCase().includes(search.toLowerCase()))
  );

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Assign Addresses</h1>
          <p className="mt-2 text-gray-600">Assign crypto and bank addresses to users</p>
        </div>
        <button
          onClick={() => {
            setFormData({ userId: '', addressId: '' });
            setShowModal(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Assign Address
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by user or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Assignments List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned On
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <UserPlus className="w-16 h-16 text-gray-400 mb-2" />
                      <p className="text-gray-900 font-medium text-lg">No addresses assigned yet</p>
                      <p className="text-gray-500 text-sm">Click "Assign Address" to assign an address to a user</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{assignment.user.name}</div>
                      <div className="text-sm text-gray-500">{assignment.user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {assignment.address.type === 'CRYPTO' ? (
                          <>
                            <Wallet className="w-4 h-4 text-purple-600" />
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                              CRYPTO
                            </span>
                          </>
                        ) : (
                          <>
                            <Building2 className="w-4 h-4 text-green-600" />
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              BANK
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {assignment.address.type === 'CRYPTO' ? (
                        <div>
                          <div className="font-medium text-gray-900">{assignment.address.tokenName}</div>
                          <div className="text-sm text-gray-500">{assignment.address.network}</div>
                          <div className="text-xs text-gray-400 font-mono mt-1 truncate max-w-xs">
                            {assignment.address.address}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium text-gray-900">{assignment.address.bankName}</div>
                          <div className="text-sm text-gray-500">{assignment.address.accountName}</div>
                          <div className="text-xs text-gray-400">{assignment.address.accountNumber}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(assignment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditAddress(assignment.address)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Address"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAddress(assignment.address.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Address"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(assignment.id)}
                          className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Remove Assignment"
                        >
                          <UserPlus className="w-4 h-4 rotate-180" />
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Assign Address to User</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select User <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Choose a user...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Address <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.addressId}
                  onChange={(e) => setFormData({ ...formData, addressId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Choose an address...</option>
                  {addresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.type === 'CRYPTO' 
                        ? `${address.tokenName} (${address.network}) - ${address.address?.substring(0, 10)}...`
                        : `${address.bankName} - ${address.accountNumber}`
                      }
                    </option>
                  ))}
                </select>
                {addresses.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No addresses available. Please create addresses first in "Manage Addresses"
                  </p>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={saving || addresses.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Assigning...' : 'Assign'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setFormData({ userId: '', addressId: '' });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Address Modal */}
      {showEditModal && editingAddress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Edit Address</h2>
            <form onSubmit={handleUpdateAddress} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <input
                  type="text"
                  value={editFormData.type}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  disabled
                />
              </div>

              {editFormData.type === 'CRYPTO' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Token Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editFormData.tokenName}
                      onChange={(e) => setEditFormData({ ...editFormData, tokenName: e.target.value })}
                      placeholder="e.g., Bitcoin, USDT"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Network <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editFormData.network}
                      onChange={(e) => setEditFormData({ ...editFormData, network: e.target.value })}
                      placeholder="e.g., ERC20, TRC20, BEP20"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Wallet Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editFormData.address}
                      onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                      placeholder="0x..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bank Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editFormData.bankName}
                      onChange={(e) => setEditFormData({ ...editFormData, bankName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Account Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editFormData.accountNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, accountNumber: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Account Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editFormData.accountName}
                      onChange={(e) => setEditFormData({ ...editFormData, accountName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editFormData.country}
                      onChange={(e) => setEditFormData({ ...editFormData, country: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SWIFT Code
                    </label>
                    <input
                      type="text"
                      value={editFormData.swiftCode}
                      onChange={(e) => setEditFormData({ ...editFormData, swiftCode: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Routing Number
                    </label>
                    <input
                      type="text"
                      value={editFormData.routingNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, routingNumber: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Updating...' : 'Update Address'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingAddress(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
