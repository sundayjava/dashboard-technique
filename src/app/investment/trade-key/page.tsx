'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { InvestmentTopBar } from '@/components/layout/InvestmentTopBar';
import { investmentSidebarItems } from '@/config/investment-sidebar.config';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface TradeKey {
  id: string;
  key: string;
  isActive: boolean;
  maxUses: number | null;
  currentUses: number;
  expiresAt: string | null;
  createdAt: string;
  investmentAccess: Array<{
    id: string;
    user: {
      name: string;
      email: string;
    };
    accessedAt: string;
  }>;
}

export default function TradeKeyPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tradeKeys, setTradeKeys] = useState<TradeKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<TradeKey | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      toast.error('Please log in to continue');
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    fetchTradeKeys(parsedUser.id);
  }, [router]);

  const fetchTradeKeys = async (userId: string) => {
    try {
      const response = await axios.get(`/api/admin/trade-keys?userId=${userId}`);
      setTradeKeys(response.data.tradeKeys);
    } catch (error) {
      console.error('Error fetching trade keys:', error);
      toast.error('Failed to load trade keys');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('Trade key copied to clipboard!');
  };

  const handleShowDetails = (tradeKey: TradeKey) => {
    setSelectedKey(tradeKey);
    setShowDetailsModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailsModal(false);
    setSelectedKey(null);
  };

  const getStatusBadge = (tradeKey: TradeKey) => {
    if (!tradeKey.isActive) {
      return <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded-full">Inactive</span>;
    }
    
    if (tradeKey.expiresAt && new Date(tradeKey.expiresAt) < new Date()) {
      return <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">Expired</span>;
    }
    
    if (tradeKey.maxUses && tradeKey.currentUses >= tradeKey.maxUses) {
      return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">Max Uses Reached</span>;
    }
    
    return <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">Active</span>;
  };

  if (isLoading || !user) {
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
    <div className="min-h-screen bg-gray-50">
      <DashboardSidebar 
        items={investmentSidebarItems}
        userId={user.id}
        user={user}
        onCollapseChange={setSidebarCollapsed}
        isMobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      
      <InvestmentTopBar 
        user={user}
        sidebarCollapsed={sidebarCollapsed}
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      <main className={`pt-20 pb-8 px-4 md:px-6 transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
      }`}>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">My Trade Keys</h1>
            <p className="text-gray-600 mt-1">Manage your investment access keys and track referrals</p>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
            <div className="flex gap-4">
              <svg className="w-6 h-6 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2">What are Trade Keys?</h3>
                <p className="text-sm text-blue-800 mb-2">
                  Trade keys allow you to grant investment access to other users. When someone uses your trade key, 
                  they gain access to the investment platform, and you can track all uses of your key.
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
                  <li>Share your key with friends and family</li>
                  <li>Track who used your key and when</li>
                  <li>Each key may have usage limits and expiration dates</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Trade Keys List */}
          {tradeKeys.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <p className="text-gray-600 mb-2">No trade keys found</p>
              <p className="text-sm text-gray-500">Contact an administrator to get your trade key</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {tradeKeys.map((tradeKey) => (
                <div key={tradeKey.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        <h3 className="font-semibold text-gray-900">Trade Key</h3>
                      </div>
                      {getStatusBadge(tradeKey)}
                    </div>
                  </div>

                  {/* Key Display */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                      <code className="flex-1 text-sm font-mono text-gray-900 break-all">
                        {tradeKey.key}
                      </code>
                      <button
                        onClick={() => handleCopyKey(tradeKey.key)}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                        title="Copy key"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Uses</p>
                      <p className="text-lg font-bold text-gray-900">
                        {tradeKey.currentUses}
                        {tradeKey.maxUses && <span className="text-sm text-gray-500">/{tradeKey.maxUses}</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Referrals</p>
                      <p className="text-lg font-bold text-gray-900">{tradeKey.investmentAccess.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Created</p>
                      <p className="text-xs text-gray-900">
                        {new Date(tradeKey.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Expiration Info */}
                  {tradeKey.expiresAt && (
                    <div className="mb-4 text-sm">
                      <span className="text-gray-600">Expires: </span>
                      <span className={`font-semibold ${
                        new Date(tradeKey.expiresAt) < new Date()
                          ? 'text-red-600'
                          : 'text-gray-900'
                      }`}>
                        {new Date(tradeKey.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    onClick={() => handleShowDetails(tradeKey)}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-900 font-semibold rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Details Modal */}
      {showDetailsModal && selectedKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Trade Key Details</h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Key Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-2">Trade Key</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-white px-3 py-2 rounded border border-gray-200">
                    {selectedKey.key}
                  </code>
                  <button
                    onClick={() => handleCopyKey(selectedKey.key)}
                    className="px-3 py-2 bg-[#c1ff72] text-black rounded hover:opacity-90"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-xs text-blue-800 mb-1">Total Uses</p>
                  <p className="text-2xl font-bold text-blue-900">{selectedKey.currentUses}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-xs text-green-800 mb-1">Referrals</p>
                  <p className="text-2xl font-bold text-green-900">{selectedKey.investmentAccess.length}</p>
                </div>
              </div>

              {/* Referrals List */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Users Who Used This Key</h3>
                {selectedKey.investmentAccess.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-sm">No one has used this key yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedKey.investmentAccess.map((access) => (
                      <div key={access.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {access.user.name || access.user.email}
                          </p>
                          <p className="text-xs text-gray-500">{access.user.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-600">
                            {new Date(access.accessedAt).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(access.accessedAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={handleCloseModal}
                className="w-full px-6 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
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
