const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkUser() {
  const email = process.argv[2];
  if (!email) {
    console.log('Usage: node check-user.js <email>');
    process.exit(1);
  }
  
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true }
  });
  
  if (user) {
    console.log('✅ User EXISTS in database:');
    console.log(JSON.stringify(user, null, 2));
  } else {
    console.log('❌ User DOES NOT exist in database');
  }
  
  await prisma.$disconnect();
  process.exit(0);
}

checkUser().catch(console.error);
