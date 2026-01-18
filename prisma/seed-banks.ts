import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

const US_BANKS = [
  { code: 'BOA', name: 'Bank of America' },
  { code: 'CHASE', name: 'Chase Bank' },
  { code: 'WF', name: 'Wells Fargo' },
  { code: 'CITI', name: 'Citibank' },
  { code: 'USB', name: 'U.S. Bank' },
  { code: 'PNC', name: 'PNC Bank' },
  { code: 'CAP1', name: 'Capital One' },
  { code: 'TD', name: 'TD Bank' },
  { code: 'TRUIST', name: 'Truist Bank' },
  { code: 'GS', name: 'Goldman Sachs Bank' },
];

async function seedBanks() {
  console.log('🏦 Seeding banks...');

  for (const bank of US_BANKS) {
    await prisma.bank.upsert({
      where: { code: bank.code },
      update: {},
      create: {
        code: bank.code,
        name: bank.name,
        isActive: true,
      },
    });
  }

  console.log('✅ Banks seeded successfully!');
}

seedBanks()
  .catch((e) => {
    console.error('❌ Error seeding banks:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
