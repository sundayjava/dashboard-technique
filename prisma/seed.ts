import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

// Admin credentials
const ADMIN_EMAIL = 'admin@acredisfinance.com';
const ADMIN_PASSWORD = 'Admin@Acredis2026';
const ADMIN_PIN = '0000';

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

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
];

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

async function seedCurrencies() {
  console.log('💱 Seeding currencies...');

  for (const currency of CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: {},
      create: currency,
    });
  }

  console.log('✅ Currencies seeded successfully!');
}

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

async function seedAdmin() {
  console.log('👤 Seeding admin user...');

  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (existingAdmin) {
    console.log('⚠️  Admin user already exists, skipping...');
    return existingAdmin;
  }

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const hashedPin = await bcrypt.hash(ADMIN_PIN, 12);
  const authCode = `AC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      password: hashedPassword,
      transactionPin: hashedPin,
      phoneNumber: '0000000000',
      countryCode: '+1',
      accountType: 'PERSONAL',
      currency: 'USD',
      authorizationCode: authCode,
      role: 'ADMIN',
      emailVerified: true,
      name: 'System Administrator',
      address: 'System Generated',
    },
  });

  console.log('✅ Admin user created!');
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`   Transaction PIN: ${ADMIN_PIN}`);
  console.log(`   Auth Code: ${authCode}`);

  return admin;
}

async function seedCryptoTokens() {
  console.log('💰 Seeding crypto tokens...');

  const tokens = [
    {
      name: 'Bitcoin',
      symbol: 'BTC',
      network: 'Bitcoin Network',
      address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      exchangeRate: 65000,
    },
    {
      name: 'Ethereum',
      symbol: 'ETH',
      network: 'Ethereum (ERC20)',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      exchangeRate: 3500,
    },
    {
      name: 'Tether',
      symbol: 'USDT',
      network: 'Ethereum (ERC20)',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      exchangeRate: 1,
    },
    {
      name: 'USD Coin',
      symbol: 'USDC',
      network: 'Ethereum (ERC20)',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      exchangeRate: 1,
    },
    {
      name: 'Binance Coin',
      symbol: 'BNB',
      network: 'Binance Smart Chain',
      address: 'bnb1grpf0955h0ykzq3ar5nmum7y6gdfl6lxfn46h2',
      exchangeRate: 600,
    },
  ];

  for (const token of tokens) {
    await prisma.cryptoToken.upsert({
      where: { symbol_network: { symbol: token.symbol, network: token.network } },
      update: {},
      create: token,
    });
  }

  console.log('✅ Crypto tokens seeded successfully!');
}

async function seedFAQs() {
  console.log('❓ Seeding FAQs...');

  const faqs = [
    {
      category: 'Account',
      question: 'How do I create an account?',
      answer: 'Click on the Sign Up button and fill in your details. You will need to verify your email and complete KYC verification.',
      order: 1,
    },
    {
      category: 'Account',
      question: 'How do I verify my account?',
      answer: 'After signing up, submit your KYC documents including ID proof and address proof. Our team will review and verify within 24-48 hours.',
      order: 2,
    },
    {
      category: 'Transfers',
      question: 'What are the transfer fees?',
      answer: 'Domestic transfers: $3, International transfers: $25, Acredis-to-Acredis transfers: Free',
      order: 1,
    },
    {
      category: 'Transfers',
      question: 'What are the transfer limits?',
      answer: 'Minimum: $1, Maximum per transaction: $1,000,000, Daily limit: $50,000',
      order: 2,
    },
    {
      category: 'Security',
      question: 'How secure is my account?',
      answer: 'We use bank-level encryption, two-factor authentication, and secure OTP verification for all transactions.',
      order: 1,
    },
    {
      category: 'Security',
      question: 'What should I do if I forget my password?',
      answer: 'Click on "Forgot Password" on the login page and follow the instructions to reset your password via email.',
      order: 2,
    },
  ];

  for (const faq of faqs) {
    await prisma.fAQ.upsert({
      where: { id: `faq-${faq.category.toLowerCase()}-${faq.order}` },
      update: {},
      create: {
        id: `faq-${faq.category.toLowerCase()}-${faq.order}`,
        ...faq,
      },
    });
  }

  console.log('✅ FAQs seeded successfully!');
}

async function seedInvestmentPlans() {
  console.log('📈 Seeding investment plans...');

  const plans = [
    {
      planName: 'Starter Plan',
      minAmount: 1000,
      maxAmount: 10000,
      arkIIAllocation: 30,
      duration: 30, // 30 days
      profitPercentage: 5,
    },
    {
      planName: 'Growth Plan',
      minAmount: 10000,
      maxAmount: 50000,
      arkIIAllocation: 50,
      duration: 60, // 60 days
      profitPercentage: 12,
    },
    {
      planName: 'Premium Plan',
      minAmount: 50000,
      maxAmount: 200000,
      arkIIAllocation: 70,
      duration: 90, // 90 days
      profitPercentage: 20,
    },
    {
      planName: 'Elite Plan',
      minAmount: 200000,
      maxAmount: 1000000,
      arkIIAllocation: 90,
      duration: 180, // 180 days
      profitPercentage: 45,
    },
  ];

  for (const plan of plans) {
    await prisma.investmentPlan.upsert({
      where: { id: `plan-${plan.planName.toLowerCase().replace(/\s+/g, '-')}` },
      update: {},
      create: {
        id: `plan-${plan.planName.toLowerCase().replace(/\s+/g, '-')}`,
        ...plan,
      },
    });
  }

  console.log('✅ Investment plans seeded successfully!');
}

async function seedTradeKeys(adminId: string) {
  console.log('🔑 Seeding trade keys...');

  const keys = [
    {
      key: 'TK-DEFAULT-2026',
      userId: adminId,
      isActive: true,
      maxUses: null,
      expiresAt: null,
    },
    {
      key: 'TK-LIMITED-2026',
      userId: adminId,
      isActive: true,
      maxUses: 10,
      expiresAt: null,
    },
    {
      key: 'TK-EXPIRE-2026',
      userId: adminId,
      isActive: true,
      maxUses: null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    },
  ];

  for (const key of keys) {
    await prisma.tradeKey.upsert({
      where: { key: key.key },
      update: {},
      create: key,
    });
  }

  console.log('✅ Trade keys seeded successfully!');
  console.log('   - TK-DEFAULT-2026 (unlimited, never expires)');
  console.log('   - TK-LIMITED-2026 (max 10 uses)');
  console.log('   - TK-EXPIRE-2026 (expires in 30 days)');
}

async function main() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Seed in order
    await seedBanks();
    await seedCurrencies();
    await seedSettings();
    await seedCryptoTokens();
    await seedFAQs();
    await seedInvestmentPlans();
    
    // Admin must be created before trade keys
    const admin = await seedAdmin();
    await seedTradeKeys(admin.id);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📝 Login credentials:');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   Transaction PIN: ${ADMIN_PIN}`);
    console.log('\n🚀 Next steps:');
    console.log('   - Start the development server: npm run dev');
    console.log('   - Login at /login with the admin credentials above');
    console.log('   - Access admin panel at /admin/dashboard');
  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
