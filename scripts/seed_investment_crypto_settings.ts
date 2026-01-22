import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('Seeding investment crypto settings...');

  const settings = [
    {
      key: 'investment.crypto.token',
      value: 'USDT',
      type: 'string',
      category: 'investment',
      description: 'Cryptocurrency token for investment deposits'
    },
    {
      key: 'investment.crypto.network',
      value: 'TRC20',
      type: 'string',
      category: 'investment',
      description: 'Blockchain network for investment deposits'
    },
    {
      key: 'investment.crypto.address',
      value: '',
      type: 'string',
      category: 'investment',
      description: 'Wallet address for receiving investment crypto deposits'
    }
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {
        value: setting.value,
        type: setting.type,
        category: setting.category,
        description: setting.description
      },
      create: setting
    });
    console.log(`✓ Created/updated setting: ${setting.key}`);
  }

  console.log('Investment crypto settings seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding investment crypto settings:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
