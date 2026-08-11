'use client';

import { useRouter } from 'next/navigation';
import { X, Landmark, Coins, ChevronRight } from 'lucide-react';

interface WithdrawMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WithdrawMethodModal({ isOpen, onClose }: WithdrawMethodModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const options = [
    {
      key: 'bank',
      icon: Landmark,
      title: 'Bank Transfer',
      description: 'Withdraw to your bank account via international wire transfer',
      color: 'blue',
      href: '/dashboard/monetary/withdraw',
    },
    {
      key: 'crypto',
      icon: Coins,
      title: 'Crypto Withdrawal',
      description: 'Withdraw to an external crypto wallet address',
      color: 'orange',
      href: '/dashboard/monetary/withdraw/crypto',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Withdraw Funds</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-5">
          Choose how you&apos;d like to withdraw your funds.
        </p>

        <div className="space-y-3">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.key}
                onClick={() => {
                  onClose();
                  router.push(option.href);
                }}
                className={`w-full flex items-center gap-4 p-4 border-2 rounded-lg text-left transition-all group ${
                  option.color === 'blue'
                    ? 'border-blue-200 hover:border-blue-500 hover:bg-blue-50'
                    : 'border-orange-200 hover:border-orange-500 hover:bg-orange-50'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${
                    option.color === 'blue' ? 'bg-blue-100' : 'bg-orange-100'
                  } group-hover:scale-110 transition-transform`}
                >
                  <Icon className={`w-5 h-5 ${option.color === 'blue' ? 'text-blue-600' : 'text-orange-600'}`} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{option.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
