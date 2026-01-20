'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  countryCode: string;
  currency: string;
  accountType: string;
  canTransfer: boolean;
  transferDisabled: boolean;
  accountDisabled: boolean;
  isVerified: boolean;
  requireOTPForInternational: boolean;
  authorizationCode: string;
  address: string | null;
  isPlusUser: boolean;
  role: string;
}

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    countryCode: '',
    currency: '',
    accountType: '',
    canTransfer: true,
    transferDisabled: false,
    accountDisabled: false,
    isVerified: false,
    requireOTPForInternational: false,
    authorizationCode: '',
    address: '',
    isPlusUser: false,
    role: 'USER',
    password: '',
    transactionPin: '',
  });

  useEffect(() => {
    fetchUser();
  }, [userId]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/admin/users/${userId}`);
      const user = response.data;
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        countryCode: user.countryCode || '+1',
        currency: user.currency || 'USD',
        accountType: user.accountType || 'PERSONAL',
        canTransfer: user.canTransfer ?? true,
        transferDisabled: user.transferDisabled ?? false,
        accountDisabled: user.accountDisabled ?? false,
        isVerified: user.emailVerified ?? false,
        requireOTPForInternational: user.requireOTPForInternational ?? false,
        authorizationCode: user.authorizationCode || '',
        address: user.address || '',
        isPlusUser: user.isPlusUser ?? false,
        role: user.role || 'USER',
        password: '',
        transactionPin: '',
      });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fetch user');
      router.push('/admin/users');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      
      // Handle mutual exclusivity for transfer types
      if (name === 'canTransfer' && checked) {
        setFormData(prev => ({ ...prev, canTransfer: true, requireOTPForInternational: false }));
      } else if (name === 'requireOTPForInternational' && checked) {
        setFormData(prev => ({ ...prev, requireOTPForInternational: true, canTransfer: false }));
      } else {
        setFormData(prev => ({ ...prev, [name]: checked }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      await axios.patch(`/api/admin/users/${userId}`, formData);
      toast.success('User updated successfully');
      router.push('/admin/users');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading user details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit User</h1>
          <p className="mt-2 text-gray-600">Update user information</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Personal Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country Code <span className="text-red-500">*</span>
                </label>
                <select
                  name="countryCode"
                  value={formData.countryCode}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="+1">+1 (USA/Canada)</option>
                  <option value="+44">+44 (UK)</option>
                  <option value="+234">+234 (Nigeria)</option>
                  <option value="+91">+91 (India)</option>
                  <option value="+86">+86 (China)</option>
                  <option value="+81">+81 (Japan)</option>
                  <option value="+49">+49 (Germany)</option>
                  <option value="+33">+33 (France)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  placeholder="1234567890"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Authorization Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="authorizationCode"
                  value={formData.authorizationCode}
                  onChange={handleChange}
                  placeholder="AC1234567890"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="123 Main St, City, Country"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Account Settings */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User Role <span className="text-red-500">*</span>
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                  <option value="MODERATOR">Moderator</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="accountType"
                  value={formData.accountType}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="PERSONAL">Personal</option>
                  <option value="BUSINESS">Business</option>
                  <option value="CORPORATE">Corporate</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Currency <span className="text-red-500">*</span>
                </label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="NGN">NGN - Nigerian Naira</option>
                  <option value="JPY">JPY - Japanese Yen</option>
                  <option value="CNY">CNY - Chinese Yuan</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Leave blank to keep current password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  minLength={8}
                />
                <p className="text-xs text-gray-500 mt-1">Min. 8 characters (leave blank to keep current)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Transaction PIN
                </label>
                <input
                  type="password"
                  name="transactionPin"
                  value={formData.transactionPin}
                  onChange={handleChange}
                  placeholder="Leave blank to keep current PIN"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  minLength={4}
                  maxLength={6}
                />
                <p className="text-xs text-gray-500 mt-1">4-6 digits (leave blank to keep current)</p>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> You can edit all user details including personal information, authorization code, 
              address, role, email verification status, Acredis Plus subscription, transfer permissions, 
              password, and transaction PIN. Direct Transfer and Code Transfer (OTP) are mutually exclusive. 
              Changes will take effect immediately and users will be notified of critical updates.
            </p>
          </div>

          {/* Permissions & Status */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Permissions & Status</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  name="isVerified"
                  checked={formData.isVerified}
                  onChange={handleChange}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Email Verified</p>
                  <p className="text-xs text-gray-500">Mark user's email as verified</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  name="isPlusUser"
                  checked={formData.isPlusUser}
                  onChange={handleChange}
                  className="w-5 h-5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Acredis Plus User</p>
                  <p className="text-xs text-gray-500">Grant premium features and benefits</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  name="canTransfer"
                  checked={formData.canTransfer}
                  onChange={handleChange}
                  className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Enable Direct Transfer</p>
                  <p className="text-xs text-gray-500">User can transfer funds directly without OTP verification</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  name="requireOTPForInternational"
                  checked={formData.requireOTPForInternational}
                  onChange={handleChange}
                  className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Enable Code Transfer (OTP Required)</p>
                  <p className="text-xs text-gray-500">User must enter OTP code via email for all transfers</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 border border-orange-200 rounded-lg hover:bg-orange-50 cursor-pointer bg-orange-50/50">
                <input
                  type="checkbox"
                  name="transferDisabled"
                  checked={formData.transferDisabled}
                  onChange={handleChange}
                  className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <div>
                  <p className="text-sm font-medium text-orange-900">Disable All Transfers</p>
                  <p className="text-xs text-orange-600">User will not be able to make any transfers (domestic, international, or Acredis-to-Acredis)</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer bg-red-50/50">
                <input
                  type="checkbox"
                  name="accountDisabled"
                  checked={formData.accountDisabled}
                  onChange={handleChange}
                  className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <div>
                  <p className="text-sm font-medium text-red-900">Disable Account</p>
                  <p className="text-xs text-red-600">User will not be able to access their account</p>
                </div>
              </label>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Direct Transfer and Code Transfer (OTP) are mutually exclusive. 
              "Disable All Transfers" will prevent all transfer types regardless of other settings.
              Changes will take effect immediately.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4 pt-4 border-t">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={saving}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
