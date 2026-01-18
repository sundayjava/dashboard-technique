'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserCircle } from 'lucide-react';

interface ProfileCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileCompletionModal({
  isOpen,
  onClose,
}: ProfileCompletionModalProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  const handleCompleteProfile = () => {
    router.push('/dashboard/account/profile');
    onClose();
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('profileModalDismissed', 'true');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && !dismissed && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            className="fixed inset-0 bg-black/60 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl z-50 p-6 md:p-8"
          >
            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={24} />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-[#c1ff72]/20 dark:bg-[#c1ff72]/10 flex items-center justify-center">
                <UserCircle size={32} className="text-[#c1ff72] dark:text-[#c1ff72]" />
              </div>
            </div>

            {/* Content */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Complete Your Profile
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Help us serve you better by completing your profile information. Add your photo, date of birth, and address to get started.
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleCompleteProfile}
                className="w-full bg-[#c1ff72] hover:bg-[#b8e865] text-black font-medium py-3 rounded-lg transition-colors"
              >
                Complete Profile
              </button>
              <button
                onClick={handleDismiss}
                className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium py-3 rounded-lg transition-colors"
              >
                I'll do this later
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
