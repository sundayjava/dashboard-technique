'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Upload, CheckCircle, XCircle, Clock, AlertCircle, Camera } from 'lucide-react';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { DashboardTopBar } from '@/components/layout/DashboardTopBar';
import { sidebarItems } from '@/config/sidebar.config';
import axios from 'axios';

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 
  'France', 'Spain', 'Italy', 'Netherlands', 'Switzerland', 'Sweden',
  'Norway', 'Denmark', 'Finland', 'Belgium', 'Austria', 'Ireland',
  'Portugal', 'Greece', 'Poland', 'Czech Republic', 'Hungary',
  'Romania', 'Bulgaria', 'Croatia', 'Slovakia', 'Slovenia',
  'Estonia', 'Latvia', 'Lithuania', 'Malta', 'Cyprus',
  'Nigeria', 'South Africa', 'Kenya', 'Ghana', 'Egypt',
  'India', 'China', 'Japan', 'South Korea', 'Singapore',
  'Malaysia', 'Thailand', 'Vietnam', 'Philippines', 'Indonesia',
  'Brazil', 'Mexico', 'Argentina', 'Chile', 'Colombia',
  'Peru', 'Venezuela', 'Ecuador', 'Uruguay', 'Paraguay',
  'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain',
  'Oman', 'Jordan', 'Lebanon', 'Israel', 'Turkey',
].sort();

const DOCUMENT_TYPES = [
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'NATIONAL_ID', label: 'National ID Card' },
  { value: 'DRIVERS_LICENSE', label: 'Driver\'s License' },
  { value: 'RESIDENCE_PERMIT', label: 'Residence Permit' },
];

export default function KYCPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [kycData, setKycData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '',
    nationality: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    documentType: 'PASSPORT',
    documentNumber: '',
    occupation: '',
    employerName: '',
    annualIncome: '',
    sourceOfFunds: '',
  });

  // File uploads
  const [documentFront, setDocumentFront] = useState<File | null>(null);
  const [documentBack, setDocumentBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [documentFrontPreview, setDocumentFrontPreview] = useState<string | null>(null);
  const [documentBackPreview, setDocumentBackPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);

  const documentFrontRef = useRef<HTMLInputElement>(null);
  const documentBackRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  const getUserId = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userId');
    }
    return null;
  };

  useEffect(() => {
    const userId = getUserId();
    if (userId) {
      fetchUser(userId);
      fetchKYC(userId);
    } else {
      setLoading(false);
      toast.error('Please log in to access this page');
      router.push('/login');
    }
  }, []);

  const fetchUser = async (userId: string) => {
    try {
      const response = await axios.get(`/api/profile?userId=${userId}`);
      setUser(response.data.user);
      
      // Pre-fill form with user data
      if (response.data.user) {
        setFormData(prev => ({
          ...prev,
          fullName: response.data.user.name || '',
          address: response.data.user.address || '',
        }));
      }
    } catch (error: any) {
      console.error('Error fetching user:', error);
      toast.error('Failed to load user data');
    }
  };

  const fetchKYC = async (userId: string) => {
    try {
      const response = await axios.get(`/api/kyc?userId=${userId}`);
      if (response.data.kyc) {
        setKycData(response.data.kyc);
        // Pre-fill form with existing KYC data
        setFormData({
          fullName: response.data.kyc.fullName || '',
          dateOfBirth: response.data.kyc.dateOfBirth ? new Date(response.data.kyc.dateOfBirth).toISOString().split('T')[0] : '',
          nationality: response.data.kyc.nationality || '',
          address: response.data.kyc.address || '',
          city: response.data.kyc.city || '',
          state: response.data.kyc.state || '',
          postalCode: response.data.kyc.postalCode || '',
          country: response.data.kyc.country || '',
          documentType: response.data.kyc.documentType || 'PASSPORT',
          documentNumber: response.data.kyc.documentNumber || '',
          occupation: response.data.kyc.occupation || '',
          employerName: response.data.kyc.employerName || '',
          annualIncome: response.data.kyc.annualIncome || '',
          sourceOfFunds: response.data.kyc.sourceOfFunds || '',
        });
        setDocumentFrontPreview(response.data.kyc.documentFrontImage);
        setDocumentBackPreview(response.data.kyc.documentBackImage);
        setSelfiePreview(response.data.kyc.selfieImage);
      }
    } catch (error: any) {
      console.error('Error fetching KYC:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'front' | 'back' | 'selfie'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'front') setDocumentFrontPreview(reader.result as string);
      if (type === 'back') setDocumentBackPreview(reader.result as string);
      if (type === 'selfie') setSelfiePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Set file
    if (type === 'front') setDocumentFront(file);
    if (type === 'back') setDocumentBack(file);
    if (type === 'selfie') setSelfie(file);
  };

  const uploadFile = async (file: File, documentType: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', getUserId() || '');
    formData.append('documentType', documentType);

    const response = await axios.post('/api/upload-kyc-document', formData);
    return response.data.url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const userId = getUserId();
    if (!userId) {
      toast.error('Please log in to submit KYC');
      return;
    }

    // Validate required files
    if (!documentFrontPreview) {
      toast.error('Please upload document front image');
      return;
    }

    if (!selfiePreview) {
      toast.error('Please upload a selfie');
      return;
    }

    setSubmitting(true);

    try {
      let documentFrontUrl = documentFrontPreview;
      let documentBackUrl = documentBackPreview;
      let selfieUrl = selfiePreview;

      // Upload new files if changed
      if (documentFront) {
        setUploadingFront(true);
        documentFrontUrl = await uploadFile(documentFront, 'front');
        setUploadingFront(false);
      }

      if (documentBack) {
        setUploadingBack(true);
        documentBackUrl = await uploadFile(documentBack, 'back');
        setUploadingBack(false);
      }

      if (selfie) {
        setUploadingSelfie(true);
        selfieUrl = await uploadFile(selfie, 'selfie');
        setUploadingSelfie(false);
      }

      // Submit KYC
      const response = await axios.post('/api/kyc', {
        userId,
        ...formData,
        documentFrontImage: documentFrontUrl,
        documentBackImage: documentBackUrl,
        selfieImage: selfieUrl,
      });

      toast.success(response.data.message);
      fetchKYC(userId);
    } catch (error: any) {
      console.error('Error submitting KYC:', error);
      toast.error(error.response?.data?.error || 'Failed to submit KYC');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      UNDER_REVIEW: 'bg-blue-100 text-blue-800 border-blue-200',
      APPROVED: 'bg-green-100 text-green-800 border-green-200',
      REJECTED: 'bg-red-100 text-red-800 border-red-200',
      RESUBMIT_REQUIRED: 'bg-orange-100 text-orange-800 border-orange-200',
    };

    const icons = {
      PENDING: <Clock className="w-4 h-4" />,
      UNDER_REVIEW: <AlertCircle className="w-4 h-4" />,
      APPROVED: <CheckCircle className="w-4 h-4" />,
      REJECTED: <XCircle className="w-4 h-4" />,
      RESUBMIT_REQUIRED: <AlertCircle className="w-4 h-4" />,
    };

    return (
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${styles[status as keyof typeof styles] || styles.PENDING}`}>
        {icons[status as keyof typeof icons]}
        <span className="font-semibold">{status.replace(/_/g, ' ')}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500 text-lg">Loading KYC information...</p>
      </div>
    );
  }

  // Show status if KYC is already submitted and approved
  if (kycData && kycData.status === 'APPROVED') {
    return (
      <div className="min-h-screen bg-white">
        <DashboardSidebar 
          items={sidebarItems}
          userId={getUserId() || undefined}
          onCollapseChange={setSidebarCollapsed}
          isMobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
        <DashboardTopBar 
          user={user}
          sidebarCollapsed={sidebarCollapsed}
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        <main
          className={`pt-24 pb-8 px-4 md:px-6 transition-all duration-300 ${
            sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
          }`}
        >
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-900 mb-2">KYC Verified</h1>
              <p className="text-gray-600 mb-6">Your identity has been successfully verified.</p>
              {getStatusBadge(kycData.status)}
              <div className="mt-8 p-6 bg-gray-50 rounded-lg text-left">
                <h3 className="font-semibold text-gray-900 mb-4">Verification Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Full Name</p>
                    <p className="font-medium text-gray-900">{kycData.fullName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Nationality</p>
                    <p className="font-medium text-gray-900">{kycData.nationality}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Document Type</p>
                    <p className="font-medium text-gray-900">{kycData.documentType.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Verified Date</p>
                    <p className="font-medium text-gray-900">
                      {new Date(kycData.verifiedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Show status if KYC is pending or under review
  if (kycData && (kycData.status === 'PENDING' || kycData.status === 'UNDER_REVIEW')) {
    return (
      <div className="min-h-screen bg-white">
        <DashboardSidebar 
          items={sidebarItems}
          userId={getUserId() || undefined}
          onCollapseChange={setSidebarCollapsed}
          isMobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
        <DashboardTopBar 
          user={user}
          sidebarCollapsed={sidebarCollapsed}
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        <main
          className={`pt-24 pb-8 px-4 md:px-6 transition-all duration-300 ${
            sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
          }`}
        >
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <Clock className="w-20 h-20 text-yellow-600 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-900 mb-2">KYC Under Review</h1>
              <p className="text-gray-600 mb-6">
                Your KYC verification is currently being reviewed. This typically takes 1-3 business days.
              </p>
              {getStatusBadge(kycData.status)}
              <div className="mt-8 p-6 bg-gray-50 rounded-lg text-left">
                <h3 className="font-semibold text-gray-900 mb-4">Submission Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Full Name</p>
                    <p className="font-medium text-gray-900">{kycData.fullName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Submitted Date</p>
                    <p className="font-medium text-gray-900">
                      {new Date(kycData.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Document Type</p>
                    <p className="font-medium text-gray-900">{kycData.documentType.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Nationality</p>
                    <p className="font-medium text-gray-900">{kycData.nationality}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Show form for new submission or resubmission
  return (
    <div className="min-h-screen bg-white">
      <DashboardSidebar 
        items={sidebarItems}
        userId={getUserId() || undefined}
        onCollapseChange={setSidebarCollapsed}
        isMobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <DashboardTopBar 
        user={user}
        sidebarCollapsed={sidebarCollapsed}
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />
      <main
        className={`pt-24 pb-8 px-4 md:px-6 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">KYC Verification</h1>
            <p className="text-gray-600">
              Complete your identity verification to unlock all features
            </p>
          </div>

          {/* Rejection notice */}
          {kycData && (kycData.status === 'REJECTED' || kycData.status === 'RESUBMIT_REQUIRED') && (
            <div className="mb-6 p-6 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <XCircle className="w-6 h-6 text-red-600 shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-red-900 mb-1">
                    {kycData.status === 'REJECTED' ? 'KYC Rejected' : 'Resubmission Required'}
                  </h3>
                  <p className="text-red-800">{kycData.rejectionReason}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Personal Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Personal Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                    placeholder="Enter your full legal name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nationality <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="nationality"
                    value={formData.nationality}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                  >
                    <option value="">Select nationality</option>
                    {COUNTRIES.map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Occupation
                  </label>
                  <input
                    type="text"
                    name="occupation"
                    value={formData.occupation}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                    placeholder="e.g., Software Engineer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employer Name
                  </label>
                  <input
                    type="text"
                    name="employerName"
                    value={formData.employerName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                    placeholder="Company name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Annual Income
                  </label>
                  <input
                    type="text"
                    name="annualIncome"
                    value={formData.annualIncome}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                    placeholder="e.g., $50,000 - $100,000"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Source of Funds
                  </label>
                  <input
                    type="text"
                    name="sourceOfFunds"
                    value={formData.sourceOfFunds}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                    placeholder="e.g., Employment, Business, Investments"
                  />
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Address Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Street Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    required
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none resize-none"
                    placeholder="Enter your full address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                    placeholder="City"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State/Province <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                    placeholder="State/Province"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Postal Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                    placeholder="Postal/ZIP code"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                  >
                    <option value="">Select country</option>
                    {COUNTRIES.map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Identity Document */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Identity Document</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="documentType"
                    value={formData.documentType}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                  >
                    {DOCUMENT_TYPES.map((doc) => (
                      <option key={doc.value} value={doc.value}>{doc.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="documentNumber"
                    value={formData.documentNumber}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                    placeholder="Enter document number"
                  />
                </div>
              </div>

              {/* Document Upload */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Front Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Front <span className="text-red-500">*</span>
                  </label>
                  <div
                    onClick={() => documentFrontRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      documentFrontPreview ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-[#c1ff72] hover:bg-gray-50'
                    }`}
                  >
                    {uploadingFront ? (
                      <div className="py-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-[#c1ff72]"></div>
                        <p className="mt-2 text-sm text-gray-600">Uploading...</p>
                      </div>
                    ) : documentFrontPreview ? (
                      <div>
                        <img src={documentFrontPreview} alt="Document Front" className="w-full h-32 object-cover rounded mb-2" />
                        <p className="text-sm text-green-600 font-medium">✓ Uploaded</p>
                      </div>
                    ) : (
                      <div className="py-8">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Click to upload</p>
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG (max 5MB)</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={documentFrontRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'front')}
                    className="hidden"
                  />
                </div>

                {/* Back Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Back {formData.documentType !== 'PASSPORT' && <span className="text-red-500">*</span>}
                  </label>
                  <div
                    onClick={() => documentBackRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      documentBackPreview ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-[#c1ff72] hover:bg-gray-50'
                    }`}
                  >
                    {uploadingBack ? (
                      <div className="py-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-[#c1ff72]"></div>
                        <p className="mt-2 text-sm text-gray-600">Uploading...</p>
                      </div>
                    ) : documentBackPreview ? (
                      <div>
                        <img src={documentBackPreview} alt="Document Back" className="w-full h-32 object-cover rounded mb-2" />
                        <p className="text-sm text-green-600 font-medium">✓ Uploaded</p>
                      </div>
                    ) : (
                      <div className="py-8">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Click to upload</p>
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG (max 5MB)</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={documentBackRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'back')}
                    className="hidden"
                  />
                </div>

                {/* Selfie */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selfie with Document <span className="text-red-500">*</span>
                  </label>
                  <div
                    onClick={() => selfieRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      selfiePreview ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-[#c1ff72] hover:bg-gray-50'
                    }`}
                  >
                    {uploadingSelfie ? (
                      <div className="py-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-[#c1ff72]"></div>
                        <p className="mt-2 text-sm text-gray-600">Uploading...</p>
                      </div>
                    ) : selfiePreview ? (
                      <div>
                        <img src={selfiePreview} alt="Selfie" className="w-full h-32 object-cover rounded mb-2" />
                        <p className="text-sm text-green-600 font-medium">✓ Uploaded</p>
                      </div>
                    ) : (
                      <div className="py-8">
                        <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Click to upload</p>
                        <p className="text-xs text-gray-500 mt-1">Clear face photo</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={selfieRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'selfie')}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Tip:</strong> For best results, ensure your document is clearly visible, well-lit, and all text is readable. 
                  For the selfie, hold your ID next to your face and look directly at the camera.
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || uploadingFront || uploadingBack || uploadingSelfie}
                className="px-8 py-3 bg-[#c1ff72] hover:bg-[#b0ef62] text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {submitting ? 'Submitting...' : kycData ? 'Resubmit KYC' : 'Submit KYC'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
