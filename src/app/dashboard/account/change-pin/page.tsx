'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Key, Shield } from 'lucide-react';
import { DashboardLayoutWrapper } from '@/components/layout/DashboardLayoutWrapper';
import axios from 'axios';

export default function ChangePinPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const [currentPin, setCurrentPin] = useState(['', '', '', '']);
  const [newPin, setNewPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);

  const currentPinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const newPinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmPinRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  const handlePinChange = (
    index: number,
    value: string,
    pinArray: string[],
    setPinArray: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newPinArray = [...pinArray];
    newPinArray[index] = value;
    setPinArray(newPinArray);

    // Auto-focus next input
    if (value && index < 3) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
    pinArray: string[],
    setPinArray: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (e.key === 'Backspace') {
      if (!pinArray[index] && index > 0) {
        // Move to previous input if current is empty
        refs.current[index - 1]?.focus();
      } else {
        // Clear current input
        const newPinArray = [...pinArray];
        newPinArray[index] = '';
        setPinArray(newPinArray);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const userId = getUserId();
    if (!userId) {
      toast.error('Please log in to change PIN');
      return;
    }

    const currentPinValue = currentPin.join('');
    const newPinValue = newPin.join('');
    const confirmPinValue = confirmPin.join('');

    // Validation
    if (currentPinValue.length !== 4) {
      toast.error('Please enter your current PIN');
      return;
    }

    if (newPinValue.length !== 4) {
      toast.error('Please enter a new 4-digit PIN');
      return;
    }

    if (newPinValue !== confirmPinValue) {
      toast.error('New PINs do not match');
      return;
    }

    if (currentPinValue === newPinValue) {
      toast.error('New PIN must be different from current PIN');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('/api/change-pin', {
        userId,
        currentPin: currentPinValue,
        newPin: newPinValue,
      });

      toast.success(response.data.message);
      
      // Reset form
      setCurrentPin(['', '', '', '']);
      setNewPin(['', '', '', '']);
      setConfirmPin(['', '', '', '']);
      
      // Focus first input
      currentPinRefs.current[0]?.focus();
    } catch (error: any) {
      console.error('Error changing PIN:', error);
      toast.error(error.response?.data?.error || 'Failed to change PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayoutWrapper>
      <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-[#c1ff72] rounded-lg flex items-center justify-center">
                <Key className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Change Transaction PIN</h1>
                <p className="text-gray-600">Update your 4-digit security PIN</p>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 text-sm mb-1">Important</h3>
                <p className="text-blue-800 text-sm">
                  Your transaction PIN is used to authorize sensitive operations like transfers and payments.
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Current PIN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Current PIN <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3 justify-center">
                  {currentPin.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { currentPinRefs.current[index] = el; }}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(index, e.target.value, currentPin, setCurrentPin, currentPinRefs)}
                      onKeyDown={(e) => handleKeyDown(e, index, currentPin, setCurrentPin, currentPinRefs)}
                      className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                      required
                    />
                  ))}
                </div>
              </div>

              {/* New PIN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  New PIN <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3 justify-center">
                  {newPin.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { newPinRefs.current[index] = el; }}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(index, e.target.value, newPin, setNewPin, newPinRefs)}
                      onKeyDown={(e) => handleKeyDown(e, index, newPin, setNewPin, newPinRefs)}
                      className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                      required
                    />
                  ))}
                </div>
              </div>

              {/* Confirm PIN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Confirm New PIN <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3 justify-center">
                  {confirmPin.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { confirmPinRefs.current[index] = el; }}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(index, e.target.value, confirmPin, setConfirmPin, confirmPinRefs)}
                      onKeyDown={(e) => handleKeyDown(e, index, confirmPin, setConfirmPin, confirmPinRefs)}
                      className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#c1ff72] focus:border-[#c1ff72] outline-none"
                      required
                    />
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-8 py-3 bg-[#c1ff72] hover:bg-[#b0ef62] text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {loading ? 'Changing PIN...' : 'Change PIN'}
                </button>
              </div>
            </form>
          </div>

          {/* PIN Tips */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 text-sm mb-2">PIN Security Tips</h3>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• Avoid using obvious PINs like 1234 or your birth year</li>
              <li>• Don't share your PIN with anyone</li>
              <li>• Change your PIN regularly for security</li>
              <li>• Never write down your PIN</li>
            </ul>
          </div>
        </div>
    </DashboardLayoutWrapper>
  );
}
