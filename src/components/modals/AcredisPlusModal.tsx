'use client';

import { X, Check, TrendingUp, Award, Lock, Target } from 'lucide-react';

interface AcredisPlusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivate: () => void;
  isActivating: boolean;
}

export default function AcredisPlusModal({ isOpen, onClose, onActivate, isActivating }: AcredisPlusModalProps) {
  if (!isOpen) return null;

  const benefits = [
    {
      icon: TrendingUp,
      title: 'Unlimited Financial Planning',
      description: 'Unlimited one-on-one collaboration with our experienced Acredis Wealth financial partners'
    },
    {
      icon: Award,
      title: 'More Financial Advice',
      description: 'Access to Acredis Wealth program for comprehensive financial guidance'
    },
    {
      icon: Target,
      title: 'More for Investors',
      description: 'Top priority access to preferred IPO opportunities'
    },
    {
      icon: Lock,
      title: 'Shake Up Your Debt',
      description: 'Down with debt. No purchase necessary. Only available to Acredis premium partners.'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-linear-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-t-xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
            disabled={isActivating}
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-8 h-8" />
            <h2 className="text-2xl font-bold">Acredis Plus</h2>
          </div>
          <p className="text-purple-100">
            Unlock lasting value and new possibilities through our valuable premium partnerships
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Acredis plus means more, more, more!
            </h3>
            <p className="text-gray-600">
              Bringing you a new stream of financial earnings and growth. The smart way to get more from Acredis.
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="grid gap-4 mb-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="shrink-0">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <benefit.icon className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">{benefit.title}</h4>
                  <p className="text-sm text-gray-600">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* What You Get */}
          <div className="bg-linear-to-br from-purple-50 to-indigo-50 rounded-lg p-5 mb-6">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              What You Get
            </h4>
            <ul className="space-y-2">
              {[
                'Unlimited access to Acredis Wealth financial partners',
                'Comprehensive financial guidance and planning',
                'Priority access to IPO opportunities',
                'Exclusive debt management solutions',
                'Premium customer support',
                'Early access to new features'
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isActivating}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              Maybe Later
            </button>
            <button
              onClick={onActivate}
              disabled={isActivating}
              className="flex-1 px-6 py-3 bg-linear-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isActivating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <Award className="w-5 h-5" />
                  Activate Acredis Plus
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
