import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get crypto deposit information for investment wallet
export async function GET(request: NextRequest) {
  try {
    // Fetch crypto deposit settings from database
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'investment.crypto.token',
            'investment.crypto.network',
            'investment.crypto.address'
          ]
        }
      }
    });

    // Convert to key-value map
    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);

    const depositInfo = {
      tokenName: settingsMap['investment.crypto.token'] || 'USDT',
      network: settingsMap['investment.crypto.network'] || 'TRC20',
      walletAddress: settingsMap['investment.crypto.address'] || 'Not configured - Please contact admin'
    };

    return NextResponse.json({
      success: true,
      info: depositInfo
    });

  } catch (error) {
    console.error('Error fetching crypto deposit info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deposit information' },
      { status: 500 }
    );
  }
}
