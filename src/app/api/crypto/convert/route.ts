import { NextResponse } from 'next/server';
import { convertCryptoToFiat } from '@/lib/crypto-converter';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cryptoAmount, cryptoSymbol, fiatCurrency } = body;

    if (!cryptoAmount || !cryptoSymbol || !fiatCurrency) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const conversion = await convertCryptoToFiat(
      parseFloat(cryptoAmount),
      cryptoSymbol,
      fiatCurrency
    );

    return NextResponse.json(conversion);
  } catch (error: any) {
    console.error('Error converting crypto:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to convert cryptocurrency' },
      { status: 500 }
    );
  }
}
