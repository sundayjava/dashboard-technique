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
  if (fromCurrency === toCurrency) {
    return amount;
  }

  const fromRate = EXCHANGE_RATES[fromCurrency];
  const toRate = EXCHANGE_RATES[toCurrency];

  if (!fromRate || !toRate) {
    throw new Error(`Exchange rate not found for ${fromCurrency} or ${toCurrency}`);
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
  if (fromCurrency === toCurrency) {
    return 1;
  }

  const fromRate = EXCHANGE_RATES[fromCurrency];
  const toRate = EXCHANGE_RATES[toCurrency];

  if (!fromRate || !toRate) {
    throw new Error(`Exchange rate not found for ${fromCurrency} or ${toCurrency}`);
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
