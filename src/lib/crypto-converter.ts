import { convertCurrency, getExchangeRate } from './currency-converter';

// Stablecoins pegged to USD (1:1)
const STABLECOINS = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'GUSD', 'USDD'];

/**
 * Get current cryptocurrency price in USD from Binance API
 */
export async function getCryptoPrice(symbol: string): Promise<number> {
  try {
    const normalizedSymbol = symbol.toUpperCase().trim();
    
    // Handle stablecoins - they're pegged to USD at 1:1
    if (STABLECOINS.includes(normalizedSymbol)) {
      console.log(`[Crypto Converter] ${normalizedSymbol} is a stablecoin, using $1.00`);
      return 1.0;
    }
    
    const binanceSymbol = `${normalizedSymbol}USDT`;
    
    console.log(`[Crypto Converter] Fetching price for ${normalizedSymbol} (${binanceSymbol})`);
    
    const response = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`,
      { 
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Crypto Converter] Binance API error for ${binanceSymbol}:`, errorText);
      throw new Error(`Failed to fetch ${normalizedSymbol} price from Binance (trading pair ${binanceSymbol} may not exist)`);
    }

    const data = await response.json();
    const price = parseFloat(data.price);
    
    console.log(`[Crypto Converter] ${normalizedSymbol} price: $${price.toLocaleString()}`);
    
    return price;
  } catch (error: any) {
    console.error(`[Crypto Converter] Error fetching ${symbol} price:`, error);
    throw new Error(`Unable to get ${symbol.toUpperCase()} price. Please verify the token symbol is correct. Error: ${error.message}`);
  }
}

/**
 * Convert cryptocurrency amount to fiat currency
 * @param cryptoAmount - Amount of cryptocurrency
 * @param cryptoSymbol - Cryptocurrency symbol (BTC, ETH, etc.)
 * @param fiatCurrency - Target fiat currency (USD, EUR, etc.)
 * @returns Converted amount in fiat currency
 */
export async function convertCryptoToFiat(
  cryptoAmount: number,
  cryptoSymbol: string,
  fiatCurrency: string
): Promise<{ fiatAmount: number; cryptoPrice: number; exchangeRate: number }> {
  console.log(`[Crypto Converter] Converting ${cryptoAmount} ${cryptoSymbol} to ${fiatCurrency}`);
  
  // Get crypto price in USD
  const cryptoPriceUSD = await getCryptoPrice(cryptoSymbol);
  
  // Convert crypto to USD
  const amountInUSD = cryptoAmount * cryptoPriceUSD;
  
  console.log(`[Crypto Converter] ${cryptoAmount} ${cryptoSymbol} × $${cryptoPriceUSD} = $${amountInUSD.toLocaleString()}`);
  
  // If target is USD, return directly
  if (fiatCurrency === 'USD') {
    return {
      fiatAmount: Math.round(amountInUSD * 100) / 100,
      cryptoPrice: cryptoPriceUSD,
      exchangeRate: 1,
    };
  }
  
  // Convert USD to target fiat currency
  const fiatAmount = convertCurrency(amountInUSD, 'USD', fiatCurrency);
  const exchangeRate = getExchangeRate('USD', fiatCurrency);
  
  console.log(`[Crypto Converter] $${amountInUSD} USD × ${exchangeRate} = ${fiatCurrency} ${fiatAmount.toLocaleString()}`);
  
  return {
    fiatAmount,
    cryptoPrice: cryptoPriceUSD,
    exchangeRate,
  };
}

/**
 * Format crypto amount with symbol
 */
export function formatCryptoAmount(amount: number, symbol: string): string {
  const decimals = amount < 0.01 ? 8 : amount < 1 ? 6 : 4;
  return `${amount.toFixed(decimals)} ${symbol}`;
}
