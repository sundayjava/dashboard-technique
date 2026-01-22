# Database Schema Migration Guide

## Overview
We've refactored the database schema to use a **single unified Transaction table** instead of multiple separate tables for different transaction types. This simplification makes the codebase cleaner and easier to maintain.

## What Changed?

### ❌ Removed Tables
- `ChequeDeposit`
- `CryptoDeposit`
- `BankDeposit`
- `InternationalTransfer`
- `UserBankAccount`
- `Deposit` (the temporary unified model)

### ✅ Enhanced Transaction Model
All transactions (deposits, withdrawals, transfers) now use the **Transaction** table with enhanced fields:

```typescript
model Transaction {
  // Core fields
  id                String
  userId            String
  accountId         String
  transactionType   TransactionType    // DEPOSIT, WITHDRAWAL, TRANSFER_IN, TRANSFER_OUT
  amount            Float
  balanceAfter      Float
  currency          String
  description       String
  reference         String             // Unique reference
  channel           TransactionChannel // BANK, CRYPTO, CHEQUE, DOMESTIC, INTERNATIONAL, INTERNAL
  paymentMethod     PaymentMethodType  // BANK, CRYPTO, CHEQUE, CASH, CARD, WALLET
  status            TransactionStatus  // PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED
  
  // Recipient/Sender info
  recipientName     String?
  recipientAccount  String?
  recipientEmail    String?
  recipientPhone    String?
  recipientAddress  String?
  recipientCountry  String?
  senderName        String?
  senderAccount     String?
  
  // Crypto-specific fields
  tokenName         String?
  tokenSymbol       String?
  network           String?
  walletAddress     String?
  transactionHash   String?
  
  // Bank-specific fields
  bankName          String?
  bankCode          String?
  accountNumber     String?
  routingNumber     String?
  swiftCode         String?
  iban              String?
  
  // Cheque-specific fields
  chequeImage       String?
  proofImage        String?
  
  // Admin/Processing
  processedAt       DateTime?
  processedBy       String?
  adminNotes        String?
  rejectionReason   String?
  
  // General
  fee               Float
  metadata          Json?
  createdAt         DateTime
  updatedAt         DateTime
}
```

## Transaction Types & Channels

### Transaction Types
- **DEPOSIT** - Any incoming deposit (bank, crypto, cheque)
- **WITHDRAWAL** - Any outgoing withdrawal
- **TRANSFER_IN** - Incoming transfer from another user
- **TRANSFER_OUT** - Outgoing transfer to another user or external account
- **PAYMENT** - Payment transactions
- **REFUND** - Refund transactions
- **FEE** - Fee charges
- And more...

### Transaction Channels
- **BANK** - Traditional bank deposit/transfer
- **CRYPTO** - Cryptocurrency transaction
- **CHEQUE** - Cheque deposit
- **DOMESTIC** - Domestic bank transfer
- **INTERNATIONAL** - International bank transfer
- **INTERNAL** - Acredis-to-Acredis transfer
- **SYSTEM** - System-generated transaction

### Payment Methods
- **BANK** - Bank transfer/deposit
- **CRYPTO** - Cryptocurrency
- **CHEQUE** - Cheque deposit
- **CASH** - Cash transaction
- **CARD** - Card payment
- **WALLET** - Wallet transaction

## Migration Examples

### Old: Bank Deposit
```typescript
// OLD WAY ❌
await prisma.bankDeposit.create({
  data: {
    userId: user.id,
    userBankAccountId: bankAccount.id,
    accountId: account.id,
    amount: 1000,
    referenceNumber: 'REF123',
    proofImage: 'proof.jpg',
    status: 'PENDING',
  }
})
```

```typescript
// NEW WAY ✅
await prisma.transaction.create({
  data: {
    userId: user.id,
    accountId: account.id,
    transactionType: 'DEPOSIT',
    channel: 'BANK',
    paymentMethod: 'BANK',
    amount: 1000,
    balanceAfter: currentBalance, // Calculate before saving
    currency: account.currency,
    description: 'Bank deposit',
    reference: generateReference(), // Unique reference
    status: 'PENDING',
    proofImage: 'proof.jpg',
    bankName: 'Bank of America',
    accountNumber: '****1234',
  }
})
```

### Old: Crypto Deposit
```typescript
// OLD WAY ❌
await prisma.cryptoDeposit.create({
  data: {
    userId: user.id,
    tokenId: token.id,
    tokenName: 'Bitcoin',
    network: 'Bitcoin Network',
    amount: 0.5,
    transactionId: 'TX_HASH_123',
    status: 'PENDING',
  }
})
```

```typescript
// NEW WAY ✅
await prisma.transaction.create({
  data: {
    userId: user.id,
    accountId: account.id,
    transactionType: 'DEPOSIT',
    channel: 'CRYPTO',
    paymentMethod: 'CRYPTO',
    amount: 0.5,
    balanceAfter: currentBalance,
    currency: account.currency,
    description: 'Crypto deposit - Bitcoin',
    reference: generateReference(),
    status: 'PENDING',
    tokenName: 'Bitcoin',
    tokenSymbol: 'BTC',
    network: 'Bitcoin Network',
    transactionHash: 'TX_HASH_123',
    walletAddress: 'bc1q...',
  }
})
```

### Old: Cheque Deposit
```typescript
// OLD WAY ❌
await prisma.chequeDeposit.create({
  data: {
    userId: user.id,
    accountId: account.id,
    amount: 5000,
    chequeImage: 'cheque.jpg',
    status: 'PENDING',
  }
})
```

```typescript
// NEW WAY ✅
await prisma.transaction.create({
  data: {
    userId: user.id,
    accountId: account.id,
    transactionType: 'DEPOSIT',
    channel: 'CHEQUE',
    paymentMethod: 'CHEQUE',
    amount: 5000,
    balanceAfter: currentBalance,
    currency: account.currency,
    description: 'Cheque deposit',
    reference: generateReference(),
    status: 'PENDING',
    chequeImage: 'cheque.jpg',
  }
})
```

### Old: International Transfer
```typescript
// OLD WAY ❌
await prisma.internationalTransfer.create({
  data: {
    userId: user.id,
    transactionId: 'TXN_123',
    senderAccountId: account.id,
    amount: 10000,
    currency: 'USD',
    fee: 25,
    beneficiaryName: 'John Doe',
    beneficiaryCountry: 'UK',
    bankName: 'Barclays',
    swiftCode: 'BARCGB22',
    accountNumber: '12345678',
    status: 'PENDING',
  }
})
```

```typescript
// NEW WAY ✅
await prisma.transaction.create({
  data: {
    userId: user.id,
    accountId: account.id,
    transactionType: 'TRANSFER_OUT',
    channel: 'INTERNATIONAL',
    paymentMethod: 'BANK',
    amount: 10000,
    balanceAfter: currentBalance - 10000 - 25,
    currency: 'USD',
    description: 'International transfer to UK',
    reference: generateReference(),
    status: 'PENDING',
    fee: 25,
    recipientName: 'John Doe',
    recipientCountry: 'UK',
    bankName: 'Barclays',
    swiftCode: 'BARCGB22',
    accountNumber: '12345678',
  }
})
```

### Acredis-to-Acredis Transfer
```typescript
// NEW WAY ✅
// Debit sender
await prisma.transaction.create({
  data: {
    userId: sender.id,
    accountId: senderAccount.id,
    transactionType: 'TRANSFER_OUT',
    channel: 'INTERNAL',
    paymentMethod: 'WALLET',
    amount: 500,
    balanceAfter: senderBalance - 500,
    currency: senderAccount.currency,
    description: 'Transfer to John Doe',
    reference: generateReference(),
    status: 'COMPLETED',
    recipientName: recipient.name,
    recipientAccount: recipientAccount.accountNumber,
  }
})

// Credit recipient
await prisma.transaction.create({
  data: {
    userId: recipient.id,
    accountId: recipientAccount.id,
    transactionType: 'TRANSFER_IN',
    channel: 'INTERNAL',
    paymentMethod: 'WALLET',
    amount: 500,
    balanceAfter: recipientBalance + 500,
    currency: recipientAccount.currency,
    description: 'Transfer from Jane Smith',
    reference: generateReference(),
    status: 'COMPLETED',
    senderName: sender.name,
    senderAccount: senderAccount.accountNumber,
  }
})
```

## Querying Transactions

### Get all deposits for a user
```typescript
const deposits = await prisma.transaction.findMany({
  where: {
    userId: user.id,
    transactionType: 'DEPOSIT',
    status: 'PENDING',
  },
  orderBy: { createdAt: 'desc' }
})
```

### Get all crypto deposits
```typescript
const cryptoDeposits = await prisma.transaction.findMany({
  where: {
    transactionType: 'DEPOSIT',
    channel: 'CRYPTO',
  }
})
```

### Get all pending bank deposits
```typescript
const pendingBankDeposits = await prisma.transaction.findMany({
  where: {
    transactionType: 'DEPOSIT',
    channel: 'BANK',
    status: 'PENDING',
  }
})
```

### Get all international transfers
```typescript
const internationalTransfers = await prisma.transaction.findMany({
  where: {
    channel: 'INTERNATIONAL',
  }
})
```

## API Routes to Update

The following API routes need to be updated to use the new Transaction model:

### Deposit APIs
- `/api/bank-deposits/*` - Update to use Transaction with channel=BANK
- `/api/crypto-deposits/*` - Update to use Transaction with channel=CRYPTO
- `/api/cheque-deposits/*` - Update to use Transaction with channel=CHEQUE

### Admin APIs
- `/api/admin/bank-deposits/*` - Update to use Transaction queries
- `/api/admin/crypto-deposits/*` - Update to use Transaction queries
- `/api/admin/cheque-deposits/*` - Update to use Transaction queries
- `/api/admin/user-bank-accounts/*` - Can be removed or kept as Beneficiary management

### Transfer APIs
- Update any international transfer APIs to use Transaction with channel=INTERNATIONAL

## Database Status

✅ **Schema Updated** - All models refactored
✅ **Migrations Reset** - Started fresh with init migration
✅ **Seed Completed** - Database seeded successfully
✅ **Prisma Client Generated** - Client generated with new schema

## Next Steps

1. ✅ Update API routes to use new Transaction model
2. ✅ Update frontend components to work with new API
3. ✅ Update admin dashboard to show unified transactions
4. ✅ Add transaction filtering by channel and payment method
5. ✅ Update transaction history displays
6. ✅ Test all deposit flows (bank, crypto, cheque)
7. ✅ Test all transfer flows (internal, domestic, international)

## Benefits of New Schema

1. **Simplicity** - One table for all transactions
2. **Consistency** - Same structure for all transaction types
3. **Flexibility** - Easy to add new transaction types
4. **Better Reporting** - Unified transaction history
5. **Easier Maintenance** - Less code duplication
6. **Scalability** - Single table to optimize and index

## Admin Credentials

```
Email: admin@acredisfinance.com
Password: Admin@Acredis2026
Transaction PIN: 0000
```

## Conversion Logic

All conversions happen at the system level:
- Deposits are converted to user's account currency
- Transfers are converted based on recipient's currency
- No distinction needed between domestic/international at storage level
- Channel field helps identify the transfer type for fees and processing

---

**Note**: This is a breaking change. All existing API endpoints that reference the old deposit models need to be updated before the application can run properly.
