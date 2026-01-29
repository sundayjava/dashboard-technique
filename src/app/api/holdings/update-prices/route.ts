import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import axios from 'axios';

// This endpoint updates token prices and user holdings
// Can be called anytime to refresh prices
export async function POST(request: NextRequest) {
  try {

    // Get all active tokens
    const tokens = await prisma.holdingToken.findMany({
      where: { isActive: true },
    });

    if (tokens.length === 0) {
      return NextResponse.json({ message: 'No active tokens to update' });
    }

    // Fetch current prices from crypto API
    const symbols = tokens.map(t => t.symbol).join(',');
    
    let priceData: any = {};
    try {
      // Using CoinGecko API (free tier)
      const ids = tokens.map(t => {
        // Map symbols to CoinGecko IDs
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

      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
      );

      priceData = response.data;
    } catch (error) {
      console.error('Error fetching prices from CoinGecko:', error);
      // Fallback: use existing prices with small random variation (for demo)
      tokens.forEach(token => {
        const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
        priceData[token.symbol] = {
          usd: token.currentPrice * (1 + variation),
          usd_24h_change: variation * 100,
        };
      });
    }

    // Update tokens and holdings
    const updates = [];

    for (const token of tokens) {
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

      if (!price) continue;

      const newPrice = price.usd || token.currentPrice;
      const priceChange = price.usd_24h_change || 0;

      // Update token
      await prisma.holdingToken.update({
        where: { id: token.id },
        data: {
          currentPrice: newPrice,
          priceChange24h: priceChange,
        },
      });

      // Update all active holdings for this token
      const holdings = await prisma.userHolding.findMany({
        where: {
          tokenId: token.id,
          status: 'ACTIVE',
        },
      });

      for (const holding of holdings) {
        // Calculate new current value based on token amount and new price
        const newValue = holding.tokenAmount * newPrice;

        // Calculate interest based on CURRENT VALUE (grows/falls with token price)
        // This makes interest compound with token price changes
        const daysSinceCreation = Math.floor(
          (Date.now() - holding.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        const dailyRate = token.interestRate / 365 / 100;
        // Use currentValue instead of depositedAmount so interest follows token price
        const interest = newValue * dailyRate * daysSinceCreation;

        await prisma.userHolding.update({
          where: { id: holding.id },
          data: {
            currentValue: newValue,
            interestEarned: interest,
          },
        });
      }

      updates.push({
        symbol: token.symbol,
        oldPrice: token.currentPrice,
        newPrice,
        priceChange,
        holdingsUpdated: holdings.length,
      });
    }

    return NextResponse.json({
      message: 'Prices updated successfully',
      updates,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating prices:', error);
    return NextResponse.json({ error: 'Failed to update prices' }, { status: 500 });
  }
}

// GET - Manually trigger price update (admin only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('adminId');

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }

    // Verify admin
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Trigger update
    const response = await fetch(`${request.nextUrl.origin}/api/holdings/update-prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error triggering price update:', error);
    return NextResponse.json({ error: 'Failed to trigger update' }, { status: 500 });
  }
}
