import { NextRequest, NextResponse } from 'next/server';
import { convertCryptoToFiat } from '@/lib/crypto-converter';
import { convertCurrency } from '@/lib/currency-converter';

// GET method for fiat-to-fiat currency conversion
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const amount = parseFloat(searchParams.get('amount') || '0');
    const from = searchParams.get('from') || 'USD';
    const to = searchParams.get('to') || 'USD';

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    const convertedAmount = await convertCurrency(amount, from, to);

    return NextResponse.json({
      amount,
      from,
      to,
      convertedAmount,
    });
  } catch (error) {
    console.error('Error converting currency:', error);
    return NextResponse.json(
      { error: 'Failed to convert currency' },
      { status: 500 }
    );
  }
}

// POST method for crypto-to-fiat conversion
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
