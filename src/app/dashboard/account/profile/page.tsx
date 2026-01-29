'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Save, Loader2 } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { toast } from 'react-hot-toast';
import { DashboardLayoutWrapper } from '@/components/layout/DashboardLayoutWrapper';
import { COUNTRY_CODES } from '@/constants/countries';
import AcredisPlusModal from '@/components/modals/AcredisPlusModal';
import axios from 'axios';

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    countryCode: '',
    dateOfBirth: '',
    address: '',
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPlusModal, setShowPlusModal] = useState(false);
  const [activatingPlus, setActivatingPlus] = useState(false);

  // Get user ID from localStorage (from login)
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

  const userId = getUserId();

  useEffect(() => {
    if (userId) {
      fetchProfile();
    } else {
      setInitialLoading(false);
      toast.error('Please log in to view your profile');
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`/api/profile?userId=${userId}`);
      const data = await response.json();

      if (response.ok && data.user) {
        setProfileData(data.user);
        setFormData({
          name: data.user.name || '',
          phoneNumber: data.user.phoneNumber || '',
          countryCode: data.user.countryCode || '',
          dateOfBirth: data.user.dateOfBirth
            ? new Date(data.user.dateOfBirth).toISOString().split('T')[0]
            : '',
          address: data.user.address || '',
        });
        setAvatarPreview(data.user.avatar);
      } else {
        toast.error(data.error || 'Failed to load profile');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleActivatePlus = async () => {
    if (!userId) return;

    setActivatingPlus(true);
    try {
      const response = await axios.post('/api/acredis-plus/activate', {
        userId
      });

      if (response.data.message) {
        // Update profile data
        setProfileData({ ...profileData, isPlusUser: true });
        setShowPlusModal(false);
        
        // Update localStorage
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          userData.isPlusUser = true;
          localStorage.setItem('user', JSON.stringify(userData));
        }
        
        // Show success message
        toast.success('🎉 Welcome to Acredis Plus! You now have access to exclusive premium benefits.');
        
        // Reload to update UI
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to activate Acredis Plus');
    } finally {
      setActivatingPlus(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (2MB max for base64 storage)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Preview image
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to server
    try {
      if (!userId) {
        toast.error('Please log in to upload avatar');
        setAvatarPreview(profileData?.avatar || null);
        return;
      }

      setUploadingAvatar(true);
      const formData = new FormData();
      formData.append('avatar', file);
      formData.append('userId', userId);

      const response = await fetch('/api/upload-avatar', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setProfileData({ ...profileData, avatar: data.avatarUrl });
        // Update localStorage
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          userData.avatar = data.avatarUrl;
          localStorage.setItem('user', JSON.stringify(userData));
        }
        toast.success('Profile picture updated!');
      } else {
        toast.error(data.error || 'Failed to upload image');
        setAvatarPreview(profileData?.avatar || null);
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload image');
      setAvatarPreview(profileData?.avatar || null);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId) {
      toast.error('Please log in to update profile');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...formData }),
      });

      const data = await response.json();

      if (response.ok) {
        setProfileData(data.user);
        // Update localStorage
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          Object.assign(userData, data.user);
          localStorage.setItem('user', JSON.stringify(userData));
        }
        toast.success('Profile updated successfully!');
      } else {
        toast.error(data.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-[#c1ff72]" size={40} />
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Unable to load profile. Please try again.</p>
      </div>
    );
  }

  return (
    <DashboardLayoutWrapper>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Profile Settings
          </h1>
          <p className="text-gray-600 mt-1">
            Manage your personal information
          </p>
        </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Avatar & Info */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl p-6 shadow">
                <div className="flex flex-col items-center">
                  <div className="relative mb-4">
                    {uploadingAvatar ? (
                      <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center">
                        <Loader2 className="animate-spin text-[#c1ff72]" size={32} />
                      </div>
                    ) : (
                      <Avatar
                        src={avatarPreview}
                        name={formData.name || profileData.name}
                        size="xl"
                        className="w-32 h-32"
                      />
                    )}
                    <button
                      onClick={handleAvatarClick}
                      disabled={uploadingAvatar}
                      className="absolute bottom-0 right-0 bg-[#c1ff72] hover:bg-[#b8e865] text-black p-2.5 rounded-full shadow-lg transition-colors disabled:opacity-50"
                    >
                      <Camera size={18} />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 text-center mb-1">
                    {profileData.name}
                  </h2>
                  <p className="text-sm text-gray-600 text-center mb-3">
                    {profileData.email}
                  </p>
                  <div className="flex flex-col items-center gap-2 mb-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {profileData.accountType === 'BUSINESS' ? 'Business Account' : 'Personal Account'}
                    </span>
                    {profileData.isPlusUser && (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-linear-to-r from-purple-600 to-indigo-600 text-white shadow-md">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        Acredis Plus Member
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">
                      Membership
                    </p>
                    {profileData.isPlusUser ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-purple-600">Acredis Plus</span>
                        <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-gray-700">Standard</span>
                        <button
                          onClick={() => setShowPlusModal(true)}
                          className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Upgrade to Plus
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">
                      Account Created
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(profileData.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">
                      Profile Status
                    </p>
                    <p className="text-sm font-medium">
                      {profileData.profileCompleted ? (
                        <span className="text-[#c1ff72]">Complete ✓</span>
                      ) : (
                        <span className="text-yellow-600">Incomplete</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl p-6 shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">
                  Personal Information
                </h3>
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] transition-colors"
                      placeholder="Enter your full name"
                    />
                  </div>

                  {/* Email (read-only) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={profileData.email}
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>

                  {/* Phone Number & Date of Birth - Same Line on Desktop */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Phone Number */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <div className="flex gap-2">
                        <select
                          name="countryCode"
                          value={formData.countryCode}
                          onChange={handleInputChange}
                          className="w-24 px-2 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72]"
                        >
                          {COUNTRY_CODES.map((country) => (
                            <option key={country.code} value={country.code}>
                              {country.flag} {country.code}
                            </option>
                          ))}
                        </select>
                        <input
                          type="tel"
                          name="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={handleInputChange}
                          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72]"
                          placeholder="8012345678"
                        />
                      </div>
                    </div>

                    {/* Date of Birth */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        name="dateOfBirth"
                        value={formData.dateOfBirth}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72]"
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address
                    </label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] resize-none"
                      placeholder="Enter your full address"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#c1ff72] hover:bg-[#b8e865] text-black font-semibold px-8 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={20} className="animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save size={20} />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

      {/* Acredis Plus Modal */}
      <AcredisPlusModal
        isOpen={showPlusModal}
        onClose={() => setShowPlusModal(false)}
        onActivate={handleActivatePlus}
        isActivating={activatingPlus}
      />
    </DashboardLayoutWrapper>
  );
}
