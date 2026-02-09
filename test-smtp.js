const nodemailer = require('nodemailer');

// Test SMTP connection
async function testSMTP() {
  console.log('🔍 Testing SMTP Connection...\n');
  
  const config = {
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
      user: 'resend',
      pass: 're_B4SEEq6s_EDN2ZJCYcmHPjVavPacwGwMk'
    },
    debug: true, // Enable debug output
    logger: true // Log to console
  };

  console.log('📋 Configuration:');
  console.log('Host:', config.host);
  console.log('Port:', config.port);
  console.log('Secure:', config.secure);
  console.log('User:', config.auth.user);
  console.log('Password:', config.auth.pass.replace(/./g, '*'));
  console.log('\n');

  const transporter = nodemailer.createTransport(config);

  try {
    // Verify connection
    console.log('🔐 Verifying connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!\n');

    // Try to send a test email
    console.log('📧 Sending test email...');
    const info = await transporter.sendMail({
      from: '"Acredis Finance" <support@acredisfinance.com>',
      to: 'cionde411@gmail.com',
      subject: 'Test Email from Acredis Finance',
      text: 'This is a test email sent from your verified domain!',
      html: '<p>This is a test email sent from <strong>your verified domain</strong>! 🎉</p>'
    });

    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
  } catch (error) {
    console.error('❌ SMTP Error:', error.message);
    console.error('Full error:', error);
  }
}

testSMTP();
