'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { DashboardTopBar } from '@/components/layout/DashboardTopBar';
import { sidebarItems } from '@/config/sidebar.config';
import toast from 'react-hot-toast';

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

interface Account {
  id: string;
  accountNumber: string;
  accountName: string;
  currency: string;
  balance: number;
  status: string;
}

interface BankDeposit {
  id: string;
  amount: number;
  reference: string;
  status: string;
  createdAt: string;
  processedAt: string | null;
  adminNotes: string | null;
  bankName: string | null;
  accountNumber: string | null;
  account: Account;
  depositAddress?: DepositAddress;
}

export default function BankDepositPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  
  // Data
  const [bankAddresses, setBankAddresses] = useState<DepositAddress[]>([]);
  const [userAccounts, setUserAccounts] = useState<Account[]>([]);
  const [deposits, setDeposits] = useState<BankDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form fields
  const [selectedBankAddress, setSelectedBankAddress] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [copiedField, setCopiedField] = useState<string>('');

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
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchBankAddresses(),
        fetchUserAccounts(),
        fetchDeposits(),
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBankAddresses = async () => {
    try {
      const response = await axios.get(`/api/user-addresses?userId=${user?.id}`);
      // Filter only BANK addresses
      const bankAddrs = response.data.addresses.filter(
        (addr: DepositAddress) => addr.type === 'BANK'
      );
      setBankAddresses(bankAddrs);
    } catch (error) {
      console.error('Error fetching bank addresses:', error);
    }
  };

  const fetchUserAccounts = async () => {
    try {
      const response = await axios.get(`/api/accounts?userId=${user?.id}`);
      const activeAccounts = response.data.accounts.filter(
        (acc: Account) => acc.status === 'ACTIVE'
      );
      setUserAccounts(activeAccounts);
      if (activeAccounts.length > 0) {
        setSelectedAccount(activeAccounts[0].id);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const fetchDeposits = async () => {
    try {
      const response = await axios.get(`/api/bank-deposits?userId=${user?.id}`);
      setDeposits(response.data.deposits);
    } catch (error) {
      console.error('Error fetching deposits:', error);
    }
  };

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      toast.success(`${fieldName} copied!`);
      setTimeout(() => setCopiedField(''), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBankAddress) {
      toast.error('Please select a bank account');
      return;
    }

    if (!selectedAccount) {
      toast.error('Please select an account to credit');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!referenceNumber.trim()) {
      toast.error('Please enter the transaction reference number');
      return;
    }

    setSubmitting(true);

    try {
      // Get the selected bank address details
      const selectedAddress = bankAddresses.find(addr => addr.id === selectedBankAddress);
      
      await axios.post('/api/bank-deposits', {
        userId: user?.id,
        accountId: selectedAccount,
        amount: parseFloat(amount),
        referenceNumber: referenceNumber.trim(),
        bankName: selectedAddress?.bankName || null,
        bankCode: selectedAddress?.swiftCode || selectedAddress?.routingNumber || null,
        accountNumber: selectedAddress?.accountNumber || null,
      });

      toast.success('Bank deposit submitted successfully!');
      setAmount('');
      setReferenceNumber('');
      setSelectedBankAddress('');
      
      // Refresh deposits
      await fetchDeposits();
      
      // Switch to history tab
      setActiveTab('history');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit deposit');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING: (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Pending
        </span>
      ),
      APPROVED: (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Approved
        </span>
      ),
      REJECTED: (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Rejected
        </span>
      ),
    };
    return badges[status as keyof typeof badges] || null;
  };

  const selectedBankDetails = bankAddresses.find(ba => ba.id === selectedBankAddress);

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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg md:text-2xl font-bold text-gray-900">Bank Deposit</h1>
                <p className="text-sm md:text-base text-gray-600">Deposit funds via bank transfer</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-sm mb-6">
            <div className="border-b border-gray-200">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('new')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'new'
                      ? 'border-b-2 border-[#c1ff72] text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  New Deposit
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'history'
                      ? 'border-b-2 border-[#c1ff72] text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  History
                </button>
              </div>
            </div>

            <div className="p-4 md:p-6">
              {activeTab === 'new' ? (
                <>
                  {bankAddresses.length === 0 ? (
                    <div className="text-center py-8">
                      <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      <p className="text-gray-600 mb-2">No Bank Accounts Assigned</p>
                      <p className="text-sm text-gray-500">Please contact admin to have bank accounts assigned to you</p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Select Bank */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Bank
                        </label>
                        <select
                          value={selectedBankAddress}
                          onChange={(e) => setSelectedBankAddress(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                          required
                        >
                          <option value="">Choose a bank...</option>
                          {bankAddresses.map((ba) => (
                            <option key={ba.id} value={ba.id}>
                              {ba.bankName} {ba.country ? `(${ba.country})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Bank Account Details */}
                      {selectedBankDetails && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h3 className="font-semibold text-blue-900 mb-3">Bank Account Details</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-blue-700">Bank:</span>
                              <span className="font-medium text-blue-900">{selectedBankDetails.bankName}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-blue-700">Account Name:</span>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-blue-900">{selectedBankDetails.accountName}</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(selectedBankDetails.accountName || '', 'Account Name')}
                                  className="p-1 hover:bg-blue-100 rounded transition-colors"
                                  title="Copy account name"
                                >
                                  {copiedField === 'Account Name' ? (
                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-blue-700">Account Number:</span>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-blue-900 font-mono">{selectedBankDetails.accountNumber}</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(selectedBankDetails.accountNumber || '', 'Account Number')}
                                  className="p-1 hover:bg-blue-100 rounded transition-colors"
                                  title="Copy account number"
                                >
                                  {copiedField === 'Account Number' ? (
                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            </div>
                            {selectedBankDetails.swiftCode && (
                              <div className="flex justify-between items-center">
                                <span className="text-blue-700">SWIFT Code:</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-blue-900 font-mono">{selectedBankDetails.swiftCode}</span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(selectedBankDetails.swiftCode || '', 'SWIFT Code')}
                                    className="p-1 hover:bg-blue-100 rounded transition-colors"
                                    title="Copy SWIFT code"
                                  >
                                    {copiedField === 'SWIFT Code' ? (
                                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                            {selectedBankDetails.routingNumber && (
                              <div className="flex justify-between items-center">
                                <span className="text-blue-700">Routing Number:</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-blue-900 font-mono">{selectedBankDetails.routingNumber}</span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(selectedBankDetails.routingNumber || '', 'Routing Number')}
                                    className="p-1 hover:bg-blue-100 rounded transition-colors"
                                    title="Copy routing number"
                                  >
                                    {copiedField === 'Routing Number' ? (
                                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                            {selectedBankDetails.country && (
                              <div className="flex justify-between items-center">
                                <span className="text-blue-700">Country:</span>
                                <span className="font-medium text-blue-900">{selectedBankDetails.country}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Account to Credit */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Account to Credit
                        </label>
                        <select
                          value={selectedAccount}
                          onChange={(e) => setSelectedAccount(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                          required
                        >
                          {userAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.accountName} ({acc.accountNumber}) - {acc.currency} {acc.balance.toFixed(2)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Amount */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Amount
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                          required
                        />
                      </div>

                      {/* Reference Number */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Transaction Reference Number
                        </label>
                        <input
                          type="text"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                          placeholder="Enter the reference/transaction ID from your bank"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-transparent"
                          required
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Please provide the transaction reference number from your bank transfer
                        </p>
                      </div>

                      {/* Info Alert */}
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex gap-3">
                          <svg className="w-5 h-5 text-yellow-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="text-sm text-yellow-800">
                            <p className="font-semibold mb-1">Important:</p>
                            <ul className="list-disc list-inside space-y-1 text-xs">
                              <li>Transfer the exact amount to the bank account shown above</li>
                              <li>Use the transaction reference number from your bank</li>
                              <li>Your deposit will be verified by our admin team</li>
                              <li>Processing time: 1-2 business days</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-[#c1ff72] text-black font-semibold py-3 px-4 rounded-lg hover:bg-[#b0ef62] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting ? 'Submitting...' : 'Submit Deposit'}
                      </button>
                    </form>
                  )}
                </>
              ) : (
                /* History Tab */
                <div>
                  {deposits.length === 0 ? (
                    <div className="text-center py-8">
                      <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-600">No deposit history</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bank</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {deposits.map((deposit) => (
                            <tr key={deposit.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {deposit.bankName || 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">${deposit.amount.toFixed(2)}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{deposit.reference || 'N/A'}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {deposit.createdAt ? new Date(deposit.createdAt).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="px-4 py-3">{getStatusBadge(deposit.status)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
