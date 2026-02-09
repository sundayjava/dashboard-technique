import { prisma } from '@/lib/prisma';

// In-memory cache for exchange rates
let cachedRates: Record<string, number> | null = null;
let cacheExpiry: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Fallback exchange rates (used if database fetch fails)
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  NGN: 1460,
  ZAR: 18.5,
  KES: 129,
  GHS: 15.2,
  CAD: 1.35,
  AUD: 1.52,
  JPY: 149,
  CNY: 7.24,
  INR: 83.2,
  SAR: 3.75,
  AED: 3.67,
  QAR: 3.64,
  KWD: 0.31,
  OMR: 0.39,
  BHD: 0.38,
  EGP: 30.9,
  TRY: 32.5,
  CHF: 0.88,
  SEK: 10.4,
  NOK: 10.6,
  DKK: 6.85,
  PLN: 4.02,
  CZK: 22.8,
  HUF: 356,
  RON: 4.58,
  BGN: 1.80,
  HRK: 6.93,
  RUB: 92.5,
  UAH: 41.2,
  BRL: 4.97,
  MXN: 17.1,
  ARS: 1015,
  CLP: 950,
  COP: 3925,
  PEN: 3.72,
  SGD: 1.34,
  HKD: 7.82,
  KRW: 1340,
  THB: 35.2,
  MYR: 4.48,
  IDR: 15850,
  PHP: 56.8,
  VND: 24750,
  NZD: 1.67,
  PKR: 278,
  BDT: 110,
  LKR: 305,
  NPR: 133,
};

/**
 * Fetch exchange rates from database and cache them
 */
async function getExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();

  // Return cached rates if still valid
  if (cachedRates && now < cacheExpiry) {
    return cachedRates;
  }

  try {
    // Fetch from database
    const currencies = await prisma.currency.findMany({
      where: { isActive: true },
      select: {
        code: true,
        exchangeRate: true
      }
    });

    // Build rates object
    const rates: Record<string, number> = {};
    currencies.forEach(currency => {
      rates[currency.code.toUpperCase()] = currency.exchangeRate;
    });

    // Cache the rates
    cachedRates = rates;
    cacheExpiry = now + CACHE_DURATION;

    console.log(`[Currency Converter] Loaded ${Object.keys(rates).length} rates from database`);
    return rates;

  } catch (error) {
    console.error('[Currency Converter] Failed to fetch rates from database, using fallback:', error);
    // Use fallback rates if database fetch fails
    cachedRates = FALLBACK_RATES;
    cacheExpiry = now + CACHE_DURATION;
    return FALLBACK_RATES;
  }
}

/**
 * Convert amount from one currency to another
 * @param amount - The amount to convert
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code
 * @returns Converted amount
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  // Normalize currency codes to uppercase
  const from = fromCurrency?.toUpperCase() || 'USD';
  const to = toCurrency?.toUpperCase() || 'USD';

  if (from === to) {
    return amount;
  }

  const rates = await getExchangeRates();
  const fromRate = rates[from];
  const toRate = rates[to];

  if (!fromRate || !toRate) {
    throw new Error(`Exchange rate not found for ${from} or ${to}`);
  }

  // Convert to USD first, then to target currency
  const amountInUSD = amount / fromRate;
  const convertedAmount = amountInUSD * toRate;

  return Math.round(convertedAmount * 100) / 100; // Round to 2 decimal places
}

/**
 * Get exchange rate between two currencies
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code
 * @returns Exchange rate
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  // Normalize currency codes to uppercase
  const from = fromCurrency?.toUpperCase() || 'USD';
  const to = toCurrency?.toUpperCase() || 'USD';

  if (from === to) {
    return 1;
  }

  const rates = await getExchangeRates();
  const fromRate = rates[from];
  const toRate = rates[to];

  if (!fromRate || !toRate) {
    throw new Error(`Exchange rate not found for ${from} or ${to}`);
  }

  return toRate / fromRate;
}

/**
 * Format currency amount with symbol
 * @param amount - Amount to format
 * @param currency - Currency code
 * @returns Formatted string
 */
export function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    NGN: '₦',
    ZAR: 'R',
    KES: 'KSh',
    GHS: 'GH₵',
    CAD: 'CA$',
    AUD: 'A$',
    JPY: '¥',
    CNY: '¥',
    INR: '₹',
  };

  const symbol = symbols[currency] || currency;
  return `${symbol}${amount.toFixed(2)}`;
}

/**
 * Get currency symbol
 * @param currency - Currency code
 * @returns Currency symbol
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    NGN: '₦',
    ZAR: 'R',
    KES: 'KSh',
    GHS: 'GH₵',
    CAD: 'CA$',
    AUD: 'A$',
    JPY: '¥',
    CNY: '¥',
    INR: '₹',
  };

  return symbols[currency] || currency;
}
