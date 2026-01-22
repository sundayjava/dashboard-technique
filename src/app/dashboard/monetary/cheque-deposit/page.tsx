'use client';

import { useState, useEffect } from 'react';
import { DashboardLayoutWrapper } from '@/components/layout/DashboardLayoutWrapper';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Upload, FileCheck, AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Account {
  id: string;
  accountNumber: string;
  accountName: string;
  currency: string;
  availableBalance: number;
  status: string;
}

interface ChequeDeposit {
  id: string;
  amount: number;
  currency: string;
  chequeImage: string | null;
  status: string;
  createdAt: string;
  processedAt: string | null;
  adminNotes: string | null;
  metadata?: any;
  account: {
    accountNumber: string;
    currency: string;
  };
}

export default function ChequeDepositPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [amount, setAmount] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeImage, setChequeImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [deposits, setDeposits] = useState<ChequeDeposit[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchAccounts();
    fetchDeposits();
  }, []);

  const getUserId = () => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          return userData.id;
        } catch (error) {
          console.error('Error parsing stored user:', error);
        }
      }
    }
    return null;
  };

  const fetchAccounts = async () => {
    const userId = getUserId();
    if (!userId) return;

    try {
      const response = await axios.get(`/api/accounts?userId=${userId}`);
      const activeAccounts = (response.data.accounts || []).filter(
        (acc: Account) => acc.status === 'ACTIVE'
      );
      setAccounts(activeAccounts);
      if (activeAccounts.length > 0) {
        setSelectedAccount(activeAccounts[0]);
      }
    } catch (err: any) {
      console.error('Error fetching accounts:', err);
      toast.error('Failed to fetch accounts');
    }
  };

  const fetchDeposits = async () => {
    const userId = getUserId();
    if (!userId) return;

    try {
      const response = await axios.get(`/api/cheque-deposits?userId=${userId}`);
      setDeposits(response.data.deposits || []);
    } catch (err: any) {
      console.error('Error fetching deposits:', err);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }

      setChequeImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAccount) {
      toast.error('Please select an account');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!chequeImage) {
      toast.error('Please upload a cheque image');
      return;
    }

    const userId = getUserId();
    if (!userId) {
      toast.error('Please login to continue');
      router.push('/login');
      return;
    }

    setLoading(true);

    try {
      // Upload cheque image
      const formData = new FormData();
      formData.append('file', chequeImage);
      formData.append('type', 'cheque');

      const uploadResponse = await axios.post('/api/upload-cheque', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const chequeImagePath = uploadResponse.data.filePath;

      // Submit cheque deposit
      const depositData = {
        userId,
        accountId: selectedAccount.id,
        amount: parseFloat(amount),
        chequeImage: chequeImagePath,
        chequeNumber: chequeNumber.trim() || undefined,
      };

      await axios.post('/api/cheque-deposits', depositData);

      toast.success('Cheque deposit submitted successfully! Awaiting admin approval.');
      
      // Reset form
      setAmount('');
      setChequeNumber('');
      setChequeImage(null);
      setImagePreview('');
      fetchDeposits();
    } catch (err: any) {
      console.error('Error submitting cheque deposit:', err);
      toast.error(err.response?.data?.error || 'Failed to submit cheque deposit');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-4 h-4 mr-1" />
            Pending
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-4 h-4 mr-1" />
            Completed
          </span>
        );
      case 'FAILED':
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircle className="w-4 h-4 mr-1" />
            {status === 'FAILED' ? 'Failed' : 'Cancelled'}
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            <Clock className="w-4 h-4 mr-1" />
            Processing
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <DashboardLayoutWrapper>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Cheque Deposit</h1>
          <p className="text-gray-600 mt-2">Upload your cheque for processing</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setShowHistory(false)}
            className={`pb-3 px-4 font-medium transition-colors ${
              !showHistory
                ? 'border-b-2 border-[#c1ff72] text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            New Deposit
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className={`pb-3 px-4 font-medium transition-colors ${
              showHistory
                ? 'border-b-2 border-[#c1ff72] text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            History ({deposits.length})
          </button>
        </div>

        {!showHistory ? (
          /* Deposit Form */
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Account Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deposit To Account <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedAccount?.id || ''}
                  onChange={(e) => {
                    const account = accounts.find(a => a.id === e.target.value);
                    setSelectedAccount(account || null);
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                  required
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountName} - {account.accountNumber} ({account.currency} {account.availableBalance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cheque Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                    {selectedAccount?.currency || 'USD'}
                  </span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                    className="w-full pl-20 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Enter the amount written on the cheque</p>
              </div>

              {/* Cheque Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cheque Number <span className="text-gray-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                  placeholder="Enter cheque number"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">The cheque number helps with tracking and verification</p>
              </div>

              {/* Cheque Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Cheque Image <span className="text-red-500">*</span>
                </label>
                
                {!imagePreview ? (
                  <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#c1ff72] transition-colors bg-gray-50">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-12 h-12 text-gray-400 mb-3" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">PNG, JPG or JPEG (MAX. 5MB)</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageChange}
                      required
                    />
                  </label>
                ) : (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Cheque preview"
                      className="w-full h-auto max-h-96 object-contain border border-gray-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setChequeImage(null);
                        setImagePreview('');
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Info Alert */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Important Information</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Ensure the cheque image is clear and readable</li>
                    <li>All four corners of the cheque must be visible</li>
                    <li>Your deposit will be processed within 1-3 business days</li>
                    <li>You will receive a notification once processed</li>
                  </ul>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#c1ff72] text-gray-900 py-4 rounded-lg font-semibold hover:bg-[#b0ee61] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <FileCheck className="w-5 h-5" />
                    Submit Cheque Deposit
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Deposit History */
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {deposits.length === 0 ? (
              <div className="text-center py-16">
                <FileCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No cheque deposits yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cheque Number
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {deposits.map((deposit) => (
                      <tr key={deposit.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(deposit.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {deposit.metadata?.chequeNumber || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {deposit.currency} {deposit.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(deposit.status)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {deposit.adminNotes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayoutWrapper>
  );
}
