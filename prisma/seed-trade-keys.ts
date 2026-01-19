import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function seedTradeKeys() {
  console.log('🔑 Seeding trade keys...');

  try {
    // Get the first user (or you can specify a specific user ID)
    const firstUser = await prisma.user.findFirst({
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!firstUser) {
      console.log('⚠️  No users found. Please create a user first.');
      return;
    }

    // Create a default trade key
    const tradeKey = await prisma.tradeKey.upsert({
      where: { key: 'TK-DEFAULT-2026' },
      update: {},
      create: {
        key: 'TK-DEFAULT-2026',
        userId: firstUser.id,
        isActive: true,
        maxUses: null, // Unlimited uses
        expiresAt: null, // Never expires
      },
    });

    console.log('✅ Default trade key created:');
    console.log(`   Key: ${tradeKey.key}`);
    console.log(`   Owner: ${firstUser.email}`);
    console.log(`   Max Uses: Unlimited`);
    console.log(`   Expires: Never`);

    // Create a few more sample trade keys with different settings
    const limitedKey = await prisma.tradeKey.upsert({
      where: { key: 'TK-LIMITED-2026' },
      update: {},
      create: {
        key: 'TK-LIMITED-2026',
        userId: firstUser.id,
        isActive: true,
        maxUses: 10, // Limited to 10 uses
        expiresAt: null,
      },
    });

    console.log('\n✅ Limited trade key created:');
    console.log(`   Key: ${limitedKey.key}`);
    console.log(`   Owner: ${firstUser.email}`);
    console.log(`   Max Uses: 10`);

    // Create an expiring key (30 days from now)
    const expiringDate = new Date();
    expiringDate.setDate(expiringDate.getDate() + 30);

    const expiringKey = await prisma.tradeKey.upsert({
      where: { key: 'TK-EXPIRE-2026' },
      update: {},
      create: {
        key: 'TK-EXPIRE-2026',
        userId: firstUser.id,
        isActive: true,
        maxUses: null,
        expiresAt: expiringDate,
      },
    });

    console.log('\n✅ Expiring trade key created:');
    console.log(`   Key: ${expiringKey.key}`);
    console.log(`   Owner: ${firstUser.email}`);
    console.log(`   Expires: ${expiringDate.toLocaleDateString()}`);

    console.log('\n🎉 Trade keys seeded successfully!');
    console.log('\n📝 You can use any of these keys to test:');
    console.log('   - TK-DEFAULT-2026 (unlimited, never expires)');
    console.log('   - TK-LIMITED-2026 (max 10 uses)');
    console.log('   - TK-EXPIRE-2026 (expires in 30 days)');
  } catch (error) {
    console.error('❌ Error seeding trade keys:', error);
    throw error;
  }
}

async function main() {
  try {
    await seedTradeKeys();
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
