import { NextResponse } from 'next/server';

const BINANCE_API = 'https://api.binance.com/api/v3';

// Cryptocurrency symbols mapping
const cryptoSymbols = [
  { symbol: 'BTC', name: 'Bitcoin', icon: '₿', binanceSymbol: 'BTCUSDT' },
  { symbol: 'ETH', name: 'Ethereum', icon: 'Ξ', binanceSymbol: 'ETHUSDT' },
  { symbol: 'BNB', name: 'Binance Coin', icon: 'BNB', binanceSymbol: 'BNBUSDT' },
  { symbol: 'SOL', name: 'Solana', icon: 'SOL', binanceSymbol: 'SOLUSDT' },
  { symbol: 'XRP', name: 'Ripple', icon: 'XRP', binanceSymbol: 'XRPUSDT' },
  { symbol: 'ADA', name: 'Cardano', icon: 'ADA', binanceSymbol: 'ADAUSDT' },
  { symbol: 'AVAX', name: 'Avalanche', icon: 'AVAX', binanceSymbol: 'AVAXUSDT' },
  { symbol: 'DOT', name: 'Polkadot', icon: 'DOT', binanceSymbol: 'DOTUSDT' },
  { symbol: 'MATIC', name: 'Polygon', icon: 'MATIC', binanceSymbol: 'MATICUSDT' },
  { symbol: 'LINK', name: 'Chainlink', icon: 'LINK', binanceSymbol: 'LINKUSDT' }
];

export async function GET() {
  try {
    // Fetch 24hr ticker data from Binance for all symbols
    const symbols = cryptoSymbols.map(c => `"${c.binanceSymbol}"`).join(',');
    const tickerResponse = await fetch(
      `${BINANCE_API}/ticker/24hr?symbols=[${symbols}]`,
      { next: { revalidate: 10 } }
    );

    if (!tickerResponse.ok) {
      throw new Error('Failed to fetch from Binance API');
    }

    const tickerData = await tickerResponse.json();

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
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch cryptocurrency data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
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
