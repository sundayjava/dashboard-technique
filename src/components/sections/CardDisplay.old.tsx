'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';

interface CardApplication {
  id: string;
  cardType: string;
  status: string;
  phoneNumber: string;
  accountNumber: string;
  createdAt: string;
  approvedAt?: string;
  user: {
    name: string;
    email: string;
  };
}

interface CardDisplayProps {
  userId: string;
}

const CardDisplay = ({ userId }: CardDisplayProps) => {
  const [cards, setCards] = useState<CardApplication[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCards();
  }, [userId]);

  const fetchCards = async () => {
    try {
      const response = await axios.get(`/api/card-applications?userId=${userId}&status=ISSUED`);
      if (response.data.applications) {
        // Filter for issued or approved cards
        const activeCards = response.data.applications.filter(
          (card: CardApplication) => card.status === 'ISSUED' || card.status === 'APPROVED'
        );
        setCards(activeCards);
      }
    } catch (error) {
      console.error('Error fetching cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCardBrand = (cardType: string) => {
    // In production, this would be determined by the card number range or stored in DB
    // For now, we'll use VIRTUAL cards as Visa, and can add more logic later
    // Card number ranges:
    // Visa: starts with 4
    // Mastercard: starts with 51-55 or 2221-2720
    // American Express: starts with 34 or 37
    // Discover: starts with 6011, 622126-622925, 644-649, 65
    
    // For demo purposes, we'll alternate or use random selection
    const brands = ['visa', 'mastercard', 'amex'];
    const randomBrand = brands[Math.floor(Math.random() * brands.length)];
    return randomBrand;
  };

  const generateCardNumber = (accountNumber: string, brand: string) => {
    // Generate a card number based on account number and brand
    const lastFourDigits = accountNumber.slice(-4);
    
    // Set prefix based on card brand
    let prefix = '';
    if (brand === 'visa') {
      prefix = '4';
    } else if (brand === 'mastercard') {
      prefix = '5';
    } else if (brand === 'amex') {
      // American Express has 15 digits, different format
      return `3*** ****** *${lastFourDigits.slice(-3)}`;
    }
    
    return `${prefix}*** **** **** ${lastFourDigits}`;
  };

  const generateExpiryDate = (approvedAt?: string) => {
    // Generate expiry date 4 years from approval or creation
    const date = approvedAt ? new Date(approvedAt) : new Date();
    date.setFullYear(date.getFullYear() + 4);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${year}`;
  };

  const nextCard = () => {
    setCurrentCardIndex((prev) => (prev + 1) % cards.length);
  };

  const prevCard = () => {
    setCurrentCardIndex((prev) => (prev - 1 + cards.length) % cards.length);
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

  // Show placeholder if no cards
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
          <div className="absolute inset-0 rounded-xl bg-linear-to-br from-gray-400 via-gray-500 to-gray-600 p-4 sm:p-6 text-white shadow-2xl border-2 border-dashed border-gray-300 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="w-10 h-8 sm:w-12 sm:h-10 bg-white/20 rounded"></div>
              <CreditCard className="w-6 h-6 sm:w-8 sm:h-8 opacity-30" />
            </div>
            <div className="flex-1 flex items-center">
              <div className="text-lg sm:text-2xl font-mono tracking-wider">**** **** **** ****</div>
            </div>
            <div className="flex justify-between items-end gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] sm:text-xs opacity-70 mb-0.5 sm:mb-1">CARD HOLDER</div>
                <div className="font-semibold text-xs sm:text-base">NO CARD ISSUED</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] sm:text-xs opacity-70 mb-0.5 sm:mb-1">EXPIRES</div>
                <div className="font-semibold text-xs sm:text-base">--/--</div>
              </div>
            </div>
            
            {/* Center message */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-xl">
              <div className="text-center px-4">
                <CreditCard className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 opacity-50" />
                <p className="text-xs sm:text-sm font-semibold">Apply for a Virtual Card</p>
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
  const cardBrand = getCardBrand(currentCard.cardType);
  const cardNumber = generateCardNumber(currentCard.accountNumber, cardBrand);
  const expiryDate = generateExpiryDate(currentCard.approvedAt);

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

      <div className="relative">
        {/* Card Display */}
        <div className="relative w-full aspect-[1.586/1] max-w-100 mx-auto">
          {cardBrand === 'visa' ? (
            // Visa Card Design
            <div className="absolute inset-0 rounded-xl bg-linear-to-br from-blue-600 via-blue-700 to-blue-900 p-4 sm:p-6 text-white shadow-2xl flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="w-10 h-8 sm:w-12 sm:h-10 bg-linear-to-br from-yellow-200 to-yellow-400 rounded"></div>
                <div className="text-right">
                  <svg className="w-12 h-4 sm:w-16 sm:h-5" viewBox="0 0 141 48" fill="currentColor">
                    <path d="M34.5 23.7l-6.8-16.8h-4.5l-6.8 16.8h4.2l1.3-3.4h6.9l1.3 3.4h4.4zm-9.7-6.5l2.2-5.8 2.2 5.8h-4.4zm18.8 6.5h4.1V6.9h-4.1v16.8zm14.3.4c2.4 0 4.4-.8 5.8-2.4l.1 2h3.7V13.5c0-4-3-6.6-7.2-6.6-3.9 0-6.9 2.3-7.5 5.5l3.8.5c.4-1.7 1.7-2.7 3.6-2.7 2.1 0 3.4 1.1 3.4 2.9v.2l-4.8.3c-4.4.3-7.2 2.2-7.2 5.6-.1 3.2 2.4 5.4 6.3 5.4zm.9-3.3c-1.8 0-3-.9-3-2.3 0-1.5 1.2-2.3 3.4-2.5l4-.3v1.1c0 2.4-2 4-4.4 4z"/>
                  </svg>
                </div>
              </div>
              <div className="flex-1 flex items-center">
                <div className="text-lg sm:text-2xl font-mono tracking-wider">{cardNumber}</div>
              </div>
              <div className="flex justify-between items-end gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] sm:text-xs opacity-70 mb-0.5 sm:mb-1">CARD HOLDER</div>
                  <div className="font-semibold uppercase text-xs sm:text-base truncate">{currentCard.user.name}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] sm:text-xs opacity-70 mb-0.5 sm:mb-1">EXPIRES</div>
                  <div className="font-semibold text-xs sm:text-base">{expiryDate}</div>
                </div>
              </div>
            </div>
          ) : cardBrand === 'mastercard' ? (
            // Mastercard Design
            <div className="absolute inset-0 rounded-xl bg-linear-to-br from-gray-800 via-gray-900 to-black p-4 sm:p-6 text-white shadow-2xl flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="w-10 h-8 sm:w-12 sm:h-10 bg-linear-to-br from-yellow-200 to-yellow-400 rounded"></div>
                <div className="flex gap-[-8px]">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-red-500 opacity-90"></div>
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-yellow-500 opacity-90 -ml-3"></div>
                </div>
              </div>
              <div className="flex-1 flex items-center">
                <div className="text-lg sm:text-2xl font-mono tracking-wider">{cardNumber}</div>
              </div>
              <div className="flex justify-between items-end gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] sm:text-xs opacity-70 mb-0.5 sm:mb-1">CARD HOLDER</div>
                  <div className="font-semibold uppercase text-xs sm:text-base truncate">{currentCard.user.name}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] sm:text-xs opacity-70 mb-0.5 sm:mb-1">EXPIRES</div>
                  <div className="font-semibold text-xs sm:text-base">{expiryDate}</div>
                </div>
              </div>
            </div>
          ) : (
            // American Express Design
            <div className="absolute inset-0 rounded-xl bg-linear-to-br from-blue-400 via-blue-500 to-blue-600 p-4 sm:p-6 text-white shadow-2xl flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="w-10 h-8 sm:w-12 sm:h-10 bg-linear-to-br from-yellow-200 to-yellow-400 rounded"></div>
                <div className="text-right">
                  <div className="text-sm sm:text-lg font-bold tracking-tight">AMERICAN</div>
                  <div className="text-sm sm:text-lg font-bold tracking-tight -mt-1">EXPRESS</div>
                </div>
              </div>
              <div className="flex-1 flex items-center">
                <div className="text-base sm:text-xl font-mono tracking-wider">{cardNumber}</div>
              </div>
              <div className="flex justify-between items-end gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] sm:text-xs opacity-70 mb-0.5 sm:mb-1">CARD MEMBER</div>
                  <div className="font-semibold uppercase text-xs sm:text-base truncate">{currentCard.user.name}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] sm:text-xs opacity-70 mb-0.5 sm:mb-1">VALID THRU</div>
                  <div className="font-semibold text-xs sm:text-base">{expiryDate}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Arrows */}
        {cards.length > 1 && (
          <div className="flex justify-center items-center gap-4 mt-4">
            <button
              onClick={prevCard}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <span className="text-sm text-gray-600">
              {currentCardIndex + 1} of {cards.length}
            </span>
            <button
              onClick={nextCard}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        )}
      </div>

      {/* Card Status */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Status:</span>
          <span className={`font-semibold ${currentCard.status === 'ISSUED' ? 'text-green-600' : 'text-blue-600'}`}>
            {currentCard.status}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-gray-600">Type:</span>
          <span className="font-semibold text-gray-900">{currentCard.cardType}</span>
        </div>
      </div>
    </div>
  );
};

export default CardDisplay;
