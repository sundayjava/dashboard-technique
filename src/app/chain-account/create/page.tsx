'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SessionManager } from '@/lib/session';
import Image from 'next/image';
import axios from 'axios';
import {
  ArrowLeft, ArrowRight, Check, Users,
  FileText, DollarSign, Shield, Loader2,
  AlertCircle, CheckCircle, X
} from 'lucide-react';
import toast from 'react-hot-toast';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

interface CoSignatory {
  email: string;
  name: string | null;
  userId: string;
  verified: boolean;
  error?: string;
}

interface FormData {
  // Step 1
  primaryPurpose: string;
  purposeOther: string;
  accountName: string;
  purposeDescription: string;

  // Step 2
  numberOfParties: number;
  relationship: string;
  relationshipOther: string;
  coSignatories: CoSignatory[];

  // Step 3
  expectedMonthlyVolume: string;
  combinedCapitalLevel: string;
  intendedAssetHoldings: string;

  // Step 4
  authorizationModel: string;
  thresholdAmount: string;
  thresholdCurrency: string;

  // Step 5
  consentConfirmed: boolean;
}

export default function CreateChainAccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validatingEmail, setValidatingEmail] = useState<number | null>(null);

  const [formData, setFormData] = useState<FormData>({
    primaryPurpose: '',
    purposeOther: '',
    accountName: '',
    purposeDescription: '',
    numberOfParties: 2,
    relationship: '',
    relationshipOther: '',
    coSignatories: [
      // 2 parties = 1 co-signatory (2 - 1 = 1)
      { email: '', name: null, userId: '', verified: false },
    ],
    expectedMonthlyVolume: '',
    combinedCapitalLevel: '',
    intendedAssetHoldings: '',
    authorizationModel: '',
    thresholdAmount: '',
    thresholdCurrency: 'USD',
    consentConfirmed: false,
  });

  // Initialize user
  useEffect(() => {
    const userData = SessionManager.getUser();
    if (userData) {
      setUser(userData);
    } else {
      router.push('/login');
    }
  }, [router]);

  const steps = [
    { number: 1, title: 'Account', icon: FileText },
    { number: 2, title: 'Parties', icon: Users },
    { number: 3, title: 'Profile', icon: DollarSign },
    { number: 4, title: 'Permissions', icon: Shield },
    { number: 5, title: 'Declaration', icon: Check },
  ];

  // Update number of co-signatories when numberOfParties changes
  const updateCoSignatories = (count: number) => {
    const coSignatoriesCount = count - 1; // Subtract 1 for primary holder
    const current = formData.coSignatories;

    if (coSignatoriesCount > current.length) {
      // Add more slots
      const newSlots = Array(coSignatoriesCount - current.length).fill(null).map(() => ({
        email: '',
        name: null,
        userId: '',
        verified: false,
      }));
      setFormData({ ...formData, coSignatories: [...current, ...newSlots] });
    } else if (coSignatoriesCount < current.length) {
      // Remove excess slots
      setFormData({ ...formData, coSignatories: current.slice(0, coSignatoriesCount) });
    }
  };

  // Validate email and fetch user data
  const validateCoSignatoryEmail = async (index: number, email: string) => {
    if (!email || !email.includes('@')) {
      const updated = [...formData.coSignatories];
      updated[index] = { email, name: null, userId: '', verified: false, error: undefined };
      setFormData({ ...formData, coSignatories: updated });
      return;
    }

    setValidatingEmail(index);

    try {
      const response = await axios.post('/api/chain-account/validate-member', {
        email: email.trim().toLowerCase(),
        excludeUserId: user?.id, // Exclude self
      });

      if (response.data.success) {
        const updated = [...formData.coSignatories];
        updated[index] = {
          email: email.trim().toLowerCase(),
          name: response.data.user.name,
          userId: response.data.user.id,
          verified: true,
        };
        setFormData({ ...formData, coSignatories: updated });
      }
    } catch (error: any) {
      const updated = [...formData.coSignatories];
      updated[index] = {
        email: email.trim().toLowerCase(),
        name: null,
        userId: '',
        verified: false,
        error: error.response?.data?.error || 'Failed to validate email',
      };
      setFormData({ ...formData, coSignatories: updated });
    } finally {
      setValidatingEmail(null);
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.primaryPurpose) {
          toast.error('Please select the primary purpose');
          return false;
        }
        if (formData.primaryPurpose === 'Other' && !formData.purposeOther) {
          toast.error('Please specify the purpose');
          return false;
        }
        if (!formData.accountName || formData.accountName.length < 3) {
          toast.error('Please provide an account name (at least 3 characters)');
          return false;
        }
        return true;

      case 2:
        if (!formData.numberOfParties || formData.numberOfParties < 2 || formData.numberOfParties > 4) {
          toast.error('Please select number of parties (2-4)');
          return false;
        }
        if (!formData.relationship) {
          toast.error('Please select the relationship between parties');
          return false;
        }
        if (formData.relationship === 'Other' && !formData.relationshipOther) {
          toast.error('Please specify the relationship');
          return false;
        }

        // Validate all co-signatories
        const requiredCoSignatories = formData.numberOfParties - 1;
        const filledCoSignatories = formData.coSignatories.filter(cs => cs.email).length;

        if (filledCoSignatories < requiredCoSignatories) {
          toast.error(`Please add all ${requiredCoSignatories} co-signator${requiredCoSignatories > 1 ? 'ies' : 'y'}. You need ${formData.numberOfParties} people total (including yourself).`);
          return false;
        }

        const verifiedCoSignatories = formData.coSignatories.filter(cs => cs.verified).length;
        if (verifiedCoSignatories < requiredCoSignatories) {
          toast.error('All co-signatories must be verified Acredis users. They need to create an account first.');
          return false;
        }

        // Check for duplicates
        const emails = formData.coSignatories.map(cs => cs.email).filter(e => e);
        const uniqueEmails = new Set(emails);
        if (emails.length !== uniqueEmails.size) {
          toast.error('Duplicate emails found. Each person can only be added once');
          return false;
        }

        return true;

      case 3:
        if (!formData.expectedMonthlyVolume) {
          toast.error('Please select expected monthly activity volume');
          return false;
        }
        if (!formData.combinedCapitalLevel) {
          toast.error('Please select combined capital level');
          return false;
        }
        if (!formData.intendedAssetHoldings) {
          toast.error('Please select intended asset holdings');
          return false;
        }
        return true;

      case 4:
        if (!formData.authorizationModel) {
          toast.error('Please select an authorization model');
          return false;
        }
        if ((formData.authorizationModel === 'THRESHOLD' || formData.authorizationModel === 'MAJORITY')
          && !formData.thresholdAmount) {
          toast.error('Please enter the transaction threshold amount');
          return false;
        }
        if (formData.thresholdAmount && parseFloat(formData.thresholdAmount) <= 0) {
          toast.error('Threshold amount must be greater than zero');
          return false;
        }
        return true;

      case 5:
        if (!formData.consentConfirmed) {
          toast.error('Please confirm that all parties have consented');
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      SessionManager.updateActivity(); // Keep session active
      setCurrentStep(prev => Math.min(prev + 1, 5));
    }
  };

  const prevStep = () => {
    SessionManager.updateActivity(); // Keep session active
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(5)) return;
    if (!user) return;

    setSubmitting(true);

    try {
      // Update session activity to prevent timeout
      SessionManager.updateActivity();

      const response = await axios.post('/api/chain-account/create', {
        userId: user.id,
        accountName: formData.accountName,
        primaryPurpose: formData.primaryPurpose === 'Other' ? formData.purposeOther : formData.primaryPurpose,
        purposeDescription: formData.purposeDescription || '',
        numberOfParties: formData.numberOfParties,
        relationship: formData.relationship === 'Other' ? formData.relationshipOther : formData.relationship,
        coSignatories: formData.coSignatories.filter(cs => cs.verified).map(cs => ({
          email: cs.email,
          userId: cs.userId,
          name: cs.name,
        })),
        expectedMonthlyVolume: formData.expectedMonthlyVolume,
        combinedCapitalLevel: formData.combinedCapitalLevel,
        intendedAssetHoldings: formData.intendedAssetHoldings,
        authorizationModel: formData.authorizationModel,
        thresholdAmount: formData.thresholdAmount ? parseFloat(formData.thresholdAmount) : null,
        thresholdCurrency: formData.thresholdCurrency,
      });

      if (response.data.success) {
        toast.success('Chain Account application submitted successfully!');
        // Update activity again before redirect
        SessionManager.updateActivity();
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Chain Account creation error:', error);
      // Don't log out on database errors - show specific error message
      if (error.response?.status === 500) {
        toast.error('Database error. Please ensure migrations are run: npx prisma migrate deploy');
      } else {
        toast.error(error.response?.data?.error || 'Failed to create Chain Account');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal Header */}
      <header className="bg-black shadow-sm border-b border-gray-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Image src="/logo/WG_Gbg_Fin-No-bg.png" alt="Acredis Finance" width={150} height={40} className="h-12 w-auto" priority />

              <div>
                <span className="text-xl font-bold text-white whitespace-nowrap">
                  <span className="text-[#c1ff72]">A</span>credis Finance
                </span>
                <p className="text-xs text-gray-500">Chain Account Creation</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center text-gray-300 cursor-pointer hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Exit
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="md:text-3xl text-xl font-bold text-gray-900">Create Chain Account</h1>
          <p className="text-gray-600 md:text-base text-sm md:mt-2">
            Set up a shared investment and banking account with 2-4 parties
          </p>
        </div>

        {/* Progress Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;

              return (
                <div key={step.number} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 md:h-12 h-10 md:w-12 rounded-full flex items-center justify-center transition-all ${isActive
                        ? 'bg-[#e0ff57] text-black scale-110'
                        : isCompleted
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-500'
                        }`}
                    >
                      {isCompleted ? <Check className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                    </div>
                    <span
                      className={`text-xs mt-2 text-center font-medium ${isActive ? 'text-black-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                        }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-1 flex-1 mx-2 rounded ${isCompleted ? 'bg-green-600' : 'bg-gray-200'
                        }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Content */}
        <div className="bg-white rounded-lg shadow-md p-8">
          {/* Step 1: Account Purpose */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Account Purpose</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary purpose of this Chain Account *
                </label>
                <select
                  value={formData.primaryPurpose}
                  onChange={(e) => setFormData({ ...formData, primaryPurpose: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                >
                  <option value="">Select purpose</option>
                  <option value="Business Operations">Business Operations</option>
                  <option value="Investment Partnership">Investment Partnership</option>
                  <option value="Spousal / Family Account">Spousal / Family Account</option>
                  <option value="Estate & Wealth Management">Estate & Wealth Management</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {formData.primaryPurpose === 'Other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Please specify *
                  </label>
                  <input
                    type="text"
                    value={formData.purposeOther}
                    onChange={(e) => setFormData({ ...formData, purposeOther: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    placeholder="Specify the purpose"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Name *
                </label>
                <input
                  type="text"
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  placeholder="e.g., Johnson Family Account, Tech Startup Investment"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Choose a name that identifies this Chain Account (minimum 3 characters)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Briefly describe what this account will be used for (Optional)
                </label>
                <textarea
                  value={formData.purposeDescription}
                  onChange={(e) => setFormData({ ...formData, purposeDescription: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  placeholder="We are pooling funds to invest in crypto and digital assets together."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Provide additional context about this account's purpose
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Party Information */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Party Information</h2>

              {/* Primary Holder Info */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Primary Holder</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-700 font-medium">Name</p>
                    <p className="text-sm text-gray-900 font-semibold">{user.name || 'Not set'}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How many parties will be on this account? *
                </label>
                <select
                  value={formData.numberOfParties}
                  onChange={(e) => {
                    const count = parseInt(e.target.value);
                    setFormData({ ...formData, numberOfParties: count });
                    updateCoSignatories(count);
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                >
                  <option value={2}>2 parties (You + 1 Co-Signatory)</option>
                  <option value={3}>3 parties (You + 2 Co-Signatories)</option>
                  <option value={4}>4 parties (You + 3 Co-Signatories) - Maximum</option>
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  You are the Primary Holder. Select the total number of people including yourself.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Relationship between all parties *
                </label>
                <select
                  value={formData.relationship}
                  onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                >
                  <option value="">Select relationship</option>
                  <option value="Spouses / Life Partners">Spouses / Life Partners</option>
                  <option value="Business Partners">Business Partners</option>
                  <option value="Investment Partners">Investment Partners</option>
                  <option value="Family Members">Family Members</option>
                  <option value="Legal Representatives">Legal Representatives</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {formData.relationship === 'Other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Please specify relationship *
                  </label>
                  <input
                    type="text"
                    value={formData.relationshipOther}
                    onChange={(e) => setFormData({ ...formData, relationshipOther: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    placeholder="Specify the relationship"
                  />
                </div>
              )}

              {/* Co-Signatories */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Co-Signatories</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Add {formData.numberOfParties - 1} co-signator{formData.numberOfParties - 1 > 1 ? 'ies' : 'y'}. Each must have an existing Acredis account.
                </p>
                <div className="space-y-4">
                  {formData.coSignatories.map((coSignatory, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Co-Signatory {index + 1} of {formData.numberOfParties - 1} - Email Address *
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          value={coSignatory.email}
                          onChange={(e) => {
                            const updated = [...formData.coSignatories];
                            updated[index] = { ...updated[index], email: e.target.value };
                            setFormData({ ...formData, coSignatories: updated });
                          }}
                          onBlur={(e) => validateCoSignatoryEmail(index, e.target.value)}
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent pr-10 ${coSignatory.verified
                            ? 'border-green-500 bg-green-50'
                            : coSignatory.error
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-300'
                            }`}
                          placeholder="email@example.com"
                        />
                        {validatingEmail === index && (
                          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-600 animate-spin" />
                        )}
                        {!validatingEmail && coSignatory.verified && (
                          <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-green-600" />
                        )}
                        {!validatingEmail && coSignatory.error && (
                          <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-red-600" />
                        )}
                      </div>

                      {coSignatory.verified && (
                        <div className="mt-2 flex items-center text-sm text-green-700 bg-green-100 px-3 py-2 rounded">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          <span>Existing Acredis member: <strong>{coSignatory.name || 'User'}</strong></span>
                        </div>
                      )}

                      {coSignatory.error && (
                        <div className="mt-2 flex items-center text-sm text-red-700 bg-red-100 px-3 py-2 rounded">
                          <AlertCircle className="w-4 h-4 mr-2" />
                          <span>{coSignatory.error}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Financial Profile */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Financial Profile</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expected monthly activity volume *
                </label>
                <select
                  value={formData.expectedMonthlyVolume}
                  onChange={(e) => setFormData({ ...formData, expectedMonthlyVolume: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                >
                  <option value="">Select volume</option>
                  <option value="Under $10,000">Under $10,000</option>
                  <option value="$10,000 – $25,000">$10,000 – $25,000</option>
                  <option value="$25,000 – $50,000">$25,000 – $50,000</option>
                  <option value="$50,000 – $100,000">$50,000 – $100,000</option>
                  <option value="Above $100,000">Above $100,000</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Combined capital level of all parties *
                </label>
                <select
                  value={formData.combinedCapitalLevel}
                  onChange={(e) => setFormData({ ...formData, combinedCapitalLevel: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                >
                  <option value="">Select capital level</option>
                  <option value="Under $50,000">Under $50,000</option>
                  <option value="$50,000 – $200,000">$50,000 – $200,000</option>
                  <option value="$200,000 – $1,000,000">$200,000 – $1,000,000</option>
                  <option value="Above $1,000,000">Above $1,000,000</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Intended asset holdings *
                </label>
                <select
                  value={formData.intendedAssetHoldings}
                  onChange={(e) => setFormData({ ...formData, intendedAssetHoldings: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                >
                  <option value="">Select asset type</option>
                  <option value="Crypto assets only">Crypto assets only</option>
                  <option value="Fiat only">Fiat only</option>
                  <option value="Both crypto and fiat">Both crypto and fiat</option>
                  <option value="Investment portfolio assets">Investment portfolio assets</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 4: Account Permissions */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Account Permissions</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transaction authorization model *
                </label>
                <div className="space-y-3">
                  <label className="flex items-start p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-gray-500 transition-colors">
                    <input
                      type="radio"
                      name="authorizationModel"
                      value="INDEPENDENT"
                      checked={formData.authorizationModel === 'INDEPENDENT'}
                      onChange={(e) => setFormData({ ...formData, authorizationModel: e.target.value })}
                      className="mt-1 mr-3"
                    />
                    <div>
                      <div className="font-semibold text-gray-900">Any signatory can act independently</div>
                      <div className="text-sm text-gray-600 mt-1">
                        Faster, more flexible - Any member can make transactions without approval from others.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-gray-500 transition-colors">
                    <input
                      type="radio"
                      name="authorizationModel"
                      value="THRESHOLD"
                      checked={formData.authorizationModel === 'THRESHOLD'}
                      onChange={(e) => setFormData({ ...formData, authorizationModel: e.target.value })}
                      className="mt-1 mr-3"
                    />
                    <div>
                      <div className="font-semibold text-gray-900">All signatories must approve transactions above a set threshold</div>
                      <div className="text-sm text-gray-600 mt-1">
                        More controlled - Transactions below threshold are independent, above threshold requires ALL members to approve.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-gray-500 transition-colors">
                    <input
                      type="radio"
                      name="authorizationModel"
                      value="MAJORITY"
                      checked={formData.authorizationModel === 'MAJORITY'}
                      onChange={(e) => setFormData({ ...formData, authorizationModel: e.target.value })}
                      className="mt-1 mr-3"
                    />
                    <div>
                      <div className="font-semibold text-gray-900">Majority approval required for large transactions</div>
                      <div className="text-sm text-gray-600 mt-1">
                        Balanced - Transactions below threshold are independent, above threshold requires MAJORITY of members to approve.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {(formData.authorizationModel === 'THRESHOLD' || formData.authorizationModel === 'MAJORITY') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Set transaction threshold for independent action *
                  </label>
                  <p className="text-sm text-gray-600 mb-3">
                    Any transaction above this amount requires approval from {formData.authorizationModel === 'THRESHOLD' ? 'all parties' : 'majority of parties'}
                  </p>
                  <div className="flex gap-3">
                    <select
                      value={formData.thresholdCurrency}
                      onChange={(e) => setFormData({ ...formData, thresholdCurrency: e.target.value })}
                      className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                    <input
                      type="number"
                      value={formData.thresholdAmount}
                      onChange={(e) => setFormData({ ...formData, thresholdAmount: e.target.value })}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                      placeholder="e.g., 5000"
                      min="0"
                      step="100"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Example: Setting threshold to $5,000 means transactions under $5,000 can be done independently by any member
                  </p>
                </div>
              )}

              {formData.authorizationModel === 'INDEPENDENT' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> With independent authorization, you can optionally set a threshold amount. Transactions below the threshold will proceed independently, while transactions above will still require approval for added security.
                  </p>
                  <div className="mt-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.thresholdAmount !== ''}
                        onChange={(e) => {
                          if (!e.target.checked) {
                            setFormData({ ...formData, thresholdAmount: '' });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Set an optional threshold for extra security</span>
                    </label>
                  </div>

                  {formData.thresholdAmount !== '' && (
                    <div className="mt-4">
                      <div className="flex gap-3">
                        <select
                          value={formData.thresholdCurrency}
                          onChange={(e) => setFormData({ ...formData, thresholdCurrency: e.target.value })}
                          className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                        >
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                        </select>
                        <input
                          type="number"
                          value={formData.thresholdAmount}
                          onChange={(e) => setFormData({ ...formData, thresholdAmount: e.target.value })}
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                          placeholder="e.g., 10000"
                          min="0"
                          step="100"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Declaration */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Declaration</h2>

              <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Application Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Purpose:</span>
                      <span className="font-medium">{formData.primaryPurpose === 'Other' ? formData.purposeOther : formData.primaryPurpose}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Parties:</span>
                      <span className="font-medium">{formData.numberOfParties} people (1 Primary Holder + {formData.numberOfParties - 1} Co-Signator{formData.numberOfParties - 1 > 1 ? 'ies' : 'y'})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Authorization Model:</span>
                      <span className="font-medium">
                        {formData.authorizationModel === 'INDEPENDENT' && 'Independent'}
                        {formData.authorizationModel === 'THRESHOLD' && 'Threshold (All Approve)'}
                        {formData.authorizationModel === 'MAJORITY' && 'Majority Approval'}
                      </span>
                    </div>
                    {(formData.authorizationModel === 'THRESHOLD' || formData.authorizationModel === 'MAJORITY') && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Threshold:</span>
                        <span className="font-medium">{formData.thresholdCurrency} {formData.thresholdAmount}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Primary Holder</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-gray-600">Name:</span> <span className="font-medium">{user.name}</span></p>
                    <p><span className="text-gray-600">Email:</span> <span className="font-medium">{user.email}</span></p>
                    <p><span className="text-gray-600">Date:</span> <span className="font-medium">{new Date().toLocaleDateString()}</span></p>
                  </div>
                </div>
              </div>

              <div className="border-2 border-gray-200 rounded-lg p-4">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.consentConfirmed}
                    onChange={(e) => setFormData({ ...formData, consentConfirmed: e.target.checked })}
                    className="mt-1 mr-3 w-5 h-5"
                  />
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">Consent Confirmation *</p>
                    <p className="text-gray-600 mt-1">
                      I confirm that all parties listed in this application are aware of and have consented to being included in this Chain Account.
                    </p>
                  </div>
                </label>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  What happens next?
                </h3>
                <ul className="space-y-2 text-sm text-gray-800">
                  <li className="flex items-start">
                    <span className="mr-2">1.</span>
                    <span>All parties will receive an email with the Chain Account memorandum</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">2.</span>
                    <span>Each party must review and sign the memorandum</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">3.</span>
                    <span>Once all parties have signed, the account will activate</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">4.</span>
                    <span>Each party will receive their unique access token to log into the Chain Account</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="flex items-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Previous
            </button>

            {currentStep < 5 ? (
              <button
                onClick={nextStep}
                className="flex items-center px-6 py-3 bg-[#e0ff57] text-black rounded-lg hover:bg-[#d4ff3a]/70 cursor-pointer transition-colors"
              >
                Next
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Application
                    <Check className="w-5 h-5 ml-2" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
