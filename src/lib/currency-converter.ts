// Exchange rates relative to USD (1 USD = X currency)
const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  NGN: 1580,
  ZAR: 18.5,
  KES: 129,
  GHS: 15.2,
  CAD: 1.35,
  AUD: 1.52,
  JPY: 149,
  CNY: 7.24,
  INR: 83.2,
  SAR: 3.75,      // Saudi Riyal
  AED: 3.67,      // UAE Dirham
  QAR: 3.64,      // Qatari Riyal
  KWD: 0.31,      // Kuwaiti Dinar
  OMR: 0.39,      // Omani Rial
  BHD: 0.38,      // Bahraini Dinar
  EGP: 30.9,      // Egyptian Pound
  TRY: 32.5,      // Turkish Lira
  CHF: 0.88,      // Swiss Franc
  SEK: 10.4,      // Swedish Krona
  NOK: 10.6,      // Norwegian Krone
  DKK: 6.85,      // Danish Krone
  PLN: 4.02,      // Polish Zloty
  CZK: 22.8,      // Czech Koruna
  HUF: 356,       // Hungarian Forint
  RON: 4.58,      // Romanian Leu
  BGN: 1.80,      // Bulgarian Lev
  HRK: 6.93,      // Croatian Kuna
  RUB: 92.5,      // Russian Ruble
  UAH: 41.2,      // Ukrainian Hryvnia
  BRL: 4.97,      // Brazilian Real
  MXN: 17.1,      // Mexican Peso
  ARS: 1015,      // Argentine Peso
  CLP: 950,       // Chilean Peso
  COP: 3925,      // Colombian Peso
  PEN: 3.72,      // Peruvian Sol
  SGD: 1.34,      // Singapore Dollar
  HKD: 7.82,      // Hong Kong Dollar
  KRW: 1340,      // South Korean Won
  THB: 35.2,      // Thai Baht
  MYR: 4.48,      // Malaysian Ringgit
  IDR: 15850,     // Indonesian Rupiah
  PHP: 56.8,      // Philippine Peso
  VND: 24750,     // Vietnamese Dong
  NZD: 1.67,      // New Zealand Dollar
  PKR: 278,       // Pakistani Rupee
  BDT: 110,       // Bangladeshi Taka
  LKR: 305,       // Sri Lankan Rupee
  NPR: 133,       // Nepalese Rupee
};

/**
 * Convert amount from one currency to another
 * @param amount - The amount to convert
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code
 * @returns Converted amount
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number {
  // Normalize currency codes to uppercase
  const from = fromCurrency?.toUpperCase() || 'USD';
  const to = toCurrency?.toUpperCase() || 'USD';

  if (from === to) {
    return amount;
  }

  const fromRate = EXCHANGE_RATES[from];
  const toRate = EXCHANGE_RATES[to];

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
export function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): number {
  // Normalize currency codes to uppercase
  const from = fromCurrency?.toUpperCase() || 'USD';
  const to = toCurrency?.toUpperCase() || 'USD';

  if (from === to) {
    return 1;
  }

  const fromRate = EXCHANGE_RATES[from];
  const toRate = EXCHANGE_RATES[to];

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
