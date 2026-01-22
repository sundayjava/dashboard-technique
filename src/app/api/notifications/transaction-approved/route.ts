import { NextRequest, NextResponse } from 'next/server';
import { sendTransactionApprovalEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userEmail, userName, transactionType, amount, currency, reference } = body;

    // Validate required fields
    if (!userEmail || !userName || !transactionType || amount === undefined || !currency || !reference) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Send the email
    await sendTransactionApprovalEmail(
      userEmail,
      userName,
      transactionType,
      amount,
      currency,
      reference
    );

    return NextResponse.json({ 
      success: true,
      message: 'Transaction approval email sent successfully' 
    });
  } catch (error) {
    console.error('Error sending transaction approval email:', error);
    return NextResponse.json(
      { error: 'Failed to send email notification' },
      { status: 500 }
    );
  }
}
