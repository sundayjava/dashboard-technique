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
