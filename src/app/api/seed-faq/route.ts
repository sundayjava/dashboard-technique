import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const faqData = [
  // Account Management
  {
    category: 'Account Management',
    question: 'How do I create an Acredis Finance account?',
    answer: 'To create an account, click on "Create Account" on our homepage. Fill in your personal details, verify your email with the OTP sent to your email address, and set up your secure PIN. You will receive an authorization code upon successful registration.',
    order: 1,
  },
  {
    category: 'Account Management',
    question: 'What is my Authorization Code and where can I find it?',
    answer: 'Your Authorization Code (format: AC-XXXXXXXX) is a unique identifier for your account. You receive it via email after successful registration. You can also find it in your profile section under "My Account".',
    order: 2,
  },
  {
    category: 'Account Management',
    question: 'How do I reset my password?',
    answer: 'Click on "Forgot Password" on the login page. Enter your registered email address, and we will send you a password reset link. Follow the link and create a new password. The reset link is valid for 1 hour.',
    order: 3,
  },
  {
    category: 'Account Management',
    question: 'How do I change my PIN?',
    answer: 'Go to My Account → Change PIN from your dashboard. Enter your current PIN, then create and confirm your new 4-digit PIN. Your PIN will be updated immediately.',
    order: 4,
  },
  {
    category: 'Account Management',
    question: 'What should I do if I forget my PIN?',
    answer: 'Contact our support team through the Message feature in the Support menu. For security reasons, PIN reset requires identity verification and can only be done by our support staff.',
    order: 5,
  },
  {
    category: 'Account Management',
    question: 'How do I update my profile information?',
    answer: 'Navigate to My Account → Profile from your dashboard. You can update your personal details, contact information, and profile picture. Some changes may require verification.',
    order: 6,
  },

  // KYC & Verification
  {
    category: 'KYC & Verification',
    question: 'What is KYC and why is it required?',
    answer: 'KYC (Know Your Customer) is a verification process required by financial regulations. It helps us verify your identity, prevent fraud, and comply with anti-money laundering laws. Complete KYC is required for full access to all banking features.',
    order: 7,
  },
  {
    category: 'KYC & Verification',
    question: 'What documents do I need for KYC verification?',
    answer: 'You will need: (1) A valid government-issued ID (passport, driver\'s license, or national ID card), (2) Proof of address (utility bill, bank statement, or rental agreement not older than 3 months), and (3) A clear selfie photo.',
    order: 8,
  },
  {
    category: 'KYC & Verification',
    question: 'How long does KYC verification take?',
    answer: 'KYC verification typically takes 1-3 business days. You will receive an email notification once your verification is complete. During peak periods, it may take up to 5 business days.',
    order: 9,
  },
  {
    category: 'KYC & Verification',
    question: 'Can I use Acredis services without completing KYC?',
    answer: 'You can access limited features without KYC, but full functionality including transfers, investments, and higher transaction limits requires completed KYC verification.',
    order: 10,
  },

  // Transfers & Transactions
  {
    category: 'Transfers & Transactions',
    question: 'What are the different types of transfers available?',
    answer: 'We offer: (1) Acredis to Acredis - instant transfers between Acredis users, (2) Domestic Transfer - transfers to other banks within your country, (3) International Transfer - global money transfers, and (4) Check Deposit - deposit checks digitally using your phone camera.',
    order: 11,
  },
  {
    category: 'Transfers & Transactions',
    question: 'How long do transfers take?',
    answer: 'Acredis to Acredis transfers are instant. Domestic transfers typically complete within 1-2 business days. International transfers take 3-5 business days depending on the destination country and banking network.',
    order: 12,
  },
  {
    category: 'Transfers & Transactions',
    question: 'What are the transfer limits?',
    answer: 'Limits vary based on your account verification level and type. Unverified accounts have lower limits. Fully verified accounts can transfer up to $50,000 per day for domestic and $25,000 for international transfers. Contact support for higher limits.',
    order: 13,
  },
  {
    category: 'Transfers & Transactions',
    question: 'Are there fees for transfers?',
    answer: 'Acredis to Acredis transfers are free. Domestic transfers have a small fee of $2-5 per transaction. International transfers have a fee of 1-3% of the transfer amount or minimum $10, depending on the destination country.',
    order: 14,
  },
  {
    category: 'Transfers & Transactions',
    question: 'How do I track my transfer history?',
    answer: 'Go to Transfer → History to view all your past transfers. You can filter by date, type, and status. Download transaction receipts or statements from the Statement section under My Account.',
    order: 15,
  },
  {
    category: 'Transfers & Transactions',
    question: 'Can I cancel a transfer?',
    answer: 'You can cancel a pending transfer before it is processed. Go to Transfer → History, find the pending transfer, and click "Cancel". Once processed, transfers cannot be cancelled and you must request a refund from the recipient.',
    order: 16,
  },

  // Investment
  {
    category: 'Investment',
    question: 'What investment options does Acredis offer?',
    answer: 'Acredis offers various investment products including fixed deposits, mutual funds, stocks, bonds, and cryptocurrency portfolios. Each product has different risk levels and potential returns. Visit the Investment section for detailed information.',
    order: 17,
  },
  {
    category: 'Investment',
    question: 'What is the minimum investment amount?',
    answer: 'The minimum investment varies by product. Fixed deposits start at $100, mutual funds at $50, and stocks/crypto at $25. Some premium investment products may have higher minimum requirements.',
    order: 18,
  },
  {
    category: 'Investment',
    question: 'How do I withdraw my investments?',
    answer: 'Navigate to Investment section, select the investment you want to withdraw, and click "Withdraw". Withdrawal times vary: fixed deposits may have lock-in periods, while stocks and crypto can be withdrawn after selling, typically within 1-3 business days.',
    order: 19,
  },
  {
    category: 'Investment',
    question: 'Are my investments insured?',
    answer: 'Fixed deposits are insured up to $250,000 by FDIC. Other investments are subject to market risks and are not insured. We recommend diversifying your portfolio and investing only what you can afford to lose.',
    order: 20,
  },

  // Cards
  {
    category: 'Cards',
    question: 'What types of cards does Acredis offer?',
    answer: 'We offer Debit Cards (physical and virtual), Credit Cards with various reward programs, and Prepaid Cards for specific purposes. All cards support contactless payments and can be managed through your dashboard.',
    order: 21,
  },
  {
    category: 'Cards',
    question: 'How do I request a new card?',
    answer: 'Go to Monetary → Cards and click "Request New Card". Choose your card type, customize it if available, and submit your request. Physical cards are delivered within 7-10 business days. Virtual cards are issued instantly.',
    order: 22,
  },
  {
    category: 'Cards',
    question: 'What should I do if my card is lost or stolen?',
    answer: 'Immediately block your card from Monetary → Cards by selecting the card and clicking "Block Card". Then request a replacement card. You are not liable for unauthorized transactions made after you report the card as lost or stolen.',
    order: 23,
  },
  {
    category: 'Cards',
    question: 'Are there annual fees for cards?',
    answer: 'Debit cards and basic prepaid cards have no annual fees. Credit cards may have annual fees ranging from $0-$95 depending on the card tier and benefits. Check the card details for specific fee information.',
    order: 24,
  },
  {
    category: 'Cards',
    question: 'Can I set spending limits on my cards?',
    answer: 'Yes, you can set daily, weekly, or monthly spending limits for your cards. Go to Monetary → Cards, select your card, and configure spending limits under Card Settings.',
    order: 25,
  },

  // Loans
  {
    category: 'Loans',
    question: 'What types of loans does Acredis offer?',
    answer: 'We offer Personal Loans, Home Loans, Auto Loans, Business Loans, and Education Loans. Loan amounts, interest rates, and terms vary based on your credit score, income, and loan type.',
    order: 26,
  },
  {
    category: 'Loans',
    question: 'How do I apply for a loan?',
    answer: 'Go to Loan → Loan Application, select the loan type, fill in the required information including loan amount, purpose, and income details. Upload necessary documents and submit. You will receive a decision within 2-5 business days.',
    order: 27,
  },
  {
    category: 'Loans',
    question: 'What documents are required for a loan application?',
    answer: 'Required documents typically include: proof of identity, proof of address, proof of income (pay stubs, tax returns), bank statements (3-6 months), and for specific loans, additional documents like property papers or business registration.',
    order: 28,
  },
  {
    category: 'Loans',
    question: 'How can I check my loan status?',
    answer: 'Visit Loan → Loan Status to view your application status, approved loans, payment schedule, and outstanding balance. You can also make early payments or request payment extensions from this section.',
    order: 29,
  },
  {
    category: 'Loans',
    question: 'Can I prepay my loan?',
    answer: 'Yes, you can make partial or full prepayments on most loans. Some loan products may have prepayment charges (typically 2-5% of the outstanding amount). Check your loan agreement or contact support for specific terms.',
    order: 30,
  },

  // Digital Deposit
  {
    category: 'Digital Deposit',
    question: 'What is Digital Deposit?',
    answer: 'Digital Deposit allows you to deposit funds into your Acredis account through various digital methods including bank transfers, mobile money, cryptocurrency, and check deposits using your smartphone camera.',
    order: 31,
  },
  {
    category: 'Digital Deposit',
    question: 'How long does a digital deposit take to reflect in my account?',
    answer: 'Bank transfers typically reflect within 1-2 business days. Mobile money deposits are usually instant. Cryptocurrency deposits require network confirmations (10-60 minutes). Check deposits may take 2-5 business days for verification.',
    order: 32,
  },
  {
    category: 'Digital Deposit',
    question: 'Are there fees for digital deposits?',
    answer: 'Most digital deposits are free. Some methods like international wire transfers or cryptocurrency deposits may have network fees. Check the deposit method details for specific fee information.',
    order: 33,
  },

  // Security
  {
    category: 'Security',
    question: 'How does Acredis protect my account?',
    answer: 'We use bank-level 256-bit encryption, two-factor authentication (2FA), reCAPTCHA protection, secure PIN verification, and continuous fraud monitoring. We never store your password in plain text and all sensitive data is encrypted.',
    order: 34,
  },
  {
    category: 'Security',
    question: 'What is Two-Factor Authentication (2FA)?',
    answer: '2FA adds an extra layer of security by requiring both your password and a verification code sent to your email or phone. We highly recommend enabling 2FA in your account settings for maximum security.',
    order: 35,
  },
  {
    category: 'Security',
    question: 'How do I report suspicious activity?',
    answer: 'If you notice any unauthorized transactions or suspicious activity, immediately change your password, block your cards if necessary, and contact our support team through Support → Message. You can also view all account activities in My Account → Activity Log.',
    order: 36,
  },
  {
    category: 'Security',
    question: 'Will Acredis ever ask for my PIN or password?',
    answer: 'No. Acredis staff will NEVER ask for your PIN, password, or OTP codes via email, phone, or message. These are confidential and should never be shared with anyone. Report any such requests to our security team immediately.',
    order: 37,
  },

  // Fees & Charges
  {
    category: 'Fees & Charges',
    question: 'What are the account maintenance fees?',
    answer: 'Basic accounts have no monthly maintenance fees. Premium accounts may have monthly fees ($5-15) but come with additional benefits like higher interest rates, free international transfers, and dedicated support.',
    order: 38,
  },
  {
    category: 'Fees & Charges',
    question: 'Are there ATM withdrawal fees?',
    answer: 'We offer 5 free ATM withdrawals per month at any ATM worldwide. After that, a fee of $2-3 per withdrawal applies. Using partner ATMs is always free regardless of the number of withdrawals.',
    order: 39,
  },
  {
    category: 'Fees & Charges',
    question: 'How can I avoid fees?',
    answer: 'Maintain minimum balance requirements, use free transfer options (Acredis to Acredis), use partner ATMs, enable e-statements, and make payments on time to avoid late fees. Upgrade to premium accounts for fee waivers on many services.',
    order: 40,
  },

  // Support & Contact
  {
    category: 'Support & Contact',
    question: 'How can I contact Acredis support?',
    answer: 'You can reach us through: (1) Support → Message in your dashboard for secure messaging, (2) Email: support@acredisfinance.com, (3) Phone: 1-800-ACREDIS (24/7), or (4) Live chat on our website (9 AM - 9 PM).',
    order: 41,
  },
  {
    category: 'Support & Contact',
    question: 'What are your support hours?',
    answer: 'Our phone support is available 24/7. Live chat and message support are available 9 AM - 9 PM EST, Monday to Sunday. We respond to emails within 24 hours on business days.',
    order: 42,
  },
  {
    category: 'Support & Contact',
    question: 'How do I close my Acredis account?',
    answer: 'To close your account, ensure all pending transactions are complete and your balance is zero. Contact support through Support → Message with your closure request. Account closure takes 7-10 business days and you will receive a confirmation email.',
    order: 43,
  },
  {
    category: 'Support & Contact',
    question: 'Can I have multiple Acredis accounts?',
    answer: 'Each person is allowed only one primary account. However, you can open additional sub-accounts (savings, business, joint) under your primary account. Contact support to set up additional sub-accounts.',
    order: 44,
  },

  // Mobile App
  {
    category: 'Mobile App',
    question: 'Is there a mobile app for Acredis?',
    answer: 'Yes, the Acredis mobile app is available for iOS and Android. Download it from the App Store or Google Play. All web features are available on the mobile app with additional features like biometric login and instant notifications.',
    order: 45,
  },
  {
    category: 'Mobile App',
    question: 'Is the mobile app secure?',
    answer: 'Yes, the mobile app uses the same security measures as our web platform including encryption, biometric authentication, and secure PIN. You can also remotely log out of devices from your account settings.',
    order: 46,
  },

  // Statements & Reports
  {
    category: 'Statements & Reports',
    question: 'How do I download my account statement?',
    answer: 'Go to My Account → Statement, select the date range, and click "Download". Statements are available in PDF and CSV formats. You can also set up automatic monthly statement delivery via email.',
    order: 47,
  },
  {
    category: 'Statements & Reports',
    question: 'Can I get tax documents from Acredis?',
    answer: 'Yes, tax documents (1099-INT for interest, 1099-DIV for dividends) are available in the Statement section by February 15th each year. You can download and print them for tax filing purposes.',
    order: 48,
  },
];

export async function GET() {
  try {
    // Check if FAQs already exist
    const existingCount = await prisma.fAQ.count();
    
    if (existingCount > 0) {
      return NextResponse.json({
        message: 'FAQs already seeded',
        count: existingCount,
      });
    }

    // Create FAQs
    const result = await prisma.fAQ.createMany({
      data: faqData,
    });

    return NextResponse.json({
      message: 'FAQs seeded successfully',
      count: result.count,
    });
  } catch (error) {
    console.error('Error seeding FAQs:', error);
    return NextResponse.json(
      { error: 'Failed to seed FAQs', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
