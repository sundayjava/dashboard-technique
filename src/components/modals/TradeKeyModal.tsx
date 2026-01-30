'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface TradeKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export function TradeKeyModal({ isOpen, onClose, userId }: TradeKeyModalProps) {
  const router = useRouter();
  const [tradeKey, setTradeKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tradeKey.trim()) {
      toast.error('Please enter a trade key');
      return;
    }

    setIsValidating(true);

    try {
      const response = await axios.post('/api/trade-key/validate', {
        userId,
        tradeKey: tradeKey.trim(),
      });

      if (response.data.alreadyHasAccess) {
        toast.success('You already have investment access!');
      } else {
        toast.success('Investment access granted successfully!');
      }

      // Redirect to investment dashboard
      router.push('/investment/dashboard');
      onClose();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error || 'Failed to validate trade key';
        toast.error(errorMessage);
      } else {
        toast.error('An unexpected error occurred');
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative animate-fadeIn">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icon */}
        <div className="w-16 h-16 bg-linear-to-br from-[#c1ff72] to-[#8fd04f] rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Investment Access
        </h2>
        <p className="text-gray-600 text-center mb-8">
          Sign in using your Trade Key to access investment features
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="tradeKey" className="block text-sm font-medium text-gray-700 mb-2">
              Trade Key
            </label>
            <Input
              id="tradeKey"
              type="text"
              placeholder="Enter your trade key (e.g., TK-123456-ABCDEF)"
              value={tradeKey}
              onChange={(e) => setTradeKey(e.target.value.toUpperCase())}
              className="w-full"
              autoFocus
            />
            <p className="mt-2 text-xs text-gray-500">
              Enter the trade key provided by your referrer or admin
            </p>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={isValidating}
          >
            {isValidating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Validating...
              </span>
            ) : (
              'Continue to Investment'
            )}
          </Button>
        </form>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Don't have a trade key?</p>
              <p className="text-blue-700">
                Contact your account manager or request one from the admin to access investment features.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
