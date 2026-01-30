import { NextResponse } from 'next/server';

const BINANCE_API = 'https://api.binance.com/api/v3';

// Cryptocurrency symbols for investment dashboard
const cryptoSymbols = [
  { symbol: 'BTC', name: 'Bitcoin', icon: '₿', binanceSymbol: 'BTCUSDT' },
  { symbol: 'ETH', name: 'Ethereum', icon: 'Ξ', binanceSymbol: 'ETHUSDT' },
  { symbol: 'XRP', name: 'Ripple', icon: 'XRP', binanceSymbol: 'XRPUSDT' },
  { symbol: 'SOL', name: 'Solana', icon: 'SOL', binanceSymbol: 'SOLUSDT' },
  { symbol: 'BNB', name: 'Binance Coin', icon: 'BNB', binanceSymbol: 'BNBUSDT' },
  { symbol: 'DOT', name: 'Polkadot', icon: 'DOT', binanceSymbol: 'DOTUSDT' },
  { symbol: 'ADA', name: 'Cardano', icon: 'ADA', binanceSymbol: 'ADAUSDT' },
  { symbol: 'DOGE', name: 'Dogecoin', icon: 'DOGE', binanceSymbol: 'DOGEUSDT' },
  { symbol: 'USDT', name: 'Tether', icon: 'USDT', binanceSymbol: 'USDCUSDT' }
];

// Fallback prices
function getFallbackPrice(symbol: string): number {
  const fallbackPrices: Record<string, number> = {
    'BTC': 95000,
    'ETH': 3400,
    'XRP': 2.45,
    'SOL': 185,
    'BNB': 620,
    'DOT': 7.8,
    'ADA': 0.95,
    'DOGE': 0.32,
    'USDT': 1.00
  };
  return fallbackPrices[symbol] || 100;
}

function formatVolume(volume: number): string {
  if (volume >= 1e9) {
    return `$${(volume / 1e9).toFixed(2)}B`;
  } else if (volume >= 1e6) {
    return `$${(volume / 1e6).toFixed(1)}M`;
  } else if (volume >= 1e3) {
    return `$${(volume / 1e3).toFixed(1)}K`;
  }
  return `$${volume.toFixed(0)}`;
}

function generateFallbackHistory(currentPrice: number, change24h: number) {
  const history = [];
  const startPrice = currentPrice / (1 + change24h / 100);
  
  for (let i = 0; i < 24; i++) {
    const progress = i / 23;
    const randomFluctuation = (Math.random() - 0.5) * 0.02;
    const price = startPrice * (1 + (change24h / 100) * progress + randomFluctuation);
    
    history.push({
      time: `${i.toString().padStart(2, '0')}:00`,
      price: parseFloat(price.toFixed(2))
    });
  }
  
  return history;
}

export async function GET() {
  try {
    console.log('Fetching crypto data from Binance API...');
    
    // Fetch 24hr ticker data from Binance for all symbols
    const symbols = cryptoSymbols.map(c => `"${c.binanceSymbol}"`).join(',');
    const tickerResponse = await fetch(
      `${BINANCE_API}/ticker/24hr?symbols=[${symbols}]`,
      { 
        next: { revalidate: 10 },
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    console.log('Binance API status:', tickerResponse.status);

    if (!tickerResponse.ok) {
      const errorText = await tickerResponse.text();
      console.error('Binance API error:', errorText);
      throw new Error(`Binance API error: ${tickerResponse.status} - ${errorText}`);
    }

    const tickerData = await tickerResponse.json();
    console.log('Ticker data received:', tickerData.length, 'items');

    // Fetch kline data (candlestick) for price history
    const cryptoDataPromises = cryptoSymbols.map(async (crypto, index) => {
      try {
        const ticker = tickerData.find((t: any) => t.symbol === crypto.binanceSymbol) || tickerData[index];
        
        // Fetch 24 hourly candles for price history
        const klineResponse = await fetch(
          `${BINANCE_API}/klines?symbol=${crypto.binanceSymbol}&interval=1h&limit=24`,
          { next: { revalidate: 10 } }
        );

        let priceHistory = [];
        
        if (klineResponse.ok) {
          const klineData = await klineResponse.json();
          priceHistory = klineData.map((candle: any, i: number) => ({
            time: `${i.toString().padStart(2, '0')}:00`,
            price: parseFloat(candle[4])
          }));
        }

        const currentPrice = parseFloat(ticker.lastPrice);
        const change24h = parseFloat(ticker.priceChangePercent);
        const volume24h = parseFloat(ticker.quoteVolume);

        return {
          symbol: crypto.symbol,
          name: crypto.name,
          icon: crypto.icon,
          price: currentPrice,
          change24h: change24h,
          volume24h: formatVolume(volume24h),
          marketCap: 'N/A',
          priceHistory: priceHistory.length > 0 ? priceHistory : generateFallbackHistory(currentPrice, change24h)
        };
      } catch (error) {
        console.error(`Error fetching data for ${crypto.symbol}:`, error);
        return {
          symbol: crypto.symbol,
          name: crypto.name,
          icon: crypto.icon,
          price: 0,
          change24h: 0,
          volume24h: 'N/A',
          marketCap: 'N/A',
          priceHistory: []
        };
      }
    });

    const cryptoData = await Promise.all(cryptoDataPromises);

    return NextResponse.json({
      success: true,
      data: cryptoData,
      timestamp: new Date().toISOString(),
      source: 'Binance API'
    });

  } catch (error) {
    console.error('Error fetching crypto data:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Return fallback data instead of error
    const fallbackData = cryptoSymbols.map(crypto => ({
      symbol: crypto.symbol,
      name: crypto.name,
      icon: crypto.icon,
      price: getFallbackPrice(crypto.symbol),
      change24h: (Math.random() - 0.5) * 10,
      volume24h: 'N/A',
      marketCap: 'N/A',
      priceHistory: generateFallbackHistory(getFallbackPrice(crypto.symbol), (Math.random() - 0.5) * 10)
    }));
    
    return NextResponse.json({
      success: true,
      data: fallbackData,
      timestamp: new Date().toISOString(),
      source: 'Fallback data (Binance API unavailable)',
      warning: 'Using fallback prices - Binance API not accessible'
    });
  }
}
