import { convertCurrency, getExchangeRate } from './currency-converter';

// Stablecoins pegged to USD (1:1)
const STABLECOINS = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'GUSD', 'USDD'];

/**
 * Get current cryptocurrency price in USD from CoinGecko API with Binance fallback
 */
export async function getCryptoPrice(symbol: string): Promise<number> {
  const normalizedSymbol = symbol.toUpperCase().trim();
  
  // Handle stablecoins - they're pegged to USD at 1:1
  if (STABLECOINS.includes(normalizedSymbol)) {
    console.log(`[Crypto Converter] ${normalizedSymbol} is a stablecoin, using $1.00`);
    return 1.0;
  }
  
  // Try CoinGecko first (more reliable)
  try {
    const coinGeckoId = getCoinGeckoId(normalizedSymbol);
    console.log(`[Crypto Converter] Fetching price for ${normalizedSymbol} from CoinGecko (${coinGeckoId})`);
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd`,
      { 
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      }
    );

    if (response.ok) {
      const data = await response.json();
      const price = data[coinGeckoId]?.usd;
      
      if (price) {
        console.log(`[Crypto Converter] ${normalizedSymbol} price from CoinGecko: $${price.toLocaleString()}`);
        return price;
      }
    }
  } catch (error) {
    console.warn(`[Crypto Converter] CoinGecko failed for ${normalizedSymbol}, trying Binance:`, error);
  }
  
  // Fallback to Binance
  try {
    const binanceSymbol = `${normalizedSymbol}USDT`;
    console.log(`[Crypto Converter] Fetching price for ${normalizedSymbol} from Binance (${binanceSymbol})`);
    
    const response = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`,
      { 
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      throw new Error(`Binance API returned ${response.status}`);
    }

    const data = await response.json();
    const price = parseFloat(data.price);
    
    console.log(`[Crypto Converter] ${normalizedSymbol} price from Binance: $${price.toLocaleString()}`);
    
    return price;
  } catch (error: any) {
    console.error(`[Crypto Converter] Both APIs failed for ${symbol}:`, error);
    throw new Error(`Unable to get ${normalizedSymbol} price. Both CoinGecko and Binance APIs are unavailable. Error: ${error.message}`);
  }
}

/**
 * Map crypto symbol to CoinGecko ID
 */
function getCoinGeckoId(symbol: string): string {
  const mapping: Record<string, string> = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'BNB': 'binancecoin',
    'SOL': 'solana',
    'XRP': 'ripple',
    'ADA': 'cardano',
    'DOGE': 'dogecoin',
    'DOT': 'polkadot',
    'MATIC': 'matic-network',
    'LINK': 'chainlink',
    'AVAX': 'avalanche-2',
    'UNI': 'uniswap',
    'LTC': 'litecoin',
    'ATOM': 'cosmos',
  };
  
  return mapping[symbol] || symbol.toLowerCase();
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
  const fiatAmount = await convertCurrency(amountInUSD, 'USD', fiatCurrency);
  const exchangeRate = await getExchangeRate('USD', fiatCurrency);
  
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
