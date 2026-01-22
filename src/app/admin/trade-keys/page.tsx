'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface TradeKey {
  id: string;
  key: string;
  userId: string | null;
  createdBy: string | null;
  isActive: boolean;
  maxUses: number | null;
  currentUses: number;
  expiresAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  creator?: {
    id: string;
    name: string;
    email: string;
  };
  _count?: {
    investmentAccess: number;
  };
}

interface CreateFormData {
  maxUses: string;
  expiresIn: string;
}

export default function AdminTradeKeysPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tradeKeys, setTradeKeys] = useState<TradeKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<CreateFormData>({
    maxUses: '',
    expiresIn: ''
  });

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
    fetchTradeKeys();
  }, [router]);

  const fetchTradeKeys = async () => {
    try {
      const response = await axios.get('/api/admin/trade-keys');
      setTradeKeys(response.data.tradeKeys);
    } catch (error) {
      console.error('Error fetching trade keys:', error);
      toast.error('Failed to load trade keys');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = () => {
    setFormData({
      maxUses: '',
      expiresIn: ''
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData({
      maxUses: '',
      expiresIn: ''
    });
  };

  const handleCreateTradeKey = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsCreating(true);

    try {
      const payload: any = {
        createdBy: user.id
      };

      if (formData.maxUses) {
        payload.maxUses = parseInt(formData.maxUses);
      }

      if (formData.expiresIn) {
        const days = parseInt(formData.expiresIn);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        payload.expiresAt = expiresAt.toISOString();
      }

      const response = await axios.post('/api/admin/trade-keys', payload);
      
      toast.success(
        <div>
          <p>Trade key created successfully!</p>
          <p className="text-xs mt-1">Key: <strong>{response.data.tradeKey.key}</strong></p>
        </div>
      );
      
      handleCloseModal();
      fetchTradeKeys();
    } catch (error: any) {
      console.error('Error creating trade key:', error);
      toast.error(error.response?.data?.error || 'Failed to create trade key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (tradeKey: TradeKey) => {
    try {
      await axios.put('/api/admin/trade-keys', {
        id: tradeKey.id,
        isActive: !tradeKey.isActive
      });
      
      toast.success(`Trade key ${!tradeKey.isActive ? 'activated' : 'deactivated'}`);
      fetchTradeKeys();
    } catch (error: any) {
      console.error('Error toggling trade key:', error);
      toast.error(error.response?.data?.error || 'Failed to update trade key');
    }
  };

  const handleDeleteKey = async (tradeKey: TradeKey) => {
    const owner = tradeKey.user ? (tradeKey.user.name || tradeKey.user.email) : 'Unassigned';
    if (!confirm(`Are you sure you want to delete this trade key?\n\nKey: ${tradeKey.key}\nOwner: ${owner}\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`/api/admin/trade-keys?id=${tradeKey.id}`);
      toast.success('Trade key deleted successfully');
      fetchTradeKeys();
    } catch (error: any) {
      console.error('Error deleting trade key:', error);
      toast.error(error.response?.data?.error || 'Failed to delete trade key');
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('Trade key copied to clipboard!');
  };

  const stats = {
    total: tradeKeys.length,
    active: tradeKeys.filter(k => k.isActive).length,
    inactive: tradeKeys.filter(k => !k.isActive).length,
    totalUses: tradeKeys.reduce((sum, k) => sum + k.currentUses, 0)
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Trade Keys Management</h1>
            <p className="text-gray-600 mt-1">Create and manage investment access keys</p>
          </div>
          <button
            onClick={handleOpenModal}
            className="mt-4 md:mt-0 px-6 py-3 bg-linear-to-r from-[#c1ff72] to-[#8fd04f] text-black font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Trade Key
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-600 mb-1">Total Keys</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-green-50 rounded-xl shadow-sm border border-green-200 p-4">
            <p className="text-sm text-green-800 mb-1">Active</p>
            <p className="text-2xl font-bold text-green-900">{stats.active}</p>
          </div>
          <div className="bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-600 mb-1">Inactive</p>
            <p className="text-2xl font-bold text-gray-700">{stats.inactive}</p>
          </div>
          <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-200 p-4">
            <p className="text-sm text-blue-800 mb-1">Total Uses</p>
            <p className="text-2xl font-bold text-blue-900">{stats.totalUses}</p>
          </div>
        </div>

        {/* Trade Keys Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Key</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Owner</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Usage</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Max Uses</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Expires</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Created</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tradeKeys.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      No trade keys found. Create your first trade key to get started.
                    </td>
                  </tr>
                ) : (
                  tradeKeys.map((tradeKey) => (
                    <tr key={tradeKey.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                            {tradeKey.key}
                          </code>
                          <button
                            onClick={() => handleCopyKey(tradeKey.key)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                            title="Copy key"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {tradeKey.user ? (tradeKey.user.name || tradeKey.user.email) : 'Unassigned'}
                        </div>
                        {tradeKey.user && (
                          <div className="text-xs text-gray-500">{tradeKey.user.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-semibold text-gray-900">{tradeKey.currentUses}</div>
                        <div className="text-xs text-gray-500">
                          {tradeKey._count?.investmentAccess || 0} accesses
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-700">
                          {tradeKey.maxUses ? tradeKey.maxUses : 'Unlimited'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {tradeKey.expiresAt ? (
                          <div>
                            <div className="text-sm text-gray-700">
                              {new Date(tradeKey.expiresAt).toLocaleDateString()}
                            </div>
                            <div className={`text-xs ${
                              new Date(tradeKey.expiresAt) < new Date()
                                ? 'text-red-600'
                                : 'text-gray-500'
                            }`}>
                              {new Date(tradeKey.expiresAt) < new Date() ? 'Expired' : 'Active'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">Never</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleToggleActive(tradeKey)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            tradeKey.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {tradeKey.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-xs text-gray-600">
                          {new Date(tradeKey.createdAt).toLocaleDateString()}
                        </div>
                        {tradeKey.creator && (
                          <div className="text-xs text-gray-500">
                            by {tradeKey.creator.name || 'Admin'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => handleToggleActive(tradeKey)}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {tradeKey.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDeleteKey(tradeKey)}
                            className="text-sm text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                            title="Delete trade key"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
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
      </div>

      {/* Create Trade Key Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Create New Trade Key</h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateTradeKey} className="p-6 space-y-6">
              {/* Info Message */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Trade keys are created unassigned. Users can claim and use them to access investments.
                </p>
              </div>

              {/* Max Uses */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Uses (Optional)
                </label>
                <input
                  type="number"
                  value={formData.maxUses}
                  onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                  placeholder="Leave empty for unlimited"
                  min="1"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Limit how many times this key can be used
                </p>
              </div>

              {/* Expires In */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expires In (Days) (Optional)
                </label>
                <input
                  type="number"
                  value={formData.expiresIn}
                  onChange={(e) => setFormData({ ...formData, expiresIn: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                  placeholder="Leave empty for no expiration"
                  min="1"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Key will expire after the specified number of days
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Trade Key Info</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-800 text-xs">
                      <li>A unique key will be automatically generated</li>
                      <li>The user can share this key with others</li>
                      <li>Anyone who uses this key gets investment access</li>
                      <li>The key owner can track all uses</li>
                    </ul>
                  </div>
                </div>
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
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 px-6 py-3 bg-linear-to-r from-[#c1ff72] to-[#8fd04f] text-black font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? 'Creating...' : 'Create Trade Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
