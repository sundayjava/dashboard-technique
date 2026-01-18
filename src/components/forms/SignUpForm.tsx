'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/navigation';
import {
  signUpStep1Schema,
  signUpStep2Schema,
  signUpStep3Schema,
  type SignUpStep1Data,
  type SignUpStep2Data,
  type SignUpStep3Data,
} from '@/schemas/validation.schema';
import { COUNTRY_CODES, CURRENCIES, ACCOUNT_TYPES } from '@/constants/countries';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'react-hot-toast';

type SignUpFormData = SignUpStep1Data & SignUpStep2Data & SignUpStep3Data;

export function SignUpForm() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<SignUpFormData>>({
    authorizationCode: generateAuthCode(),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  // Step 1 Form
  const {
    register: registerStep1,
    handleSubmit: handleSubmitStep1,
    formState: { errors: errorsStep1 },
    setValue: setValueStep1,
  } = useForm<SignUpStep1Data>({
    resolver: yupResolver(signUpStep1Schema),
    mode: 'onChange',
    defaultValues: {
      authorizationCode: formData.authorizationCode,
      email: formData.email || '',
      countryCode: formData.countryCode || '+1',
      phoneNumber: formData.phoneNumber || '',
    },
  });

  // Detect user's country based on IP address
  useEffect(() => {
    const detectCountry = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        const detectedCountryCode = data.country_calling_code;
        
        // Find matching country in our list by dial code
        const matchedCountry = COUNTRY_CODES.find(
          (country) => country.code === detectedCountryCode
        );
        
        if (matchedCountry) {
          setValueStep1('countryCode', matchedCountry.code);
          setFormData((prev) => ({ ...prev, countryCode: matchedCountry.code }));
        }
      } catch (error) {
        // Silently fail - will use default US country code
        console.log('Country detection failed, using default US (+1)');
      }
    };

    detectCountry();
  }, [setValueStep1]);

  // Step 2 Form
  const {
    register: registerStep2,
    handleSubmit: handleSubmitStep2,
    formState: { errors: errorsStep2 },
  } = useForm<SignUpStep2Data>({
    resolver: yupResolver(signUpStep2Schema),
    mode: 'onChange',
    defaultValues: {
      accountType: (formData.accountType as 'PERSONAL' | 'BUSINESS' | 'CORPORATE') || undefined,
      currency: formData.currency || '',
    },
  });

  // Step 3 Form
  const {
    register: registerStep3,
    handleSubmit: handleSubmitStep3,
    formState: { errors: errorsStep3 },
  } = useForm<SignUpStep3Data>({
    resolver: yupResolver(signUpStep3Schema),
    mode: 'onChange',
    defaultValues: {
      password: '',
      confirmPassword: '',
      transactionPin: '',
      confirmTransactionPin: '',
    },
  });

  // Handle Step 1 submission
  const onSubmitStep1 = (data: SignUpStep1Data) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setCurrentStep(2);
  };

  // Handle Step 2 submission
  const onSubmitStep2 = (data: SignUpStep2Data) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setCurrentStep(3);
  };

  // Handle Step 3 submission (Final)
  const onSubmitStep3 = async (data: SignUpStep3Data) => {
    setIsSubmitting(true);
    const completeData = { ...formData, ...data } as SignUpFormData;

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          authorizationCode: completeData.authorizationCode,
          email: completeData.email,
          phoneNumber: completeData.phoneNumber,
          countryCode: completeData.countryCode,
          accountType: completeData.accountType,
          currency: completeData.currency,
          password: completeData.password,
          transactionPin: completeData.transactionPin,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed');
      }

      toast.success('Account created successfully! Check your email for verification code.');
      
      // Redirect to OTP verification page with email
      router.push(`/verify-otp?email=${encodeURIComponent(completeData.email)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  return (
    <div className="w-full">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-semibold text-gray-900">Step {currentStep} of 3</span>
          <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {currentStep === 1 && 'Basic Information'}
            {currentStep === 2 && 'Account Details'}
            {currentStep === 3 && 'Security'}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-[#c1ff72] h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(currentStep / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Step 1: Basic Information */}
      {currentStep === 1 && (
        <form onSubmit={handleSubmitStep1(onSubmitStep1)} className="space-y-5">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Create an account</h2>
            <p className="text-gray-600 text-sm">Sign up and get 30 day free trial</p>
          </div>

          {/* Authorization Code */}
          <div>
            <label htmlFor="authorizationCode" className="block text-sm font-medium text-gray-700 mb-1">
              Authorization Code
            </label>
            <div className="relative">
              <Input
                id="authorizationCode"
                {...registerStep1('authorizationCode')}
                disabled
                className="bg-gray-100 cursor-not-allowed pr-24"
                error={errorsStep1.authorizationCode?.message}
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(formData.authorizationCode || '');
                  toast.success('Authorization code copied to clipboard!');
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Copy
              </button>
            </div>
            <p className="mt-1 text-xs text-amber-600 font-medium">
              ⚠️ Save this code - you'll need it for future login and account recovery
            </p>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@example.com"
              {...registerStep1('email')}
              error={errorsStep1.email?.message}
            />
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <div className="flex gap-2">
              <select
                {...registerStep1('countryCode')}
                className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              >
                {COUNTRY_CODES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.flag} {country.code}
                  </option>
                ))}
              </select>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="8012345678"
                {...registerStep1('phoneNumber')}
                error={errorsStep1.phoneNumber?.message}
                className="flex-1"
              />
            </div>
            {errorsStep1.countryCode && (
              <p className="mt-1 text-sm text-red-600">{errorsStep1.countryCode.message}</p>
            )}
          </div>

          <Button type="submit" variant="primary" className="w-full">
            Next
          </Button>
        </form>
      )}

      {/* Step 2: Account Details */}
      {currentStep === 2 && (
        <form onSubmit={handleSubmitStep2(onSubmitStep2)} className="space-y-5">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Account Details</h2>
            <p className="text-gray-600 text-sm">Choose your account preferences</p>
          </div>

          {/* Account Type */}
          <div>
            <label htmlFor="accountType" className="block text-sm font-medium text-gray-700 mb-1">
              Account Type
            </label>
            <select
              id="accountType"
              {...registerStep2('accountType')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="">Select account type</option>
              {ACCOUNT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {errorsStep2.accountType && (
              <p className="mt-1 text-sm text-red-600">{errorsStep2.accountType.message}</p>
            )}
          </div>

          {/* Currency */}
          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1">
              Select Your Currency
            </label>
            <select
              id="currency"
              {...registerStep2('currency')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="">Select currency</option>
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.code} - {currency.name}
                </option>
              ))}
            </select>
            {errorsStep2.currency && (
              <p className="mt-1 text-sm text-red-600">{errorsStep2.currency.message}</p>
            )}
          </div>

          <div className="flex gap-3">
            <Button type="button" onClick={handleBack} variant="outline" className="flex-1">
              Back
            </Button>
            <Button type="submit" variant="primary" className="flex-1">
              Next
            </Button>
          </div>
        </form>
      )}

      {/* Step 3: Security */}
      {currentStep === 3 && (
        <form onSubmit={handleSubmitStep3(onSubmitStep3)} className="space-y-5">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Security Setup</h2>
            <p className="text-gray-600 text-sm">Protect your account with strong credentials</p>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                {...registerStep3('password')}
                error={errorsStep3.password?.message}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                {...registerStep3('confirmPassword')}
                error={errorsStep3.confirmPassword?.message}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                {showConfirmPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Transaction PIN */}
          <div>
            <label htmlFor="transactionPin" className="block text-sm font-medium text-gray-700 mb-1">
              Transaction PIN
            </label>
            <div className="relative">
              <Input
                id="transactionPin"
                type={showPin ? "text" : "password"}
                placeholder="4 digit PIN"
                maxLength={4}
                {...registerStep3('transactionPin')}
                error={errorsStep3.transactionPin?.message}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                {showPin ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Create a 4 digit PIN for transaction verification
            </p>
          </div>

          {/* Confirm Transaction PIN */}
          <div>
            <label htmlFor="confirmTransactionPin" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Transaction PIN
            </label>
            <div className="relative">
              <Input
                id="confirmTransactionPin"
                type={showConfirmPin ? "text" : "password"}
                placeholder="Confirm your PIN"
                maxLength={4}
                {...registerStep3('confirmTransactionPin')}
                error={errorsStep3.confirmTransactionPin?.message}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPin(!showConfirmPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                {showConfirmPin ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="button" onClick={handleBack} variant="outline" className="flex-1">
              Back
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Creating Account...' : 'Sign Up'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// Helper function to generate authorization code
function generateAuthCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'AC-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
