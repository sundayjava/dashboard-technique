'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  Coins,
  Plus,
  Edit,
  Trash2,
  Upload,
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  RefreshCw,
  Eye,
  X,
  Check,
} from 'lucide-react';

interface HoldingToken {
  id: string;
  name: string;
  symbol: string;
  logo: string | null;
  tokenAddress: string | null;
  currentPrice: number;
  priceChange24h: number;
  interestRate: number;
  isActive: boolean;
  createdAt: string;
  _count?: {
    userHoldings: number;
  };
}

interface ChainAccountHolding {
  id: string;
  chainAccountId: string;
  depositedAmount: number;
  tokenAmount: number;
  currentValue: number;
  interestEarned: number;
  status: string;
  reference: string;
  createdAt: string;
  adminNotes: string | null;
  chainAccount: {
    id: string;
    accountName: string;
    accountNumber: string;
    currency: string;
  };
  initiator: {
    user: {
      id: string;
      name: string | null;
      email: string;
    };
  };
  token: HoldingToken;
}

interface UserHolding {
  id: string;
  userId: string;
  tokenId: string;
  depositedAmount: number;
  tokenAmount: number;
  currentValue: number;
  interestEarned: number;
  status: string;
  createdAt: string;
  adminNotes: string | null;
  processedBy: string | null;
  processedAt: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
    accounts: {
      currency: string;
    }[];
  };
  token: HoldingToken;
}

export default function AdminHoldingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tokens, setTokens] = useState<HoldingToken[]>([]);
  const [holdings, setHoldings] = useState<UserHolding[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [chainHoldings, setChainHoldings] = useState<ChainAccountHolding[]>([]);
  const [chainStats, setChainStats] = useState<any>(null);
  const [selectedChainHolding, setSelectedChainHolding] = useState<ChainAccountHolding | null>(null);
  const [showChainApprovalModal, setShowChainApprovalModal] = useState(false);
  const [chainAdminNotes, setChainAdminNotes] = useState('');
  const [processingChainHolding, setProcessingChainHolding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showHoldingsModal, setShowHoldingsModal] = useState(false);
  const [selectedToken, setSelectedToken] = useState<HoldingToken | null>(null);
  const [updating, setUpdating] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<UserHolding | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showEditHoldingModal, setShowEditHoldingModal] = useState(false);
  const [approvalForm, setApprovalForm] = useState({
    depositedAmount: 0,
    tokenAmount: 0,
    currentValue: 0,
    interestEarned: 0,
    adminNotes: '',
  });
  const [editHoldingForm, setEditHoldingForm] = useState({
    depositedAmount: 0,
    tokenAmount: 0,
    currentValue: 0,
    interestEarned: 0,
    status: 'ACTIVE',
  });

  // Token form state
  const [tokenForm, setTokenForm] = useState({
    name: '',
    symbol: '',
    logo: '',
    tokenAddress: '',
    interestRate: 0,
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);

      if (parsedUser.role !== 'ADMIN') {
        router.push('/dashboard');
        return;
      }

      fetchData(parsedUser.id);
    }
  }, [router]);

  const fetchData = async (adminId: string) => {
    try {
      setLoading(true);
      const [tokensRes, holdingsRes, chainHoldingsRes] = await Promise.all([
        axios.get(`/api/admin/holding-tokens?adminId=${adminId}`),
        axios.get(`/api/admin/user-holdings?adminId=${adminId}`),
        axios.get(`/api/admin/chain-holdings?adminId=${adminId}`),
      ]);

      setTokens(tokensRes.data.tokens);
      setHoldings(holdingsRes.data.holdings);
      setStats(holdingsRes.data.stats);
      setChainHoldings(chainHoldingsRes.data.holdings);
      setChainStats(chainHoldingsRes.data.stats);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Only image files are allowed');
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB');
      return;
    }

    try {
      setUploadingLogo(true);
      
      // Convert to base64 directly
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setTokenForm({ ...tokenForm, logo: base64String });
        setUploadingLogo(false);
      };
      reader.onerror = () => {
        alert('Failed to upload logo');
        setUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Failed to upload logo');
      setUploadingLogo(false);
    }
  };

  const handleCreateToken = async () => {
    if (!user || !tokenForm.name || !tokenForm.symbol) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      await axios.post('/api/admin/holding-tokens', {
        adminId: user.id,
        ...tokenForm,
      });

      alert('Token created successfully');
      setShowTokenModal(false);
      setTokenForm({ name: '', symbol: '', logo: '', tokenAddress: '', interestRate: 0 });
      fetchData(user.id);
    } catch (error: any) {
      console.error('Error creating token:', error);
      alert(error.response?.data?.error || 'Failed to create token');
    }
  };

  const handleUpdateToken = async () => {
    if (!user || !selectedToken) return;

    try {
      await axios.patch('/api/admin/holding-tokens', {
        adminId: user.id,
        tokenId: selectedToken.id,
        ...tokenForm,
      });

      alert('Token updated successfully');
      setShowTokenModal(false);
      setSelectedToken(null);
      setTokenForm({ name: '', symbol: '', logo: '', tokenAddress: '', interestRate: 0 });
      fetchData(user.id);
    } catch (error: any) {
      console.error('Error updating token:', error);
      alert(error.response?.data?.error || 'Failed to update token');
    }
  };

  const handleDeleteToken = async (tokenId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this token?')) return;

    try {
      await axios.delete(`/api/admin/holding-tokens?adminId=${user.id}&tokenId=${tokenId}`);
      alert('Token deleted successfully');
      fetchData(user.id);
    } catch (error: any) {
      console.error('Error deleting token:', error);
      alert(error.response?.data?.error || 'Failed to delete token');
    }
  };

  const handleUpdatePrices = async () => {
    if (!user) return;

    try {
      setUpdating(true);
      await axios.get(`/api/holdings/update-prices?adminId=${user.id}`);
      alert('Prices updated successfully');
      fetchData(user.id);
    } catch (error) {
      console.error('Error updating prices:', error);
      alert('Failed to update prices');
    } finally {
      setUpdating(false);
    }
  };

  const openEditModal = (token: HoldingToken) => {
    setSelectedToken(token);
    setTokenForm({
      name: token.name,
      symbol: token.symbol,
      logo: token.logo || '',
      tokenAddress: token.tokenAddress || '',
      interestRate: token.interestRate,
    });
    setShowTokenModal(true);
  };

  const openApprovalModal = (holding: UserHolding) => {
    setSelectedHolding(holding);
    
    // Recalculate token amount based on CURRENT price to prevent price risk
    const recalculatedTokenAmount = holding.currentValue > 0 && holding.token.currentPrice > 0
      ? holding.currentValue / holding.token.currentPrice
      : holding.tokenAmount;
    
    setApprovalForm({
      depositedAmount: holding.depositedAmount,
      tokenAmount: recalculatedTokenAmount, // Use recalculated amount
      currentValue: holding.currentValue,
      interestEarned: holding.interestEarned,
      adminNotes: '',
    });
    setShowApprovalModal(true);
  };

  const handleApproveHolding = async () => {
    if (!user || !selectedHolding) return;

    try {
      await axios.post('/api/admin/approve-holding', {
        adminId: user.id,
        holdingId: selectedHolding.id,
        action: 'APPROVE',
        ...approvalForm,
      });

      alert('Holding approved successfully');
      setShowApprovalModal(false);
      setSelectedHolding(null);
      fetchData(user.id);
    } catch (error: any) {
      console.error('Error approving holding:', error);
      alert(error.response?.data?.error || 'Failed to approve holding');
    }
  };

  const handleRejectHolding = async () => {
    if (!user || !selectedHolding) return;

    const confirmReject = confirm('Are you sure you want to reject this holding? The amount will be refunded to the user.');
    if (!confirmReject) return;

    try {
      await axios.post('/api/admin/approve-holding', {
        adminId: user.id,
        holdingId: selectedHolding.id,
        action: 'REJECT',
        adminNotes: approvalForm.adminNotes,
      });

      alert('Holding rejected and refunded successfully');
      setShowApprovalModal(false);
      setSelectedHolding(null);
      fetchData(user.id);
    } catch (error: any) {
      console.error('Error rejecting holding:', error);
      alert(error.response?.data?.error || 'Failed to reject holding');
    }
  };

  const openChainApprovalModal = (holding: ChainAccountHolding) => {
    setSelectedChainHolding(holding);
    setChainAdminNotes('');
    setShowChainApprovalModal(true);
  };

  const handleChainHoldingDecision = async (action: 'APPROVE' | 'REJECT') => {
    if (!user || !selectedChainHolding) return;

    if (action === 'REJECT' && !confirm('Are you sure you want to reject this holding? The amount will be refunded to the Chain Account balance.')) {
      return;
    }

    try {
      setProcessingChainHolding(true);
      await axios.post('/api/admin/approve-chain-holding', {
        adminId: user.id,
        holdingId: selectedChainHolding.id,
        action,
        adminNotes: chainAdminNotes,
      });

      alert(action === 'APPROVE' ? 'Holding approved successfully' : 'Holding rejected and refunded successfully');
      setShowChainApprovalModal(false);
      setSelectedChainHolding(null);
      fetchData(user.id);
    } catch (error: any) {
      console.error('Error processing chain account holding:', error);
      alert(error.response?.data?.error || 'Failed to process holding');
    } finally {
      setProcessingChainHolding(false);
    }
  };

  const openEditHoldingModal = (holding: UserHolding) => {
    setSelectedHolding(holding);
    setEditHoldingForm({
      depositedAmount: holding.depositedAmount,
      tokenAmount: holding.tokenAmount,
      currentValue: holding.currentValue,
      interestEarned: holding.interestEarned,
      status: holding.status,
    });
    setShowEditHoldingModal(true);
  };

  const handleUpdateHolding = async () => {
    if (!user || !selectedHolding) return;

    try {
      await axios.put('/api/admin/user-holdings', {
        adminId: user.id,
        holdingId: selectedHolding.id,
        ...editHoldingForm,
      });

      alert('Holding updated successfully');
      setShowEditHoldingModal(false);
      setSelectedHolding(null);
      fetchData(user.id);
    } catch (error: any) {
      console.error('Error updating holding:', error);
      alert(error.response?.data?.error || 'Failed to update holding');
    }
  };

  const handleDeleteHolding = async (holdingId: string) => {
    if (!user) return;

    const confirmDelete = confirm('Are you sure you want to delete this holding? This action cannot be undone.');
    if (!confirmDelete) return;

    try {
      await axios.delete(`/api/admin/user-holdings?adminId=${user.id}&holdingId=${holdingId}`);
      alert('Holding deleted successfully');
      fetchData(user.id);
    } catch (error: any) {
      console.error('Error deleting holding:', error);
      alert(error.response?.data?.error || 'Failed to delete holding');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading holdings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Coins className="w-6 h-6 text-blue-600" />
            Holdings Management
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage holding tokens and user holdings
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleUpdatePrices}
            disabled={updating}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:bg-green-400"
          >
            <RefreshCw className={`w-4 h-4 ${updating ? 'animate-spin' : ''}`} />
            {updating ? 'Updating...' : 'Update Prices'}
          </button>
          <button
            onClick={() => {
              setSelectedToken(null);
              setTokenForm({ name: '', symbol: '', logo: '', tokenAddress: '', interestRate: 0 });
              setShowTokenModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Token
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Holdings</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalHoldings}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Holdings</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeHoldings}</p>
              </div>
              <Check className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Interest</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${stats.totalInterest.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>
      )}

      {/* Pending Holdings (Awaiting Approval) */}
      {holdings.filter(h => h.status === 'PENDING').length > 0 && (
        <div className="bg-white rounded-lg shadow mb-6 border-2 border-yellow-400">
          <div className="p-4 border-b border-gray-200 bg-yellow-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded">
                    {holdings.filter(h => h.status === 'PENDING').length}
                  </span>
                  Pending Approvals
                </h2>
                <p className="text-sm text-gray-600 mt-1">Review and approve or reject holdings</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Token</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Token Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Interest</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {holdings.filter(h => h.status === 'PENDING').map((holding) => (
                  <tr key={holding.id} className="hover:bg-yellow-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {holding.user.avatar ? (
                          <img src={holding.user.avatar} alt={holding.user.name || ''} className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600">
                              {holding.user.name?.[0] || holding.user.email[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{holding.user.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{holding.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {holding.token.logo && (
                          <img src={holding.token.logo} alt={holding.token.name} className="w-6 h-6 rounded-full" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{holding.token.symbol}</p>
                          <p className="text-xs text-gray-500">{holding.token.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {holding.depositedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {holding.user.accounts[0]?.currency || 'USD'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{holding.tokenAmount.toFixed(8)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">${holding.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-green-600">${holding.interestEarned.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs text-gray-500">{holding.token.interestRate}% APY</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600">
                        {new Date(holding.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(holding.createdAt).toLocaleTimeString()}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openApprovalModal(holding)}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Chain Account Holdings (Pending Approvals) */}
      {chainHoldings.filter(h => h.status === 'PENDING').length > 0 && (
        <div className="bg-white rounded-lg shadow mb-6 border-2 border-yellow-400">
          <div className="p-4 border-b border-gray-200 bg-yellow-50">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded">
                {chainHoldings.filter(h => h.status === 'PENDING').length}
              </span>
              Chain Account Holdings — Pending Approvals
            </h2>
            <p className="text-sm text-gray-600 mt-1">Review and approve or reject Chain Account holding requests</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chain Account</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested By</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Token</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Token Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {chainHoldings.filter(h => h.status === 'PENDING').map((holding) => (
                  <tr key={holding.id} className="hover:bg-yellow-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{holding.chainAccount.accountName}</p>
                      <p className="text-xs text-gray-500">{holding.chainAccount.accountNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{holding.initiator.user.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{holding.initiator.user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {holding.token.logo && (
                          <img src={holding.token.logo} alt={holding.token.name} className="w-6 h-6 rounded-full" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{holding.token.symbol}</p>
                          <p className="text-xs text-gray-500">{holding.token.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {holding.depositedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {holding.chainAccount.currency}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{holding.tokenAmount.toFixed(8)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600">{new Date(holding.createdAt).toLocaleDateString()}</p>
                      <p className="text-xs text-gray-500">{new Date(holding.createdAt).toLocaleTimeString()}</p>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openChainApprovalModal(holding)}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Chain Account Holdings (All) */}
      {chainHoldings.length > 0 && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Chain Account Holdings</h2>
            {chainStats && (
              <p className="text-sm text-gray-600 mt-1">
                {chainStats.activeHoldings} active · ${chainStats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })} total value
              </p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chain Account</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested By</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Token</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Interest</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {chainHoldings.slice(0, 10).map((holding) => (
                  <tr key={holding.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{holding.chainAccount.accountName}</p>
                      <p className="text-xs text-gray-500">{holding.chainAccount.accountNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{holding.initiator.user.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{holding.initiator.user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{holding.token.symbol}</p>
                      <p className="text-xs text-gray-500">{holding.tokenAmount.toFixed(8)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">
                        {holding.depositedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {holding.chainAccount.currency}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">${holding.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-green-600">${holding.interestEarned.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        holding.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        holding.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                        holding.status === 'WITHDRAWN' ? 'bg-gray-100 text-gray-700' :
                        holding.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {holding.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600">{new Date(holding.createdAt).toLocaleDateString()}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tokens List */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Holding Tokens</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Token</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">24h Change</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Interest Rate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Holdings</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tokens.map((token) => (
                <tr key={token.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {token.logo ? (
                        <img src={token.logo} alt={token.name} className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-600">{token.symbol[0]}</span>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{token.name}</p>
                        <p className="text-sm text-gray-500">{token.symbol}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      ${token.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1 ${token.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {token.priceChange24h >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {Math.abs(token.priceChange24h).toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900">{token.interestRate}% APY</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900">{token._count?.userHoldings || 0}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      token.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {token.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(token)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteToken(token.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Holdings */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">User Holdings</h2>
          <button
            onClick={() => setShowHoldingsModal(true)}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Eye className="w-4 h-4" />
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Token</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Interest</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">P/L</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {holdings.slice(0, 10).map((holding) => {
                // P/L in USD: (current value + interest) - initial value
                // Note: We use currentValue as baseline since it was set to depositAmountUSD at creation
                // For proper P/L, we'd need to store initialValueUSD separately
                // For now, this shows interest earned only
                const profitLoss = holding.interestEarned;
                const profitLossPercent = holding.currentValue > 0 ? (profitLoss / holding.currentValue) * 100 : 0;

                return (
                  <tr key={holding.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {holding.user.avatar ? (
                          <img src={holding.user.avatar} alt={holding.user.name || ''} className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600">
                              {holding.user.name?.[0] || holding.user.email[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{holding.user.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{holding.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{holding.token.symbol}</p>
                      <p className="text-xs text-gray-500">{holding.tokenAmount.toFixed(8)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">
                        {holding.depositedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {holding.user.accounts[0]?.currency || 'USD'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">${holding.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-green-600">${holding.interestEarned.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 ${profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {profitLoss >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        ${Math.abs(profitLoss).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        <span className="text-xs">({profitLossPercent >= 0 ? '+' : ''}{profitLossPercent.toFixed(2)}%)</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        holding.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        holding.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                        holding.status === 'WITHDRAWN' ? 'bg-gray-100 text-gray-700' :
                        holding.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {holding.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600">
                        {new Date(holding.createdAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditHoldingModal(holding)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteHolding(holding.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Token Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedToken ? 'Edit Token' : 'Add New Token'}
              </h2>
              <button
                onClick={() => {
                  setShowTokenModal(false);
                  setSelectedToken(null);
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Token Logo</label>
                <div className="flex items-center gap-4">
                  {tokenForm.logo && (
                    <img src={tokenForm.logo} alt="Token logo" className="w-16 h-16 rounded-full" />
                  )}
                  <label className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      disabled={uploadingLogo}
                    />
                    <div className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer text-center">
                      {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Token Name *</label>
                <input
                  type="text"
                  value={tokenForm.name}
                  onChange={(e) => setTokenForm({ ...tokenForm, name: e.target.value })}
                  placeholder="e.g., Bitcoin"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Symbol *</label>
                <input
                  type="text"
                  value={tokenForm.symbol}
                  onChange={(e) => setTokenForm({ ...tokenForm, symbol: e.target.value.toUpperCase() })}
                  placeholder="e.g., BTC"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Token Address</label>
                <input
                  type="text"
                  value={tokenForm.tokenAddress}
                  onChange={(e) => setTokenForm({ ...tokenForm, tokenAddress: e.target.value })}
                  placeholder="Deposit address"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Annual Interest Rate (%)</label>
                <input
                  type="number"
                  value={tokenForm.interestRate}
                  onChange={(e) => setTokenForm({ ...tokenForm, interestRate: parseFloat(e.target.value) })}
                  placeholder="e.g., 5.5"
                  step="0.1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowTokenModal(false);
                  setSelectedToken(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={selectedToken ? handleUpdateToken : handleCreateToken}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {selectedToken ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedHolding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Review Holding Request</h2>
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedHolding(null);
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* User Info */}
            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">User Information</h3>
              <div className="flex items-center gap-3">
                {selectedHolding.user.avatar ? (
                  <img src={selectedHolding.user.avatar} alt={selectedHolding.user.name || ''} className="w-12 h-12 rounded-full" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-lg font-medium text-gray-600">
                      {selectedHolding.user.name?.[0] || selectedHolding.user.email[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900">{selectedHolding.user.name || 'Unknown'}</p>
                  <p className="text-sm text-gray-600">{selectedHolding.user.email}</p>
                </div>
              </div>
            </div>

            {/* Token Info */}
            <div className="bg-purple-50 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Token Information</h3>
              <div className="flex items-center gap-3">
                {selectedHolding.token.logo && (
                  <img src={selectedHolding.token.logo} alt={selectedHolding.token.name} className="w-10 h-10 rounded-full" />
                )}
                <div>
                  <p className="font-medium text-gray-900">{selectedHolding.token.name} ({selectedHolding.token.symbol})</p>
                  <p className="text-sm text-gray-600">
                    Current Price: ${selectedHolding.token.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-gray-600">Interest Rate: {selectedHolding.token.interestRate}% APY</p>
                </div>
              </div>
            </div>

            {/* Price Recalculation Notice */}
            {Math.abs((selectedHolding.currentValue / selectedHolding.token.currentPrice) - selectedHolding.tokenAmount) > 0.00000001 && selectedHolding.status === 'PENDING' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>ℹ️ Token amount recalculated:</strong> Adjusted to ensure user receives ${selectedHolding.currentValue.toFixed(2)} USD worth at current price (${selectedHolding.token.currentPrice.toLocaleString()}).
                </p>
              </div>
            )}

            {/* Editable Fields */}
            <div className="space-y-4 mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deposited Amount ({selectedHolding.user.accounts[0]?.currency || 'USD'}) *
                  </label>
                  <input
                    type="number"
                    value={approvalForm.depositedAmount}
                    onChange={(e) => setApprovalForm({ ...approvalForm, depositedAmount: parseFloat(e.target.value) })}
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Original: {selectedHolding.depositedAmount.toFixed(2)} {selectedHolding.user.accounts[0]?.currency || 'USD'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Token Amount *
                  </label>
                  <input
                    type="number"
                    value={approvalForm.tokenAmount}
                    onChange={(e) => setApprovalForm({ ...approvalForm, tokenAmount: parseFloat(e.target.value) })}
                    step="0.00000001"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Requested: {selectedHolding.tokenAmount.toFixed(8)} {selectedHolding.token.symbol}
                  </p>
                  {Math.abs(approvalForm.tokenAmount - selectedHolding.tokenAmount) > 0.00000001 && (
                    <p className="text-xs text-blue-600 mt-1">
                      ⚠️ Recalculated based on current price (${selectedHolding.token.currentPrice.toLocaleString()})
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Value ($) *
                  </label>
                  <input
                    type="number"
                    value={approvalForm.currentValue}
                    onChange={(e) => setApprovalForm({ ...approvalForm, currentValue: parseFloat(e.target.value) })}
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Original: ${selectedHolding.currentValue.toFixed(2)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Interest Earned ($) *
                  </label>
                  <input
                    type="number"
                    value={approvalForm.interestEarned}
                    onChange={(e) => setApprovalForm({ ...approvalForm, interestEarned: parseFloat(e.target.value) })}
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Original: ${selectedHolding.interestEarned.toFixed(2)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Notes
                </label>
                <textarea
                  value={approvalForm.adminNotes}
                  onChange={(e) => setApprovalForm({ ...approvalForm, adminNotes: e.target.value })}
                  placeholder="Add notes about this approval/rejection..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Request Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Request Date:</p>
                  <p className="font-medium text-gray-900">{new Date(selectedHolding.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-600">Days Since Request:</p>
                  <p className="font-medium text-gray-900">
                    {Math.floor((Date.now() - new Date(selectedHolding.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedHolding(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectHolding}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Reject & Refund
              </button>
              <button
                onClick={handleApproveHolding}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Holding Modal */}
      {showEditHoldingModal && selectedHolding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Edit Holding</h2>
              <button
                onClick={() => {
                  setShowEditHoldingModal(false);
                  setSelectedHolding(null);
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* User Info */}
            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">User Information</h3>
              <div className="flex items-center gap-3">
                {selectedHolding.user.avatar ? (
                  <img src={selectedHolding.user.avatar} alt={selectedHolding.user.name || ''} className="w-12 h-12 rounded-full" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-lg font-medium text-gray-600">
                      {selectedHolding.user.name?.[0] || selectedHolding.user.email[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900">{selectedHolding.user.name || 'Unknown'}</p>
                  <p className="text-sm text-gray-600">{selectedHolding.user.email}</p>
                </div>
              </div>
            </div>

            {/* Token Info */}
            <div className="bg-purple-50 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Token Information</h3>
              <div className="flex items-center gap-3">
                {selectedHolding.token.logo && (
                  <img src={selectedHolding.token.logo} alt={selectedHolding.token.name} className="w-10 h-10 rounded-full" />
                )}
                <div>
                  <p className="font-medium text-gray-900">{selectedHolding.token.name} ({selectedHolding.token.symbol})</p>
                  <p className="text-sm text-gray-600">
                    Current Price: ${selectedHolding.token.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-gray-600">Interest Rate: {selectedHolding.token.interestRate}% APY</p>
                </div>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="space-y-4 mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deposited Amount ({selectedHolding.user.accounts[0]?.currency || 'USD'}) *
                  </label>
                  <input
                    type="number"
                    value={editHoldingForm.depositedAmount}
                    onChange={(e) => setEditHoldingForm({ ...editHoldingForm, depositedAmount: parseFloat(e.target.value) })}
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Token Amount *
                  </label>
                  <input
                    type="number"
                    value={editHoldingForm.tokenAmount}
                    onChange={(e) => setEditHoldingForm({ ...editHoldingForm, tokenAmount: parseFloat(e.target.value) })}
                    step="0.00000001"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Value ($) *
                  </label>
                  <input
                    type="number"
                    value={editHoldingForm.currentValue}
                    onChange={(e) => setEditHoldingForm({ ...editHoldingForm, currentValue: parseFloat(e.target.value) })}
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Interest Earned ($) *
                  </label>
                  <input
                    type="number"
                    value={editHoldingForm.interestEarned}
                    onChange={(e) => setEditHoldingForm({ ...editHoldingForm, interestEarned: parseFloat(e.target.value) })}
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status *
                  </label>
                  <select
                    value={editHoldingForm.status}
                    onChange={(e) => setEditHoldingForm({ ...editHoldingForm, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="WITHDRAWN">WITHDRAWN</option>
                    <option value="REJECTED">REJECTED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Created Date */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="text-sm">
                <p className="text-gray-600">Created Date:</p>
                <p className="font-medium text-gray-900">{new Date(selectedHolding.createdAt).toLocaleString()}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowEditHoldingModal(false);
                  setSelectedHolding(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateHolding}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Update Holding
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chain Account Holding Approval Modal */}
      {showChainApprovalModal && selectedChainHolding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Review Chain Account Holding Request</h2>
              <button
                onClick={() => {
                  setShowChainApprovalModal(false);
                  setSelectedChainHolding(null);
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Chain Account Info */}
            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Chain Account</h3>
              <p className="font-medium text-gray-900">{selectedChainHolding.chainAccount.accountName}</p>
              <p className="text-sm text-gray-600">{selectedChainHolding.chainAccount.accountNumber}</p>
              <p className="text-sm text-gray-600 mt-2">
                Requested by <span className="font-medium">{selectedChainHolding.initiator.user.name || selectedChainHolding.initiator.user.email}</span> ({selectedChainHolding.initiator.user.email})
              </p>
            </div>

            {/* Token Info */}
            <div className="bg-purple-50 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Token Information</h3>
              <div className="flex items-center gap-3">
                {selectedChainHolding.token.logo && (
                  <img src={selectedChainHolding.token.logo} alt={selectedChainHolding.token.name} className="w-10 h-10 rounded-full" />
                )}
                <div>
                  <p className="font-medium text-gray-900">{selectedChainHolding.token.name} ({selectedChainHolding.token.symbol})</p>
                  <p className="text-sm text-gray-600">
                    Current Price: ${selectedChainHolding.token.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-gray-600">Interest Rate: {selectedChainHolding.token.interestRate}% APY</p>
                </div>
              </div>
            </div>

            {/* Request Details */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Amount:</p>
                  <p className="font-medium text-gray-900">
                    {selectedChainHolding.depositedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {selectedChainHolding.chainAccount.currency}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Token Quantity:</p>
                  <p className="font-medium text-gray-900">{selectedChainHolding.tokenAmount.toFixed(8)} {selectedChainHolding.token.symbol}</p>
                </div>
                <div>
                  <p className="text-gray-600">Reference:</p>
                  <p className="font-medium text-gray-900 font-mono text-xs">{selectedChainHolding.reference}</p>
                </div>
                <div>
                  <p className="text-gray-600">Request Date:</p>
                  <p className="font-medium text-gray-900">{new Date(selectedChainHolding.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes</label>
              <textarea
                value={chainAdminNotes}
                onChange={(e) => setChainAdminNotes(e.target.value)}
                placeholder="Add notes about this approval/rejection..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowChainApprovalModal(false);
                  setSelectedChainHolding(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleChainHoldingDecision('REJECT')}
                disabled={processingChainHolding}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Reject & Refund
              </button>
              <button
                onClick={() => handleChainHoldingDecision('APPROVE')}
                disabled={processingChainHolding}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
