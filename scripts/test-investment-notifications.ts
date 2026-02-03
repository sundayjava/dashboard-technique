/**
 * Test script for Investment Maturity Notification System
 * 
 * This script helps you test the investment maturity checking system
 * without waiting for real investments to mature.
 * 
 * Usage:
 * 1. Ensure you have at least one ADMIN user in your database
 * 2. Run: npx tsx scripts/test-investment-notifications.ts
 */

// CRITICAL: Load environment variables BEFORE any other imports
import 'dotenv/config';

import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('🧪 Testing Investment Notification System\n');

  // Check for admin users
  console.log('1️⃣ Checking for admin users...');
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, name: true, email: true },
  });

  if (admins.length === 0) {
    console.log('❌ No admin users found!');
    console.log('   Create an admin user first:');
    console.log('   - Sign up a user');
    console.log('   - Update their role in database: UPDATE users SET role = \'ADMIN\' WHERE email = \'your-email@example.com\'');
    process.exit(1);
  }

  console.log(`✅ Found ${admins.length} admin user(s):`);
  admins.forEach((admin) => {
    console.log(`   - ${admin.name} (${admin.email})`);
  });

  // Check for active investments
  console.log('\n2️⃣ Checking for active investments...');
  const activeInvestments = await prisma.investment.findMany({
    where: { status: 'ACTIVE' },
    include: {
      user: { select: { name: true } },
      plan: { select: { planName: true } },
    },
  });

  console.log(`ℹ️  Found ${activeInvestments.length} active investment(s)`);

  if (activeInvestments.length === 0) {
    console.log('   No active investments to test with.');
  } else {
    activeInvestments.forEach((inv) => {
      const daysUntilMaturity = inv.endDate
        ? Math.ceil((inv.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 'N/A';
      console.log(
        `   - ${inv.user.name}: ${inv.plan.planName} - ${daysUntilMaturity} days until maturity`
      );
    });
  }

  // Check for matured investments
  console.log('\n3️⃣ Checking for matured investments...');
  const maturedInvestments = await prisma.investment.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { lte: new Date() },
    },
    include: {
      user: { select: { name: true, email: true } },
      plan: { select: { planName: true, profitPercentage: true } },
    },
  });

  if (maturedInvestments.length === 0) {
    console.log('✅ No matured investments found (all investments are within their duration)');
    console.log('\n💡 To test notifications, you can:');
    console.log('   A. Create a test investment with a past endDate');
    console.log('   B. Manually update an existing investment\'s endDate to the past');
    console.log('   C. Wait for a real investment to mature');
    console.log('\n   Example SQL to create a test matured investment:');
    console.log(`   UPDATE investments SET "endDate" = NOW() - INTERVAL '1 day' WHERE id = 'your-investment-id' AND status = 'ACTIVE';`);
  } else {
    console.log(`🔔 Found ${maturedInvestments.length} matured investment(s)!`);
    maturedInvestments.forEach((inv) => {
      const expectedProfit = inv.amount * (inv.plan.profitPercentage / 100);
      console.log(`\n   Investment Details:`);
      console.log(`   - ID: ${inv.id}`);
      console.log(`   - Investor: ${inv.user.name} (${inv.user.email})`);
      console.log(`   - Plan: ${inv.plan.planName}`);
      console.log(`   - Amount: $${inv.amount.toLocaleString()}`);
      console.log(`   - Expected Profit: $${expectedProfit.toLocaleString()}`);
      console.log(`   - Maturity Date: ${inv.endDate?.toLocaleString()}`);
      console.log(`   - Cycle: ${inv.currentCycle}/${inv.totalCycles}`);
    });

    console.log('\n🚀 These investments would trigger email notifications to:');
    admins.forEach((admin) => {
      console.log(`   📧 ${admin.name} (${admin.email})`);
    });
  }

  // Check email configuration
  console.log('\n4️⃣ Checking email configuration...');
  const emailConfigured =
    process.env.EMAIL_SERVER_AUTH_USER && process.env.EMAIL_SERVER_AUTH_PASSWORD;

  if (emailConfigured) {
    console.log('✅ Email SMTP is configured');
    console.log(`   Host: ${process.env.EMAIL_SERVER_HOST || 'smtp.gmail.com'}`);
    console.log(`   Port: ${process.env.EMAIL_SERVER_PORT || '587'}`);
    console.log(`   User: ${process.env.EMAIL_SERVER_AUTH_USER}`);
  } else {
    console.log('❌ Email SMTP is NOT configured!');
    console.log('   Please set these environment variables in .env:');
    console.log('   - EMAIL_SERVER_AUTH_USER');
    console.log('   - EMAIL_SERVER_AUTH_PASSWORD');
    console.log('   - EMAIL_SERVER_HOST (optional, defaults to smtp.gmail.com)');
    console.log('   - EMAIL_SERVER_PORT (optional, defaults to 587)');
  }

  // Test API endpoint availability
  console.log('\n5️⃣ API Endpoint Information:');
  console.log('   Endpoint: GET /api/cron/check-investments');
  console.log('   Local URL: http://localhost:3000/api/cron/check-investments');
  console.log(
    `   Production URL: ${process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'}/api/cron/check-investments`
  );

  if (process.env.CRON_SECRET) {
    console.log('   🔒 Authentication: Required');
    console.log('   Header: Authorization: Bearer [CRON_SECRET]');
  } else {
    console.log('   🔓 Authentication: Not configured (consider setting CRON_SECRET)');
  }

  console.log('\n6️⃣ Cron Schedule (vercel.json):');
  console.log('   Schedule: Every 6 hours (0 */6 * * *)');
  console.log('   Runs at: 12:00 AM, 6:00 AM, 12:00 PM, 6:00 PM daily');

  console.log('\n✅ Test Summary:');
  console.log(`   - Admin Users: ${admins.length > 0 ? '✅' : '❌'}`);
  console.log(`   - Active Investments: ${activeInvestments.length}`);
  console.log(`   - Matured Investments: ${maturedInvestments.length}`);
  console.log(`   - Email Configured: ${emailConfigured ? '✅' : '❌'}`);

  console.log('\n📚 Next Steps:');
  if (maturedInvestments.length > 0 && emailConfigured) {
    console.log('   ✅ System is ready! Visit the API endpoint to trigger notifications.');
    console.log('   💡 Visit: http://localhost:3000/api/cron/check-investments');
  } else {
    console.log('   ⏳ Wait for investments to mature, or create a test investment');
    if (!emailConfigured) {
      console.log('   ⚙️  Configure email SMTP settings in .env');
    }
  }

  console.log('\n📖 For more details, see: INVESTMENT_NOTIFICATIONS.md\n');
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
