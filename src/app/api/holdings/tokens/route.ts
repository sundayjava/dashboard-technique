import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import axios from 'axios';

// GET - Get available holding tokens with live prices (user)
export async function GET() {
  try {
    // Fetch tokens from database
    const tokens = await prisma.holdingToken.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    if (tokens.length === 0) {
      return NextResponse.json({ tokens: [] });
    }

    // Fetch live prices from CoinGecko
    const ids = tokens.map(t => {
      const idMap: Record<string, string> = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'USDT': 'tether',
        'BNB': 'binancecoin',
        'XRP': 'ripple',
        'ADA': 'cardano',
        'DOGE': 'dogecoin',
        'SOL': 'solana',
        'TRX': 'tron',
        'DOT': 'polkadot',
      };
      return idMap[t.symbol] || t.symbol.toLowerCase();
    }).join(',');

    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
        { timeout: 5000 }
      );

      const priceData = response.data;

      // Update tokens with live prices
      const updatedTokens = await Promise.all(
        tokens.map(async (token) => {
          const idMap: Record<string, string> = {
            'BTC': 'bitcoin',
            'ETH': 'ethereum',
            'USDT': 'tether',
            'BNB': 'binancecoin',
            'XRP': 'ripple',
            'ADA': 'cardano',
            'DOGE': 'dogecoin',
            'SOL': 'solana',
            'TRX': 'tron',
            'DOT': 'polkadot',
          };
          const coinId = idMap[token.symbol] || token.symbol.toLowerCase();
          const price = priceData[coinId];

          if (price) {
            // Update in database for consistency
            const updated = await prisma.holdingToken.update({
              where: { id: token.id },
              data: {
                currentPrice: price.usd,
                priceChange24h: price.usd_24h_change || 0,
              },
            });
            return updated;
          }
          return token;
        })
      );

      return NextResponse.json({ tokens: updatedTokens });
    } catch (apiError) {
      console.error('Error fetching live prices:', apiError);
      // Return cached prices from database if API fails
      return NextResponse.json({ tokens });
    }
  } catch (error) {
    console.error('Error fetching tokens:', error);
    return NextResponse.json({ error: 'Failed to fetch tokens' }, { status: 500 });
  }
}
