import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const EXCHANGE_RATE_API_KEY = process.env.EXCHANGE_RATE_API_KEY;
const EXCHANGE_RATE_API_URL = `https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/latest/USD`;

// POST - Sync exchange rates from API to database
export async function POST(request: NextRequest) {
  try {
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
        console.warn(`No rate found for ${currency.code}`);
      }
    }

    // Log the sync activity
    console.log(`[Currency Sync] Updated ${updatedCount} currencies, skipped ${skippedCount}`);

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
    console.error('Error syncing exchange rates:', error);
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

// GET - Check when rates were last synced
export async function GET(request: NextRequest) {
  try {
    const currencies = await prisma.currency.findMany({
      where: { isActive: true },
      select: {
        code: true,
        name: true,
        exchangeRate: true,
        lastSynced: true
      },
      orderBy: { code: 'asc' }
    });

    // Find the most recent sync time
    const lastSync = currencies.reduce((latest, curr) => {
      if (!curr.lastSynced) return latest;
      if (!latest) return curr.lastSynced;
      return curr.lastSynced > latest ? curr.lastSynced : latest;
    }, null as Date | null);

    return NextResponse.json({
      success: true,
      currencies,
      lastSync: lastSync?.toISOString() || null,
      totalCurrencies: currencies.length
    });

  } catch (error: any) {
    console.error('Error fetching currency rates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch currency rates' },
      { status: 500 }
    );
  }
}
