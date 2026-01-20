"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { loginSchema, type LoginFormData } from "@/schemas/validation.schema";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SliderCaptcha } from "@/components/ui/SliderCaptcha";
import { toast } from "react-hot-toast";
import axios from "axios";

/**
 * Login Form Component with Role-Based Routing
 */
export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [pendingLoginData, setPendingLoginData] = useState<LoginFormData | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
    mode: 'onChange',
  });

  const handleCaptchaSuccess = () => {
    // Proceed with login after captcha success
    if (pendingLoginData) {
      performLogin(pendingLoginData);
    }
  };

  const handleCaptchaFail = () => {
    // Keep modal open for retry
  };

  const onSubmit = async (data: LoginFormData) => {
    // Store login data and show captcha modal
    setPendingLoginData(data);
    setShowCaptchaModal(true);
  };

  const performLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    
    try {
      const response = await axios.post('/api/auth/login', {
        email: data.email,
        password: data.password,
      });

      const { user } = response.data;
      
      toast.success(`Welcome back${user.name ? ', ' + user.name : ''}!`);
      
      // Close modal
      setShowCaptchaModal(false);
      
      // Role-based routing
      if (user.role === 'ADMIN') {
        // Admin goes directly to dashboard (no PIN required)
        localStorage.setItem('user', JSON.stringify(user));
        router.push('/admin/dashboard');
      } else {
        // Regular users must verify PIN
        router.push(`/verify-pin?email=${encodeURIComponent(user.email)}`);
      }
    } catch (error) {
      setShowCaptchaModal(false);
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        
        // Check if email verification is required
        if (errorData?.requiresVerification && errorData?.email) {
          toast.error(errorData.message || 'Please verify your email');
          // Redirect to email verification page
          router.push(`/verify-otp?email=${encodeURIComponent(errorData.email)}`);
          return;
        }
        
        const errorMessage = errorData?.error || 'Login failed. Please try again.';
        toast.error(errorMessage);
      } else {
        toast.error('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
      setPendingLoginData(null);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h2>
        <p className="text-gray-600 text-sm">Sign in to access your account</p>
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email Address
        </label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email"
          error={errors.email?.message}
          {...register("email")}
        />
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
            error={errors.password?.message}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Forgot Password Link */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <input
            id="remember-me"
            name="remember-me"
            type="checkbox"
            className="h-4 w-4 text-[#c1ff72] focus:ring-[#c1ff72] border-gray-300 rounded"
          />
          <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
            Remember me
          </label>
        </div>
        <a href="/forgot-password" className="text-sm font-medium text-gray-900 hover:text-gray-700">
          Forgot password?
        </a>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? 'Signing in...' : 'Sign In'}
      </Button>

      {/* Sign Up Link */}
      <div className="text-center mt-4">
        <p className="text-sm text-gray-600">
          Don't have an account?{' '}
          <a href="/create-account" className="font-medium text-gray-900 hover:text-gray-700">
            Create one
          </a>
        </p>
      </div>

      {/* Captcha Modal */}
      {showCaptchaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Security Verification</h3>
              <p className="text-sm text-gray-600">Complete the puzzle to continue</p>
            </div>
            
            <SliderCaptcha 
              onSuccess={handleCaptchaSuccess}
              onFail={handleCaptchaFail}
            />

            <button
              onClick={() => {
                setShowCaptchaModal(false);
                setPendingLoginData(null);
              }}
              className="mt-4 w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
