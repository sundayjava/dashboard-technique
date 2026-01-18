import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TransactionType, TransactionStatus } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Create main account
    const mainAccount = await prisma.account.create({
      data: {
        userId,
        accountNumber: `${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        accountName: 'Primary Account',
        accountType: 'PERSONAL',
        currency: 'USD',
        balance: 15000,
        availableBalance: 15000,
        status: 'ACTIVE',
      },
    });

    // Create savings account
    const savingsAccount = await prisma.account.create({
      data: {
        userId,
        accountNumber: `${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        accountName: 'Savings Account',
        accountType: 'PERSONAL',
        currency: 'USD',
        balance: 8500,
        availableBalance: 8500,
        status: 'ACTIVE',
      },
    });

    // Sample transaction types
    const transactionData: Array<{
      userId: string;
      accountId: string;
      transactionType: TransactionType;
      amount: number;
      balanceAfter: number;
      currency: string;
      description: string;
      reference: string;
      status: TransactionStatus;
      fee: number;
      createdAt: Date;
      senderName?: string;
      recipientName?: string;
      recipientAccount?: string;
      senderAccount?: string;
    }> = [
      // Main Account transactions
      {
        userId,
        accountId: mainAccount.id,
        transactionType: 'DEPOSIT',
        amount: 5000,
        balanceAfter: 5000,
        currency: 'USD',
        description: 'Initial deposit',
        reference: `TXN${Date.now()}001`,
        status: 'COMPLETED',
        fee: 0,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      },
      {
        userId,
        accountId: mainAccount.id,
        transactionType: 'DEPOSIT',
        amount: 3000,
        balanceAfter: 8000,
        currency: 'USD',
        description: 'Salary payment',
        reference: `TXN${Date.now()}002`,
        status: 'COMPLETED',
        senderName: 'Employer Inc',
        fee: 0,
        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      },
      {
        userId,
        accountId: mainAccount.id,
        transactionType: 'WITHDRAWAL',
        amount: 500,
        balanceAfter: 7500,
        currency: 'USD',
        description: 'ATM withdrawal',
        reference: `TXN${Date.now()}003`,
        status: 'COMPLETED',
        fee: 2.5,
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      },
      {
        userId,
        accountId: mainAccount.id,
        transactionType: 'PAYMENT',
        amount: 150,
        balanceAfter: 7350,
        currency: 'USD',
        description: 'Online shopping',
        reference: `TXN${Date.now()}004`,
        status: 'COMPLETED',
        recipientName: 'Amazon Store',
        fee: 0,
        createdAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
      },
      {
        userId,
        accountId: mainAccount.id,
        transactionType: 'TRANSFER_OUT',
        amount: 1000,
        balanceAfter: 6350,
        currency: 'USD',
        description: 'Transfer to savings',
        reference: `TXN${Date.now()}005`,
        status: 'COMPLETED',
        recipientName: 'Savings Account',
        recipientAccount: savingsAccount.accountNumber,
        fee: 0,
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      },
      {
        userId,
        accountId: mainAccount.id,
        transactionType: 'PAYMENT',
        amount: 85,
        balanceAfter: 6265,
        currency: 'USD',
        description: 'Utility bill payment',
        reference: `TXN${Date.now()}006`,
        status: 'COMPLETED',
        recipientName: 'Electric Company',
        fee: 0,
        createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      },
      {
        userId,
        accountId: mainAccount.id,
        transactionType: 'DEPOSIT',
        amount: 5000,
        balanceAfter: 11265,
        currency: 'USD',
        description: 'Salary payment',
        reference: `TXN${Date.now()}007`,
        status: 'COMPLETED',
        senderName: 'Employer Inc',
        fee: 0,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        userId,
        accountId: mainAccount.id,
        transactionType: 'PAYMENT',
        amount: 200,
        balanceAfter: 11065,
        currency: 'USD',
        description: 'Restaurant',
        reference: `TXN${Date.now()}008`,
        status: 'COMPLETED',
        recipientName: 'Fine Dining Restaurant',
        fee: 0,
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      },
      {
        userId,
        accountId: mainAccount.id,
        transactionType: 'REFUND',
        amount: 50,
        balanceAfter: 11115,
        currency: 'USD',
        description: 'Purchase refund',
        reference: `TXN${Date.now()}009`,
        status: 'COMPLETED',
        senderName: 'Online Store',
        fee: 0,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        userId,
        accountId: mainAccount.id,
        transactionType: 'INTEREST',
        amount: 35,
        balanceAfter: 11150,
        currency: 'USD',
        description: 'Monthly interest',
        reference: `TXN${Date.now()}010`,
        status: 'COMPLETED',
        fee: 0,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        userId,
        accountId: mainAccount.id,
        transactionType: 'TRANSFER_IN',
        amount: 2000,
        balanceAfter: 13150,
        currency: 'USD',
        description: 'Transfer from friend',
        reference: `TXN${Date.now()}011`,
        status: 'COMPLETED',
        senderName: 'John Doe',
        senderAccount: '9876543210',
        fee: 0,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        userId,
        accountId: mainAccount.id,
        transactionType: 'PAYMENT',
        amount: 350,
        balanceAfter: 12800,
        currency: 'USD',
        description: 'Subscription renewal',
        reference: `TXN${Date.now()}012`,
        status: 'COMPLETED',
        recipientName: 'Streaming Service',
        fee: 0,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        userId,
        accountId: mainAccount.id,
        transactionType: 'DEPOSIT',
        amount: 2200,
        balanceAfter: 15000,
        currency: 'USD',
        description: 'Freelance payment',
        reference: `TXN${Date.now()}013`,
        status: 'COMPLETED',
        senderName: 'Client Co',
        fee: 0,
        createdAt: new Date(),
      },

      // Savings Account transactions
      {
        userId,
        accountId: savingsAccount.id,
        transactionType: 'DEPOSIT',
        amount: 5000,
        balanceAfter: 5000,
        currency: 'USD',
        description: 'Initial savings deposit',
        reference: `TXN${Date.now()}014`,
        status: 'COMPLETED',
        fee: 0,
        createdAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
      },
      {
        userId,
        accountId: savingsAccount.id,
        transactionType: 'TRANSFER_IN',
        amount: 1000,
        balanceAfter: 6000,
        currency: 'USD',
        description: 'Transfer from primary',
        reference: `TXN${Date.now()}015`,
        status: 'COMPLETED',
        senderName: 'Primary Account',
        senderAccount: mainAccount.accountNumber,
        fee: 0,
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      },
      {
        userId,
        accountId: savingsAccount.id,
        transactionType: 'INTEREST',
        amount: 25,
        balanceAfter: 6025,
        currency: 'USD',
        description: 'Savings interest',
        reference: `TXN${Date.now()}016`,
        status: 'COMPLETED',
        fee: 0,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        userId,
        accountId: savingsAccount.id,
        transactionType: 'DEPOSIT',
        amount: 2500,
        balanceAfter: 8525,
        currency: 'USD',
        description: 'Monthly savings',
        reference: `TXN${Date.now()}017`,
        status: 'COMPLETED',
        fee: 0,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        userId,
        accountId: savingsAccount.id,
        transactionType: 'WITHDRAWAL',
        amount: 50,
        balanceAfter: 8475,
        currency: 'USD',
        description: 'Emergency withdrawal',
        reference: `TXN${Date.now()}018`,
        status: 'COMPLETED',
        fee: 1,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        userId,
        accountId: savingsAccount.id,
        transactionType: 'INTEREST',
        amount: 25,
        balanceAfter: 8500,
        currency: 'USD',
        description: 'Monthly interest',
        reference: `TXN${Date.now()}019`,
        status: 'COMPLETED',
        fee: 0,
        createdAt: new Date(),
      },
    ];

    // Create all transactions
    await prisma.transaction.createMany({
      data: transactionData,
    });

    return NextResponse.json({
      message: 'Sample data created successfully',
      accounts: [mainAccount, savingsAccount],
      transactionsCreated: transactionData.length,
    });
  } catch (error) {
    console.error('Error seeding data:', error);
    return NextResponse.json(
      { error: 'Failed to seed data' },
      { status: 500 }
    );
  }
}
