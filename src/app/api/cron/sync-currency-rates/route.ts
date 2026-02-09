import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const EXCHANGE_RATE_API_KEY = process.env.EXCHANGE_RATE_API_KEY;
const EXCHANGE_RATE_API_URL = `https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/latest/USD`;

/**
 * Cron job to sync exchange rates daily
 * This should be called by Vercel Cron or similar scheduler
 * 
 * To set up in Vercel:
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/sync-currency-rates",
 *     "schedule": "0 0 * * *"  // Daily at midnight UTC
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Add authorization header check for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch latest rates from ExchangeRate-API
    const response = await fetch(EXCHANGE_RATE_API_URL);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.result !== 'success') {
      throw new Error('Failed to fetch exchange rates from API');
    }

    const rates = data.conversion_rates;
    const syncTime = new Date();

    // Get all currencies from database
    const currencies = await prisma.currency.findMany({
      where: { isActive: true }
    });

    let updatedCount = 0;
    let skippedCount = 0;

    // Update each currency with the latest rate
    for (const currency of currencies) {
      const rate = rates[currency.code];
      
      if (rate) {
        await prisma.currency.update({
          where: { id: currency.id },
          data: {
            exchangeRate: rate,
            lastSynced: syncTime
          }
        });
        updatedCount++;
      } else {
        skippedCount++;
        console.warn(`[Cron] No rate found for ${currency.code}`);
      }
    }

    console.log(`[Cron] Currency sync completed: ${updatedCount} updated, ${skippedCount} skipped`);

    return NextResponse.json({
      success: true,
      message: 'Exchange rates synced successfully',
      stats: {
        updated: updatedCount,
        skipped: skippedCount,
        syncedAt: syncTime.toISOString()
      }
    });

  } catch (error: any) {
    console.error('[Cron] Error syncing exchange rates:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to sync exchange rates',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
