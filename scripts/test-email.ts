/**
 * Email Configuration Test Script
 * 
 * This script tests your email configuration and attempts to send a test email.
 * 
 * Usage: 
 *   npx ts-node scripts/test-email.ts your-email@example.com
 */

import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testEmailConfiguration(recipientEmail: string) {
  console.log('\n🔍 Checking Email Configuration...\n');
  
  // Check environment variables
  const requiredVars = {
    EMAIL_SERVER_HOST: process.env.EMAIL_SERVER_HOST,
    EMAIL_SERVER_PORT: process.env.EMAIL_SERVER_PORT,
    EMAIL_SERVER_AUTH_USER: process.env.EMAIL_SERVER_AUTH_USER,
    EMAIL_SERVER_AUTH_PASSWORD: process.env.EMAIL_SERVER_AUTH_PASSWORD,
  };

  console.log('Environment Variables Status:');
  console.log('═══════════════════════════════════════');
  
  let hasAllVars = true;
  for (const [key, value] of Object.entries(requiredVars)) {
    const status = value ? '✅ SET' : '❌ NOT SET';
    console.log(`${key}: ${status}`);
    if (key === 'EMAIL_SERVER_AUTH_PASSWORD' && value) {
      console.log(`  → Value: ${'*'.repeat(value.length)} (hidden)`);
    } else if (value) {
      console.log(`  → Value: ${value}`);
    }
    if (!value) hasAllVars = false;
  }
  
  console.log('═══════════════════════════════════════\n');

  if (!hasAllVars) {
    console.error('❌ Missing required environment variables!');
    console.error('\nPlease set the following in your .env.local or .env file:');
    console.error(`
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_AUTH_USER=your-email@gmail.com
EMAIL_SERVER_AUTH_PASSWORD=your-app-password

For Gmail:
1. Enable 2-factor authentication
2. Generate an "App Password" at https://myaccount.google.com/apppasswords
3. Use the app password (not your regular password)
    `);
    process.exit(1);
  }

  // Create transporter
  console.log('📧 Creating email transporter...\n');
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: parseInt(process.env.EMAIL_SERVER_PORT || '587'),
    secure: process.env.EMAIL_SERVER_PORT === '465',
    auth: {
      user: process.env.EMAIL_SERVER_AUTH_USER,
      pass: process.env.EMAIL_SERVER_AUTH_PASSWORD,
    },
  });

  // Verify connection
  try {
    console.log('🔌 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');
  } catch (error: any) {
    console.error('❌ SMTP connection failed:', error.message);
    console.error('\nCommon issues:');
    console.error('- Wrong username/password');
    console.error('- Gmail: Need to use App Password (not regular password)');
    console.error('- Firewall blocking SMTP port');
    console.error('- Wrong host or port\n');
    process.exit(1);
  }

  // Send test email
  try {
    console.log(`📬 Sending test email to ${recipientEmail}...`);
    const info = await transporter.sendMail({
      from: `"Acredis Finance Test" <${process.env.EMAIL_FROM || process.env.EMAIL_SERVER_AUTH_USER}>`,
      to: recipientEmail,
      subject: 'Test Email - OTP System Check',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e3a8a;">Email Configuration Test</h2>
          <p>Congratulations! Your email configuration is working correctly.</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #059669; margin: 0;">✅ Test Successful</h3>
          </div>
          <p>Your OTP emails should now be delivered successfully.</p>
          <p style="color: #6b7280; font-size: 12px;">
            This is a test email sent at ${new Date().toISOString()}
          </p>
        </div>
      `,
    });

    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}\n`);
    console.log('🎉 Email configuration is working correctly!');
    console.log(`   Check your inbox at ${recipientEmail}\n`);
  } catch (error: any) {
    console.error('❌ Failed to send test email:', error.message);
    process.exit(1);
  }
}

// Get recipient email from command line
const recipientEmail = process.argv[2];

if (!recipientEmail) {
  console.error('❌ Please provide a recipient email address');
  console.error('Usage: npx ts-node scripts/test-email.ts your-email@example.com');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(recipientEmail)) {
  console.error('❌ Invalid email address format');
  process.exit(1);
}

// Run the test
testEmailConfiguration(recipientEmail).catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
