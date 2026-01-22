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
  cardHolderName?: string;
  status: string;
}

interface CardDisplayProps {
  userId: string;
}

export default function CardDisplay({ userId }: CardDisplayProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

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
        <div className="relative w-full aspect-[1.586/1] max-w-[400px] mx-auto">
          {/* Placeholder Card */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 p-6 text-white shadow-2xl border-2 border-dashed border-gray-300">
            <div className="flex justify-between items-start mb-8">
              <div className="w-12 h-10 bg-white/20 rounded"></div>
              <CreditCard className="w-8 h-8 opacity-30" />
            </div>
            <div className="mb-6">
              <div className="text-2xl font-mono tracking-wider mb-1">**** **** **** ****</div>
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

      <div className="relative w-full aspect-[1.586/1] max-w-[400px] mx-auto">
        <motion.div
          key={currentCard.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 rounded-xl shadow-2xl overflow-hidden"
          style={{
            background: getCardGradient(currentCard.cardBrand),
          }}
        >
          {/* Card shine effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent" />
          
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
                {formatCardNumber(currentCard.cardNumber)}
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
    </div>
  );
}
