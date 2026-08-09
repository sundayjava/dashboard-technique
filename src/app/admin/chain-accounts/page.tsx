'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import {
  Users,
  DollarSign,
  TrendingUp,
  Search,
  Eye,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Wallet,
  X,
  Save
} from 'lucide-react';

interface ChainAccount {
  id: string;
  accountName: string;
  accountNumber: string;
  primaryPurpose: string;
  authorizationModel: string;
  balance: number;
  investmentBalance: number;
  status: string;
  createdAt: string;
  cryptoDepositAddress?: string | null;
  cryptoNetwork?: string | null;
  cryptoToken?: string | null;
  _count: {
    members: number;
    deposits: number;
    investments: number;
    withdrawals: number;
  };
}

const statusConfig = {
  PENDING: { 
    label: 'Pending', 
    bg: 'bg-yellow-100', 
    text: 'text-yellow-800',
    icon: Clock 
  },
  ACTIVE: { 
    label: 'Active', 
    bg: 'bg-green-100', 
    text: 'text-green-800',
    icon: CheckCircle 
  },
  SUSPENDED: { 
    label: 'Suspended', 
    bg: 'bg-red-100', 
    text: 'text-red-800',
    icon: XCircle 
  },
  CLOSED: { 
    label: 'Closed', 
    bg: 'bg-gray-100', 
    text: 'text-gray-800',
    icon: AlertCircle 
  },
};

const authModelLabels = {
  INDEPENDENT: 'Independent',
  THRESHOLD: 'Threshold',
  MAJORITY: 'Majority'
};

export default function AdminChainAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<ChainAccount[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<ChainAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<ChainAccount | null>(null);
  const [addressForm, setAddressForm] = useState({
    cryptoDepositAddress: '',
    cryptoNetwork: 'TRC20',
    cryptoToken: 'USDT',
  });
  const [savingAddress, setSavingAddress] = useState(false);

  // Statistics
  const [stats, setStats] = useState({
    totalAccounts: 0,
    activeAccounts: 0,
    totalBalance: 0,
    totalInvestmentBalance: 0
  });

  useEffect(() => {
    // Check admin authentication
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

    fetchChainAccounts();
  }, [router]);

  useEffect(() => {
    // Apply filters
    let filtered = accounts;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(account => 
        account.accountName.toLowerCase().includes(query) ||
        account.accountNumber.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(account => account.status === statusFilter);
    }

    setFilteredAccounts(filtered);
  }, [searchQuery, statusFilter, accounts]);

  const fetchChainAccounts = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get('/api/admin/chain-accounts');
      
      if (response.data.accounts) {
        setAccounts(response.data.accounts);
        setFilteredAccounts(response.data.accounts);
        
        // Calculate statistics
        const totalAccounts = response.data.accounts.length;
        const activeAccounts = response.data.accounts.filter(
          (acc: ChainAccount) => acc.status === 'ACTIVE'
        ).length;
        const totalBalance = response.data.accounts.reduce(
          (sum: number, acc: ChainAccount) => sum + acc.balance, 
          0
        );
        const totalInvestmentBalance = response.data.accounts.reduce(
          (sum: number, acc: ChainAccount) => sum + acc.investmentBalance, 
          0
        );

        setStats({
          totalAccounts,
          activeAccounts,
          totalBalance,
          totalInvestmentBalance
        });
      }
    } catch (error) {
      console.error('Error fetching chain accounts:', error);
      toast.error('Failed to load chain accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetails = (accountId: string) => {
    router.push(`/admin/chain-accounts/${accountId}`);
  };

  const handleOpenAddressModal = (account: ChainAccount) => {
    setSelectedAccount(account);
    setAddressForm({
      cryptoDepositAddress: account.cryptoDepositAddress || '',
      cryptoNetwork: account.cryptoNetwork || 'TRC20',
      cryptoToken: account.cryptoToken || 'USDT',
    });
    setShowAddressModal(true);
  };

  const handleSaveAddress = async () => {
    if (!selectedAccount) return;

    if (!addressForm.cryptoDepositAddress.trim()) {
      toast.error('Please enter a deposit address');
      return;
    }

    setSavingAddress(true);

    try {
      await axios.patch(`/api/admin/chain-accounts/${selectedAccount.id}/address`, addressForm);

      toast.success('Crypto deposit address assigned successfully!');
      setShowAddressModal(false);
      fetchChainAccounts(); // Refresh the list
    } catch (error: any) {
      console.error('Error assigning address:', error);
      toast.error(error.response?.data?.error || 'Failed to assign address');
    } finally {
      setSavingAddress(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading chain accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 md:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Chain Accounts</h1>
          <p className="text-gray-600 mt-1">Manage all chain accounts in the system</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600 font-medium">Total Accounts</p>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalAccounts}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.activeAccounts} active</p>
          </div>

          <div className="bg-white rounded-xl shadow p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600 font-medium">Total Balance</p>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              ${stats.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">Available funds</p>
          </div>

          <div className="bg-white rounded-xl shadow p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600 font-medium">Investment Balance</p>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              ${stats.totalInvestmentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">Invested funds</p>
          </div>

          <div className="bg-white rounded-xl shadow p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600 font-medium">Total Value</p>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              ${(stats.totalBalance + stats.totalInvestmentBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">Combined value</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by account name or number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filter Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Filter className="w-5 h-5" />
              Filters
            </button>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-2">
                <span className="text-sm font-medium text-gray-700 mr-2">Status:</span>
                {['ALL', 'PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      statusFilter === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'ALL' ? 'All' : statusConfig[status as keyof typeof statusConfig]?.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-4 text-sm text-gray-600">
          Showing {filteredAccounts.length} of {accounts.length} accounts
        </div>

        {/* Accounts Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Members
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Auth Model
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Investment
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <Users className="w-16 h-16 mb-4 text-gray-300" />
                        <p className="text-lg font-medium">No chain accounts found</p>
                        <p className="text-sm mt-1">
                          {searchQuery || statusFilter !== 'ALL'
                            ? 'Try adjusting your search or filters'
                            : 'Chain accounts will appear here once created'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((account) => {
                    const StatusIcon = statusConfig[account.status as keyof typeof statusConfig]?.icon;
                    const statusStyle = statusConfig[account.status as keyof typeof statusConfig];

                    return (
                      <tr key={account.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-medium text-sm text-gray-900">{account.accountName}</div>
                            <div className="text-xs text-gray-500 font-mono">{account.accountNumber}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-700">{account.primaryPurpose}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-xs text-gray-700">
                            <Users className="w-3.5 h-3.5" />
                            <span>{account._count.members}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full font-medium">
                            {authModelLabels[account.authorizationModel as keyof typeof authModelLabels]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold text-gray-900">
                            ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold text-purple-600">
                            ${account.investmentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold uppercase ${statusStyle?.bg} ${statusStyle?.text}`}>
                            {StatusIcon && <StatusIcon className="w-3 h-3" />}
                            {statusStyle?.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenAddressModal(account)}
                              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                account.cryptoDepositAddress
                                  ? 'text-green-600 hover:bg-green-50'
                                  : 'text-orange-600 hover:bg-orange-50'
                              }`}
                              title={account.cryptoDepositAddress ? 'Edit deposit address' : 'Assign deposit address'}
                            >
                              <Wallet className="w-4 h-4" />
                              {account.cryptoDepositAddress ? 'Edit' : 'Assign'} Address
                            </button>
                            <button
                              onClick={() => handleViewDetails(account.id)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Crypto Address Assignment Modal */}
        {showAddressModal && selectedAccount && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Assign Crypto Deposit Address</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedAccount.accountName} ({selectedAccount.accountNumber})
                  </p>
                </div>
                <button
                  onClick={() => setShowAddressModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Important:</strong> This address will be used by all members of this Chain Account to deposit crypto (USDT).
                    Make sure it's a unique address for this Chain Account only.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Crypto Network *
                  </label>
                  <select
                    value={addressForm.cryptoNetwork}
                    onChange={(e) => setAddressForm({ ...addressForm, cryptoNetwork: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="TRC20">TRC20 (Tron)</option>
                    <option value="ERC20">ERC20 (Ethereum)</option>
                    <option value="BEP20">BEP20 (Binance Smart Chain)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Token Type *
                  </label>
                  <select
                    value={addressForm.cryptoToken}
                    onChange={(e) => setAddressForm({ ...addressForm, cryptoToken: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="USDT">USDT (Tether)</option>
                    <option value="USDC">USDC (USD Coin)</option>
                    <option value="BTC">BTC (Bitcoin)</option>
                    <option value="ETH">ETH (Ethereum)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deposit Address *
                  </label>
                  <input
                    type="text"
                    value={addressForm.cryptoDepositAddress}
                    onChange={(e) => setAddressForm({ ...addressForm, cryptoDepositAddress: e.target.value })}
                    placeholder="Enter wallet address (e.g., TXyz...)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    The wallet address where members will send their crypto deposits
                  </p>
                </div>

                {selectedAccount.cryptoDepositAddress && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Current Address:</strong>
                      <br />
                      <span className="font-mono text-xs">{selectedAccount.cryptoDepositAddress}</span>
                      <br />
                      Network: {selectedAccount.cryptoNetwork} • Token: {selectedAccount.cryptoToken}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => setShowAddressModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  disabled={savingAddress}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAddress}
                  disabled={savingAddress || !addressForm.cryptoDepositAddress.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {savingAddress ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Address
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
