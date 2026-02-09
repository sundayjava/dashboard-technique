'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard } from 'lucide-react';

interface Card {
  id: string;
  cardType: string;
  cardNumber?: string;
  cardBrand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  cvv?: string;
  cardHolderName?: string;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  billingCountry?: string;
  status: string;
}

interface CardDisplayProps {
  userId: string;
}

export default function CardDisplay({ userId }: CardDisplayProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  useEffect(() => {
    async function fetchCards() {
      try {
        const response = await fetch(
          `/api/card-applications?userId=${userId}&status=ISSUED`
        );
        const data = await response.json();
        
        if (data.applications && data.applications.length > 0) {
          setCards(data.applications);
        }
      } catch (error) {
        console.error('Error fetching cards:', error);
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchCards();
    }
  }, [userId]);

  // Format card number with spaces (4-4-4-4)
  const formatCardNumber = (number?: string) => {
    if (!number) return '•••• •••• •••• ••••';
    return number.match(/.{1,4}/g)?.join(' ') || number;
  };

  // Format expiry date
  const formatExpiry = (month?: number, year?: number) => {
    if (!month || !year) return 'MM/YY';
    const monthStr = month.toString().padStart(2, '0');
    const yearStr = year.toString().slice(-2);
    return `${monthStr}/${yearStr}`;
  };

  // Get card gradient based on brand
  const getCardGradient = (brand?: string) => {
    switch (brand?.toUpperCase()) {
      case 'VISA':
        return 'linear-gradient(135deg, #1A1F71 0%, #2E3192 100%)';
      case 'MASTERCARD':
        return 'linear-gradient(135deg, #EB001B 0%, #F79E1B 100%)';
      case 'AMEX':
        return 'linear-gradient(135deg, #006FCF 0%, #00C3FF 100%)';
      default:
        return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
  };

  // Get card logo
  const getCardLogo = (brand?: string) => {
    switch (brand?.toUpperCase()) {
      case 'VISA':
        return (
          <div className="text-white font-bold text-2xl italic">VISA</div>
        );
      case 'MASTERCARD':
        return (
          <div className="flex gap-1">
            <div className="w-8 h-8 rounded-full bg-red-500 opacity-90" />
            <div className="w-8 h-8 rounded-full bg-yellow-500 opacity-90 -ml-4" />
          </div>
        );
      case 'AMEX':
        return (
          <div className="text-white font-bold text-xl">AMEX</div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">My Cards</h2>
        </div>
        <div className="animate-pulse">
          <div className="h-52 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">My Cards</h2>
          <a
            href="/dashboard/monetary/cards"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Apply for Card
          </a>
        </div>
        <div className="relative w-full aspect-[1.586/1] max-w-100 mx-auto">
          {/* Placeholder Card */}
          <div className="absolute inset-0 rounded-xl bg-linear-to-br from-gray-400 via-gray-500 to-gray-600 p-6 text-white shadow-2xl border-2 border-dashed border-gray-300">
            <div className="flex justify-between items-start mb-8">
              <div className="w-12 h-10 bg-white/20 rounded"></div>
              <CreditCard className="w-8 h-8 opacity-30" />
            </div>
            <div className="mb-6">
              <div className="sm:text-2xl text-xl font-mono tracking-wider mb-1">**** **** **** ****</div>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-xs opacity-70 mb-1">CARD HOLDER</div>
                <div className="font-semibold">NO CARD ISSUED</div>
              </div>
              <div className="text-right">
                <div className="text-xs opacity-70 mb-1">EXPIRES</div>
                <div className="font-semibold">--/--</div>
              </div>
            </div>
            
            {/* Center message */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-xl">
              <div className="text-center">
                <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold">Apply for a Virtual Card</p>
              </div>
            </div>
          </div>
        </div>
        <p className="text-center text-sm text-gray-500 mt-4">
          You haven't applied for any cards yet.
        </p>
      </div>
    );
  }

  const currentCard = cards[currentCardIndex];

  const handleCardClick = (card: Card) => {
    setSelectedCard(card);
    setShowDetailsModal(true);
  };

  const maskCardNumber = (number?: string) => {
    if (!number) return '•••• •••• •••• ••••';
    return number.slice(0, 4) + ' •••• •••• ' + number.slice(-4);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">My Cards</h2>
        <a
          href="/dashboard/monetary/cards"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Manage Cards
        </a>
      </div>

      <div className="relative w-full aspect-[1.586/1] max-w-100 mx-auto">
        <motion.div
          key={currentCard.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 rounded-xl shadow-2xl overflow-hidden cursor-pointer"
          style={{
            background: getCardGradient(currentCard.cardBrand),
          }}
          onClick={() => handleCardClick(currentCard)}
        >
          {/* Card shine effect */}
          <div className="absolute inset-0 bg-linear-to-tr from-transparent via-white/10 to-transparent" />
          
          {/* Card content */}
          <div className="relative h-full p-6 flex flex-col justify-between text-white">
            {/* Top section - Logo */}
            <div className="flex justify-between items-start">
              <div className="w-12 h-10 rounded bg-yellow-400/90" />
              <div>{getCardLogo(currentCard.cardBrand)}</div>
            </div>

            {/* Middle section - Card number */}
            <div>
              <div className="text-2xl font-mono tracking-wider">
                {maskCardNumber(currentCard.cardNumber)}
              </div>
            </div>

            {/* Bottom section - Holder and expiry */}
            <div className="flex justify-between items-end">
              <div>
                <div className="text-xs opacity-70 mb-1">Card Holder</div>
                <div className="font-semibold text-sm tracking-wide">
                  {currentCard.cardHolderName || 'CARD HOLDER'}
                </div>
              </div>
              <div>
                <div className="text-xs opacity-70 mb-1">Expires</div>
                <div className="font-semibold text-sm">
                  {formatExpiry(currentCard.expiryMonth, currentCard.expiryYear)}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Card info below */}
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">
          {currentCard.cardBrand} • {currentCard.cardType}
        </p>
        <p className="text-xs text-gray-500 mt-1">Click card to view details</p>
      </div>

      {/* Card navigation dots */}
      {cards.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {cards.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentCardIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentCardIndex
                  ? 'bg-purple-600 w-6'
                  : 'bg-gray-400'
              }`}
            />
          ))}
        </div>
      )}

      {/* Card Details Modal */}
      {showDetailsModal && selectedCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Card Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Card Preview */}
            <div className="relative w-full aspect-[1.586/1] max-w-sm mx-auto mb-6">
              <div
                className="absolute inset-0 rounded-xl shadow-2xl overflow-hidden"
                style={{
                  background: getCardGradient(selectedCard.cardBrand),
                }}
              >
                <div className="absolute inset-0 bg-linear-to-tr from-transparent via-white/10 to-transparent" />
                <div className="relative h-full p-6 flex flex-col justify-between text-white">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-10 rounded bg-yellow-400/90" />
                    <div>{getCardLogo(selectedCard.cardBrand)}</div>
                  </div>
                  <div>
                    <div className="text-2xl font-mono tracking-wider">
                      {formatCardNumber(selectedCard.cardNumber)}
                    </div>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-xs opacity-70 mb-1">Card Holder</div>
                      <div className="font-semibold text-sm tracking-wide">
                        {selectedCard.cardHolderName || 'CARD HOLDER'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs opacity-70 mb-1">Expires</div>
                      <div className="font-semibold text-sm">
                        {formatExpiry(selectedCard.expiryMonth, selectedCard.expiryYear)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card Information */}
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-3">Payment Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Card Number</label>
                  <p className="text-sm font-mono text-gray-900 bg-white px-3 py-2 rounded border">
                    {selectedCard.cardNumber ? formatCardNumber(selectedCard.cardNumber) : 'Not available'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">CVV</label>
                  <p className="text-sm font-mono text-gray-900 bg-white px-3 py-2 rounded border">
                    {selectedCard.cvv || '•••'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Expiry Date</label>
                  <p className="text-sm text-gray-900 bg-white px-3 py-2 rounded border">
                    {formatExpiry(selectedCard.expiryMonth, selectedCard.expiryYear)}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Card Brand</label>
                  <p className="text-sm text-gray-900 bg-white px-3 py-2 rounded border">
                    {selectedCard.cardBrand || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Billing Address */}
              {selectedCard.billingAddress && (
                <div className="pt-4 border-t">
                  <h4 className="font-semibold text-gray-900 mb-3">Billing Address</h4>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-900">{selectedCard.billingAddress}</p>
                    <p className="text-sm text-gray-900">
                      {selectedCard.billingCity}, {selectedCard.billingState} {selectedCard.billingZip}
                    </p>
                    <p className="text-sm text-gray-900">{selectedCard.billingCountry}</p>
                  </div>
                </div>
              )}

              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
                <p className="text-xs text-yellow-800">
                  <strong>⚠️ Security Notice:</strong> Never share your card details, CVV, or PIN with anyone. 
                  Acredis will never ask for this information via email or phone.
                </p>
              </div>
            </div>

            {/* Close Button */}
            <div className="mt-6">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
