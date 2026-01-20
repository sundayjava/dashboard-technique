'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Wallet, Building2, Plus, Edit2, Trash2, Loader2, Search } from 'lucide-react';

interface Address {
  id: string;
  type: string; // CRYPTO or BANK
  // Crypto fields
  tokenName?: string;
  address?: string;
  network?: string;
  // Bank fields
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  swiftCode?: string;
  routingNumber?: string;
  country?: string;
  createdAt: string;
  _count?: {
    userAssignments: number;
  };
}

export default function ManageAddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [formData, setFormData] = useState({
    type: 'CRYPTO',
    // Crypto
    tokenName: '',
    address: '',
    network: '',
    // Bank
    bankName: '',
    accountNumber: '',
    accountName: '',
    swiftCode: '',
    routingNumber: '',
    country: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/addresses').catch(() => ({ data: [] }));
      setAddresses(response.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fetch addresses');
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingAddress) {
        await axios.patch(`/api/admin/addresses/${editingAddress.id}`, formData);
        toast.success('Address updated successfully');
      } else {
        await axios.post('/api/admin/addresses', formData);
        toast.success('Address created successfully');
      }
      
      setShowModal(false);
      setEditingAddress(null);
      resetForm();
      fetchAddresses();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
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
  };

  const handleEdit = (address: Address) => {
    setEditingAddress(address);
    setFormData({
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
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;

    try {
      await axios.delete(`/api/admin/addresses/${id}`);
      toast.success('Address deleted successfully');
      fetchAddresses();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete address');
    }
  };

  const filteredAddresses = addresses.filter(address => {
    const matchesSearch = 
      (address.tokenName?.toLowerCase().includes(search.toLowerCase())) ||
      (address.address?.toLowerCase().includes(search.toLowerCase())) ||
      (address.bankName?.toLowerCase().includes(search.toLowerCase())) ||
      (address.accountNumber?.toLowerCase().includes(search.toLowerCase()));
    
    const matchesType = typeFilter === 'ALL' || address.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

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
          <h1 className="text-3xl font-bold text-gray-900">Manage Addresses</h1>
          <p className="mt-2 text-gray-600">Create crypto and bank addresses for user assignment</p>
        </div>
        <button
          onClick={() => {
            setEditingAddress(null);
            resetForm();
            setShowModal(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Address
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search addresses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ALL">All Types</option>
            <option value="CRYPTO">Crypto Addresses</option>
            <option value="BANK">Bank Accounts</option>
          </select>
        </div>
      </div>

      {/* Addresses Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredAddresses.length === 0 ? (
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-12 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="text-gray-400 text-5xl mb-2">🏦</div>
              <p className="text-gray-900 font-medium text-lg">No addresses yet</p>
              <p className="text-gray-500">Click "Add Address" to create your first crypto or bank address</p>
            </div>
          </div>
        ) : (
          filteredAddresses.map((addr) => (
            <div key={addr.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className={`h-2 rounded-t-lg ${addr.type === 'CRYPTO' ? 'bg-purple-500' : 'bg-green-500'}`} />
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {addr.type === 'CRYPTO' ? (
                      <div className="p-3 bg-purple-100 rounded-lg">
                        <Wallet className="w-6 h-6 text-purple-600" />
                      </div>
                    ) : (
                      <div className="p-3 bg-green-100 rounded-lg">
                        <Building2 className="w-6 h-6 text-green-600" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {addr.type === 'CRYPTO' ? addr.tokenName : addr.bankName}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        addr.type === 'CRYPTO' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {addr.type}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(addr)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(addr.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {addr.type === 'CRYPTO' ? (
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500">Network</p>
                      <p className="text-sm font-medium text-gray-900">{addr.network}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Address</p>
                      <p className="text-sm font-mono text-gray-900 break-all">{addr.address}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-gray-500">Account Number</p>
                        <p className="text-sm font-medium text-gray-900">{addr.accountNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Account Name</p>
                        <p className="text-sm font-medium text-gray-900">{addr.accountName}</p>
                      </div>
                    </div>
                    {addr.swiftCode && (
                      <div>
                        <p className="text-xs text-gray-500">SWIFT Code</p>
                        <p className="text-sm font-medium text-gray-900">{addr.swiftCode}</p>
                      </div>
                    )}
                    {addr.country && (
                      <div>
                        <p className="text-xs text-gray-500">Country</p>
                        <p className="text-sm font-medium text-gray-900">{addr.country}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Created {new Date(addr.createdAt).toLocaleDateString()}
                  </div>
                  {addr._count && (
                    <div className="text-xs text-gray-500">
                      Assigned to {addr._count.userAssignments} user{addr._count.userAssignments !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingAddress ? 'Edit Address' : 'Add Address'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={!!editingAddress}
                >
                  <option value="CRYPTO">Crypto Address</option>
                  <option value="BANK">Bank Account</option>
                </select>
              </div>

              {formData.type === 'CRYPTO' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Token Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.tokenName}
                      onChange={(e) => setFormData({ ...formData, tokenName: e.target.value })}
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
                      value={formData.network}
                      onChange={(e) => setFormData({ ...formData, network: e.target.value })}
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
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
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
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
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
                      value={formData.accountName}
                      onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
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
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
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
                      value={formData.swiftCode}
                      onChange={(e) => setFormData({ ...formData, swiftCode: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Routing Number
                    </label>
                    <input
                      type="text"
                      value={formData.routingNumber}
                      onChange={(e) => setFormData({ ...formData, routingNumber: e.target.value })}
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
                  {saving ? 'Saving...' : editingAddress ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingAddress(null);
                    resetForm();
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
