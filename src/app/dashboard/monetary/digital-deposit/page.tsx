'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { DashboardTopBar } from '@/components/layout/DashboardTopBar';
import { sidebarItems } from '@/config/sidebar.config';
import QRCode from 'qrcode';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  currency: string;
  authorizationCode: string;
}

interface DepositAddress {
  id: string;
  type: 'CRYPTO' | 'BANK';
  tokenName: string | null;
  address: string | null;
  network: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  swiftCode: string | null;
  routingNumber: string | null;
  country: string | null;
  createdAt: string;
}

export default function DigitalDepositPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [addresses, setAddresses] = useState<DepositAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<DepositAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Form fields
  const [amount, setAmount] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    if (parsedUser.role === 'ADMIN') {
      router.push('/admin/dashboard');
      return;
    }

    setUser(parsedUser);
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchAddresses();
    }
  }, [user]);

  useEffect(() => {
    if (selectedAddress && selectedAddress.address) {
      generateQRCode(selectedAddress.address);
    }
  }, [selectedAddress]);

  const fetchAddresses = async () => {
    try {
      const response = await axios.get(`/api/user-addresses?userId=${user?.id}`);
      // Filter only CRYPTO addresses
      const cryptoAddresses = response.data.addresses.filter(
        (addr: DepositAddress) => addr.type === 'CRYPTO'
      );
      setAddresses(cryptoAddresses);
      if (cryptoAddresses.length > 0) {
        setSelectedAddress(cryptoAddresses[0]);
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async (address: string) => {
    try {
      const qr = await QRCode.toDataURL(address, {
        width: 200,
        margin: 1,
      });
      setQrCode(qr);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const copyAddress = async () => {
    if (selectedAddress && selectedAddress.address) {
      try {
        await navigator.clipboard.writeText(selectedAddress.address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Error copying address:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedAddress || !user) return;

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!transactionId.trim()) {
      setError('Please enter the transaction ID');
      return;
    }

    setSubmitting(true);

    try {
      await axios.post('/api/crypto-deposits', {
        userId: user.id,
        depositAddressId: selectedAddress.id,
        tokenName: selectedAddress.tokenName,
        network: selectedAddress.network,
        amount: parseFloat(amount),
        transactionId: transactionId.trim(),
      });

      setSuccess('Deposit submitted successfully! Awaiting verification.');
      setAmount('');
      setTransactionId('');
      
      // Redirect to deposit history after 2 seconds
      setTimeout(() => {
        router.push('/dashboard/monetary/deposit-history');
      }, 2000);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to submit deposit');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c1ff72]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardSidebar 
        items={sidebarItems}
        userId={user.id}
        onCollapseChange={setSidebarCollapsed}
        isMobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <DashboardTopBar 
        user={user} 
        sidebarCollapsed={sidebarCollapsed}
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      <main className={`pt-16 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-[#c1ff72] rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 md:w-6 md:h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg md:text-2xl font-bold text-gray-900">Digital Deposit</h1>
                <p className="text-sm md:text-base text-gray-600">Deposit cryptocurrency to your account</p>
              </div>
            </div>
          </div>

          {addresses.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 md:p-12 text-center">
              <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 md:w-10 md:h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">No Deposit Addresses Assigned</h3>
              <p className="text-sm md:text-base text-gray-600 mb-4">
                Your crypto deposit addresses have not been assigned yet.
              </p>
              <p className="text-sm text-gray-500">
                Please contact admin to get deposit addresses assigned to your account.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Side - Address Selection */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Select Crypto</h2>
                  <div className="space-y-2">
                    {addresses.map((address) => (
                      <button
                        key={address.id}
                        onClick={() => setSelectedAddress(address)}
                        className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                          selectedAddress?.id === address.id
                            ? 'border-[#c1ff72] bg-[#c1ff72]/10'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="w-8 h-8 bg-gradient-to-br from-[#c1ff72] to-green-400 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-black">{address.tokenName?.[0] || 'C'}</span>
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-semibold text-gray-900">{address.tokenName || 'Crypto'}</p>
                          <p className="text-xs text-gray-500">{address.network}</p>
                        </div>
                        <svg className={`w-5 h-5 ${selectedAddress?.id === address.id ? 'text-[#c1ff72]' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Side - Deposit Details */}
              <div className="lg:col-span-2">
                {selectedAddress && (
                  <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#c1ff72] to-green-400 rounded-full flex items-center justify-center">
                        <span className="text-xl font-bold text-black">{selectedAddress.tokenName?.[0] || 'C'}</span>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{selectedAddress.tokenName || 'Cryptocurrency'}</h2>
                        <p className="text-sm text-gray-600">{selectedAddress.network}</p>
                      </div>
                    </div>

                    {/* QR Code */}
                    <div className="flex justify-center mb-6">
                      <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                        {qrCode ? (
                          <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                        ) : (
                          <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#c1ff72]"></div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Address */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Deposit Address
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={selectedAddress.address || ''}
                          readOnly
                          className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono"
                        />
                        <button
                          onClick={copyAddress}
                          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
                        >
                          {copied ? (
                            <>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="hidden md:inline">Copied!</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span className="hidden md:inline">Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Network: {selectedAddress.network}
                      </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                          {error}
                        </div>
                      )}
                      
                      {success && (
                        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                          {success}
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Amount <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.00000001"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={`Enter amount in ${selectedAddress.tokenName || 'crypto'}`}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                            required
                            disabled={submitting}
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                            {selectedAddress.tokenName || 'CRYPTO'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Transaction ID <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={transactionId}
                          onChange={(e) => setTransactionId(e.target.value)}
                          placeholder="Enter transaction hash/ID"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent font-mono text-sm"
                          required
                          disabled={submitting}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          The transaction ID from your wallet after sending the deposit
                        </p>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Important Instructions
                        </h4>
                        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                          <li>Only send {selectedAddress.tokenName || 'cryptocurrency'} to this address</li>
                          <li>Ensure you're using the {selectedAddress.network} network</li>
                          <li>Minimum deposit may apply - check with support</li>
                          <li>Deposits are verified within 24 hours</li>
                        </ul>
                      </div>

                      <button
                        type="submit"
                        disabled={submitting || !amount || !transactionId}
                        className="w-full py-3 bg-[#c1ff72] text-black font-bold rounded-lg hover:bg-[#b0ef62] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <>
                            <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                            <span>Submitting...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Submit Deposit</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
