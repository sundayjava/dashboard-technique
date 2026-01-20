'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import toast from 'react-hot-toast';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  authorizationCode: string;
}

interface UserListItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

interface Bank {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface UserBankAccount {
  id: string;
  accountName: string;
  accountNumber: string;
  bankBranch: string | null;
  instructions: string | null;
  isActive: boolean;
  bank: Bank;
  user?: {
    id: string;
    name: string | null;
    email: string;
  };
}

export default function AdminUserBankAccountsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userBankAccounts, setUserBankAccounts] = useState<UserBankAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  // Form fields
  const [formData, setFormData] = useState({
    userId: '',
    bankId: '',
    accountName: '',
    accountNumber: '',
    bankBranch: '',
    instructions: '',
  });

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
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchUsers();
      fetchBanks();
    }
  }, [user]);

  useEffect(() => {
    if (selectedUserId) {
      fetchUserBankAccounts(selectedUserId);
    }
  }, [selectedUserId]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/admin/users');
      // API returns users array directly, not wrapped in { users: [...] }
      const usersData = Array.isArray(response.data) ? response.data : [];
      setUsers(usersData.filter((u: UserListItem) => u.role !== 'ADMIN'));
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    }
  };

  const fetchBanks = async () => {
    try {
      // Use the domestic transfer endpoint which returns banks
      const response = await axios.get('/api/transfer/domestic');
      const banksData = response.data.banks || [];
      setBanks(banksData.filter((b: Bank) => b.isActive));
    } catch (error) {
      console.error('Error fetching banks:', error);
      toast.error('Failed to fetch banks');
    }
  };

  const fetchUserBankAccounts = async (userId: string) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/admin/user-bank-accounts?userId=${userId}`);
      setUserBankAccounts(response.data.bankAccounts);
    } catch (error) {
      console.error('Error fetching user bank accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.userId || !formData.bankId || !formData.accountName || !formData.accountNumber) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await axios.post('/api/admin/user-bank-accounts', formData);
      toast.success('Bank account assigned successfully');
      
      setFormData({
        userId: '',
        bankId: '',
        accountName: '',
        accountNumber: '',
        bankBranch: '',
        instructions: '',
      });
      setShowModal(false);
      
      if (selectedUserId) {
        fetchUserBankAccounts(selectedUserId);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to assign bank account');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await axios.put(`/api/admin/user-bank-accounts/${id}`, {
        isActive: !currentStatus,
      });
      toast.success(`Bank account ${!currentStatus ? 'activated' : 'deactivated'}`);
      
      if (selectedUserId) {
        fetchUserBankAccounts(selectedUserId);
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this bank account assignment?')) {
      return;
    }

    try {
      await axios.delete(`/api/admin/user-bank-accounts/${id}`);
      toast.success('Bank account removed successfully');
      
      if (selectedUserId) {
        fetchUserBankAccounts(selectedUserId);
      }
    } catch (error) {
      toast.error('Failed to remove bank account');
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
      <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-[#c1ff72] rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 md:w-6 md:h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
                <div>
                  <h1 className="text-lg md:text-2xl font-bold text-gray-900">User Bank Accounts</h1>
                  <p className="text-sm md:text-base text-gray-600">Assign bank accounts to users</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="bg-[#c1ff72] text-black px-4 py-2 rounded-lg font-semibold hover:bg-[#b0ef62] transition-colors"
              >
                + Assign Bank
              </button>
            </div>
          </div>

          {/* User Selection */}
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select User
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
            >
              <option value="">Choose a user...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email} ({u.email})
                </option>
              ))}
            </select>
          </div>

          {/* Bank Accounts List */}
          {selectedUserId && (
            <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
              <h2 className="text-lg font-semibold mb-4">Assigned Bank Accounts</h2>
              
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#c1ff72]"></div>
                </div>
              ) : userBankAccounts.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <p className="text-gray-600">No bank accounts assigned</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bank</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Number</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {userBankAccounts.map((ba) => (
                        <tr key={ba.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{ba.bank.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{ba.accountName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{ba.accountNumber}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{ba.bankBranch || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              ba.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {ba.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleToggleStatus(ba.id, ba.isActive)}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                {ba.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleDelete(ba.id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Delete
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
          )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Assign Bank Account</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    User *
                  </label>
                  <select
                    value={formData.userId}
                    onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72]"
                    required
                  >
                    <option value="">Select user...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bank *
                  </label>
                  <select
                    value={formData.bankId}
                    onChange={(e) => setFormData({ ...formData, bankId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72]"
                    required
                  >
                    <option value="">Select bank...</option>
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Name *
                  </label>
                  <input
                    type="text"
                    value={formData.accountName}
                    onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                    placeholder="e.g., Acredis Finance Ltd"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Number *
                  </label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    placeholder="e.g., 1234567890"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bank Branch (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.bankBranch}
                    onChange={(e) => setFormData({ ...formData, bankBranch: e.target.value })}
                    placeholder="e.g., Main Branch, Downtown"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Instructions (Optional)
                  </label>
                  <textarea
                    value={formData.instructions}
                    onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                    placeholder="Special instructions for the user..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72]"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[#c1ff72] text-black font-semibold px-4 py-2 rounded-lg hover:bg-[#b0ef62]"
                  >
                    Assign Bank Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
