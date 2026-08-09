'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SessionManager } from '@/lib/session';
import { ChainAccountSessionManager } from '@/lib/chain-account-session';
import axios from 'axios';
import { ArrowLeft, Lock, Loader2, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';

export default function ChainAccountLoginPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name: string | null } | null>(null);

  useEffect(() => {
    // Get current user session
    const user = SessionManager.getUser();
    if (!user) {
      // Redirect to login if no user session
      router.push('/login?returnUrl=/chain-account/login');
      return;
    }
    setCurrentUser(user);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentUser) {
      setError('User session not found. Please log in again.');
      return;
    }

    if (!accessToken || accessToken.length < 6) {
      setError('Please enter a valid access token (6-10 characters)');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('/api/chain-account/login', {
        accessToken: accessToken.toUpperCase(),
        userId: currentUser.id, // Pass the current user's ID
      });

      if (response.data.success) {
        // Store Chain Account session
        ChainAccountSessionManager.setSession(
          response.data.token,
          response.data.session
        );

        toast.success('Chain Account access granted!');
        router.push('/chain-account/dashboard');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to authenticate';
      const attemptsRemaining = err.response?.data?.attemptsRemaining;

      setError(errorMessage);

      if (attemptsRemaining !== undefined) {
        toast.error(`${errorMessage} (${attemptsRemaining} attempts remaining)`);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking user session
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Verifying your session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-black shadow-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Image src="/logo/WG_Gbg_Fin-No-bg.png" alt="Acredis Finance" width={60} height={60} className="w-14 h-14" />
              <div>
                <h1 className="text-2xl font-bold text-white">ACREDIS FINANCE</h1>
                <p className="text-sm text-blue-200">Digital Blockchain Banking & Investment</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center text-gray-300 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </button>
          </div>
        </div>
      </header>

      {/* Login Form */}
      <div className="flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full">
          {/* Info Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <Lock className="w-5 h-5 text-blue-600 mt-0.5 mr-3 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-blue-900 mb-1">
                  Secure Chain Account Access
                </h3>
                <p className="text-xs text-blue-700">
                  Enter your unique access token to access your Chain Account. This token was
                  sent to you via email after all parties signed the memorandum.
                </p>
              </div>
            </div>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Chain Account Login
              </h2>
              <p className="text-gray-600 text-sm">
                Enter your access token to continue
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="accessToken" className="block text-sm font-medium text-gray-700 mb-2">
                  Access Token
                </label>
                <input
                  id="accessToken"
                  type="text"
                  value={accessToken}
                  onChange={(e) => {
                    setAccessToken(e.target.value.toUpperCase());
                    setError('');
                  }}
                  placeholder="Enter 6-10 character token"
                  maxLength={10}
                  className="w-full px-4 py-3 text-center text-lg font-mono tracking-wider border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                  disabled={loading}
                  autoComplete="off"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Token format: 6-10 uppercase alphanumeric characters
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-2 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || accessToken.length < 6}
                className="w-full bg-blue-600 cursor-pointer text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  'Access Chain Account'
                )}
              </button>
            </form>

            {/* Help Text */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                Can't find your access token?{' '}
                <button
                  onClick={() => router.push('/contact')}
                  className="text-blue-600 hover:text-blue-700 font-medium cursor-pointer hover:underline"
                >
                  Contact Support
                </button>
              </p>
            </div>
          </div>

          {/* Security Note */}
          <div className="mt-6 bg-white rounded-lg shadow p-4">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">Security Notes:</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Session expires after 8 hours of inactivity</li>
              <li>• Maximum 5 login attempts per 15 minutes</li>
              <li>• Never share your access token with anyone</li>
              <li>• Each member has their own unique access token</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
