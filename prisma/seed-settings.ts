import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

const SYSTEM_SETTINGS = [
  {
    key: 'domestic_transfer_fee',
    value: '3',
    type: 'number',
    category: 'fees',
    description: 'Fee charged for domestic bank transfers (in USD)',
  },
  {
    key: 'international_transfer_fee',
    value: '25',
    type: 'number',
    category: 'fees',
    description: 'Fee charged for international bank transfers (in USD)',
  },
  {
    key: 'acredis_transfer_fee',
    value: '0',
    type: 'number',
    category: 'fees',
    description: 'Fee charged for Acredis-to-Acredis transfers (in USD)',
  },
  {
    key: 'min_transfer_amount',
    value: '1',
    type: 'number',
    category: 'limits',
    description: 'Minimum transfer amount (in USD)',
  },
  {
    key: 'max_transfer_amount',
    value: '1000000',
    type: 'number',
    category: 'limits',
    description: 'Maximum transfer amount per transaction (in USD)',
  },
  {
    key: 'daily_transfer_limit',
    value: '50000',
    type: 'number',
    category: 'limits',
    description: 'Maximum total transfer amount per day (in USD)',
  },
];

async function seedSettings() {
  console.log('⚙️  Seeding system settings...');

  for (const setting of SYSTEM_SETTINGS) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('✅ System settings seeded successfully!');
}

seedSettings()
  .catch((e) => {
    console.error('❌ Error seeding settings:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
