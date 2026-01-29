import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['query', 'error', 'warn'],
});

async function seedHoldingTokens() {
  console.log('Seeding holding tokens...');

  const tokens = [
    {
      name: 'Bitcoin',
      symbol: 'BTC',
      logo: null,
      tokenAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      currentPrice: 45000,
      priceChange24h: 2.5,
      interestRate: 5.0,
      isActive: true,
    },
    {
      name: 'Ethereum',
      symbol: 'ETH',
      logo: null,
      tokenAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      currentPrice: 2500,
      priceChange24h: -1.2,
      interestRate: 6.5,
      isActive: true,
    },
    {
      name: 'Tether',
      symbol: 'USDT',
      logo: null,
      tokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      currentPrice: 1.0,
      priceChange24h: 0.01,
      interestRate: 8.0,
      isActive: true,
    },
    {
      name: 'Binance Coin',
      symbol: 'BNB',
      logo: null,
      tokenAddress: '0xB8c77482e45F1F44dE1745F52C74426C631bDD52',
      currentPrice: 350,
      priceChange24h: 3.5,
      interestRate: 7.0,
      isActive: true,
    },
    {
      name: 'Solana',
      symbol: 'SOL',
      logo: null,
      tokenAddress: 'So11111111111111111111111111111111111111112',
      currentPrice: 100,
      priceChange24h: 5.2,
      interestRate: 9.0,
      isActive: true,
    },
    {
      name: 'Ripple',
      symbol: 'XRP',
      logo: null,
      tokenAddress: 'rN7n7otQDd6FczFgLdlqtyMVrn3HNU3AQPM',
      currentPrice: 0.60,
      priceChange24h: -2.1,
      interestRate: 6.0,
      isActive: true,
    },
  ];

  for (const token of tokens) {
    try {
      const existing = await prisma.holdingToken.findUnique({
        where: { symbol: token.symbol },
      });

      if (existing) {
        console.log(`Token ${token.symbol} already exists, updating...`);
        await prisma.holdingToken.update({
          where: { symbol: token.symbol },
          data: token,
        });
      } else {
        console.log(`Creating token ${token.symbol}...`);
        await prisma.holdingToken.create({
          data: token,
        });
      }
    } catch (error) {
      console.error(`Error seeding ${token.symbol}:`, error);
    }
  }

  console.log('Holding tokens seeded successfully!');
}

seedHoldingTokens()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
