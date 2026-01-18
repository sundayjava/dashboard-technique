# 📊 Account Statement System Documentation

## Overview

The Account Statement System is a comprehensive financial transaction management and reporting feature for Acredis Finance. It provides users with detailed transaction history, filtering capabilities, and export options for their financial records.

## Features

### ✅ Implemented Features

1. **Account Management**
   - Multiple accounts per user (Primary, Savings, Business, etc.)
   - Unique 10-digit account numbers
   - Balance tracking (total balance and available balance)
   - Account status management (Active, Inactive, Suspended, Closed)
   - Multi-currency support

2. **Transaction Tracking**
   - Comprehensive transaction types:
     - DEPOSIT - Money added to account
     - WITHDRAWAL - Money removed from account
     - TRANSFER_IN - Incoming transfers
     - TRANSFER_OUT - Outgoing transfers
     - PAYMENT - Bill payments and purchases
     - REFUND - Returned payments
     - FEE - Service charges
     - INTEREST - Interest earned
     - LOAN_DISBURSEMENT - Loan funds received
     - LOAN_REPAYMENT - Loan payments made
     - CARD_PAYMENT - Card transactions
     - CARD_REFUND - Card refunds
     - CRYPTO_DEPOSIT - Cryptocurrency deposits
     - CRYPTO_WITHDRAWAL - Cryptocurrency withdrawals
     - INVESTMENT - Investment transactions
     - DIVIDEND - Dividend payments
     - BONUS - Bonus credits
     - CHARGE - Account charges
     - REVERSAL - Transaction reversals
   - Transaction status tracking:
     - PENDING - Awaiting processing
     - PROCESSING - Currently being processed
     - COMPLETED - Successfully completed
     - FAILED - Transaction failed
     - CANCELLED - Transaction cancelled
     - REVERSED - Transaction reversed
   - Balance after each transaction
   - Transaction fees tracking
   - Recipient/sender information
   - Unique reference numbers
   - Metadata support for additional details

3. **Statement Filtering**
   - Filter by account (select from user's accounts)
   - Date range filtering (start date and end date)
   - Transaction type filtering
   - Transaction status filtering
   - Real-time filter updates

4. **Summary Statistics**
   - Total number of transactions
   - Total deposits amount
   - Total withdrawals amount
   - Total fees charged
   - Currency-aware formatting

5. **Export & Print**
   - CSV export functionality
   - Print-friendly statement view
   - Downloadable transaction history
   - Professional formatting

6. **User Interface**
   - Clean, modern design with #c1ff72 brand color
   - Responsive layout (mobile, tablet, desktop)
   - Transaction table with sortable columns
   - Status badges with color coding
   - Amount display with +/- indicators
   - Loading states
   - Error handling
   - Empty states

## Database Schema

### Account Model
\`\`\`prisma
model Account {
  id              String        @id @default(cuid())
  userId          String
  accountNumber   String        @unique
  accountName     String
  accountType     AccountType   @default(PERSONAL)
  currency        String        @default("USD")
  balance         Float         @default(0)
  availableBalance Float        @default(0)
  status          AccountStatus @default(ACTIVE)
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions    Transaction[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}
\`\`\`

### Transaction Model
\`\`\`prisma
model Transaction {
  id                String            @id @default(cuid())
  userId            String
  accountId         String
  transactionType   TransactionType
  amount            Float
  balanceAfter      Float
  currency          String
  description       String
  reference         String            @unique
  status            TransactionStatus @default(COMPLETED)
  recipientName     String?
  recipientAccount  String?
  senderName        String?
  senderAccount     String?
  fee               Float             @default(0)
  metadata          Json?
  user              User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  account           Account           @relation(fields: [accountId], references: [id], onDelete: Cascade)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
}
\`\`\`

## API Endpoints

### 1. GET /api/accounts
Fetch all accounts for a user.

**Query Parameters:**
- `userId` (required): User ID

**Response:**
\`\`\`json
{
  "accounts": [
    {
      "id": "clx...",
      "accountNumber": "1234567890",
      "accountName": "Primary Account",
      "accountType": "PERSONAL",
      "currency": "USD",
      "balance": 15000,
      "availableBalance": 15000,
      "status": "ACTIVE",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-17T12:00:00.000Z"
    }
  ]
}
\`\`\`

### 2. POST /api/accounts
Create a new account.

**Request Body:**
\`\`\`json
{
  "userId": "clx...",
  "accountName": "Savings Account",
  "accountType": "PERSONAL",
  "currency": "USD"
}
\`\`\`

**Response:**
\`\`\`json
{
  "account": {
    "id": "clx...",
    "accountNumber": "9876543210",
    "accountName": "Savings Account",
    "accountType": "PERSONAL",
    "currency": "USD",
    "balance": 0,
    "availableBalance": 0,
    "status": "ACTIVE"
  }
}
\`\`\`

### 3. GET /api/statements
Fetch transaction statement with filters.

**Query Parameters:**
- `userId` (required): User ID
- `accountId` (optional): Filter by specific account
- `startDate` (optional): Start date for date range filter (ISO 8601)
- `endDate` (optional): End date for date range filter (ISO 8601)
- `type` (optional): Transaction type filter
- `status` (optional): Transaction status filter

**Response:**
\`\`\`json
{
  "transactions": [
    {
      "id": "clx...",
      "transactionType": "DEPOSIT",
      "amount": 5000,
      "balanceAfter": 15000,
      "currency": "USD",
      "description": "Salary payment",
      "reference": "TXN1234567890",
      "status": "COMPLETED",
      "senderName": "Employer Inc",
      "fee": 0,
      "createdAt": "2024-01-17T12:00:00.000Z",
      "account": {
        "accountNumber": "1234567890",
        "accountName": "Primary Account",
        "currency": "USD"
      }
    }
  ],
  "summary": {
    "totalTransactions": 25,
    "totalDeposits": 15000,
    "totalWithdrawals": 5000,
    "totalFees": 50
  },
  "accountSummary": {
    "id": "clx...",
    "accountNumber": "1234567890",
    "accountName": "Primary Account",
    "currency": "USD",
    "balance": 15000,
    "availableBalance": 15000,
    "status": "ACTIVE"
  }
}
\`\`\`

### 4. POST /api/seed-statement
Seed sample account and transaction data for testing.

**Query Parameters:**
- `userId` (required): User ID

**Response:**
\`\`\`json
{
  "message": "Sample data created successfully",
  "accounts": [...],
  "transactionsCreated": 19
}
\`\`\`

## Usage Guide

### For Users

1. **Access Statement**
   - Navigate to Dashboard → My Account → Statement
   - Or visit `/dashboard/account/statement`

2. **View Transactions**
   - All transactions are displayed in reverse chronological order (newest first)
   - See transaction date, description, type, amount, balance, and status

3. **Filter Transactions**
   - **By Account**: Select from dropdown to view specific account
   - **By Date**: Set start and/or end date for date range
   - **By Type**: Filter by transaction type (Deposit, Withdrawal, etc.)
   - **By Status**: Filter by status (Completed, Pending, etc.)
   - Filters apply automatically

4. **View Summary**
   - Total transaction count
   - Total deposits (in green)
   - Total withdrawals (in red)
   - Total fees charged

5. **Export Data**
   - **CSV Export**: Click "Export CSV" to download transaction data
   - **Print**: Click "Print" to generate printer-friendly version

### For Developers

1. **Setup Database**
\`\`\`bash
# Push schema to database
npx prisma db push

# Generate Prisma client
npx prisma generate
\`\`\`

2. **Seed Test Data**
\`\`\`bash
# Get your userId from localStorage after login
# Then call the seed endpoint
curl -X POST "http://localhost:3000/api/seed-statement?userId=YOUR_USER_ID"
\`\`\`

3. **Create Custom Transactions**
\`\`\`typescript
import { prisma } from '@/lib/prisma';

await prisma.transaction.create({
  data: {
    userId: 'user_id',
    accountId: 'account_id',
    transactionType: 'DEPOSIT',
    amount: 1000,
    balanceAfter: 6000,
    currency: 'USD',
    description: 'Monthly salary',
    reference: \`TXN\${Date.now()}\`,
    status: 'COMPLETED',
    senderName: 'Employer',
    fee: 0,
  },
});
\`\`\`

4. **Fetch Statements Programmatically**
\`\`\`typescript
import axios from 'axios';

const response = await axios.get('/api/statements', {
  params: {
    userId: 'user_id',
    accountId: 'account_id',
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    type: 'DEPOSIT',
    status: 'COMPLETED',
  },
});
\`\`\`

## File Structure

\`\`\`
src/
├── app/
│   ├── api/
│   │   ├── accounts/
│   │   │   └── route.ts           # Account CRUD operations
│   │   ├── statements/
│   │   │   └── route.ts           # Statement fetching with filters
│   │   └── seed-statement/
│   │       └── route.ts           # Sample data seeding
│   └── dashboard/
│       └── account/
│           └── statement/
│               └── page.tsx       # Statement UI page
├── config/
│   └── sidebar.config.tsx         # Sidebar navigation (includes Statement link)
└── prisma/
    └── schema.prisma              # Database schema with Account & Transaction models
\`\`\`

## Design Patterns

### Color Coding
- **Green (#10b981)**: Income transactions (Deposit, Transfer In, Refund, Interest, etc.)
- **Red (#ef4444)**: Expense transactions (Withdrawal, Transfer Out, Payment, etc.)
- **Brand (#c1ff72)**: Primary actions (buttons, highlights)
- **Status Badges**:
  - Green: Completed
  - Yellow: Pending
  - Blue: Processing
  - Red: Failed
  - Gray: Cancelled
  - Orange: Reversed

### Currency Formatting
- Uses `Intl.NumberFormat` for locale-aware formatting
- Supports multiple currencies (USD, EUR, GBP, etc.)
- Displays appropriate currency symbols

### Date Formatting
- Full format: "Jan 17, 2024, 12:00 PM"
- Locale-aware using `toLocaleDateString`

## Security Considerations

1. **Authorization**
   - Users can only access their own accounts and transactions
   - API endpoints should verify `userId` matches authenticated user
   - Account and transaction data filtered by user

2. **Data Validation**
   - All inputs validated on both client and server
   - Required fields enforced
   - Type checking with TypeScript

3. **SQL Injection Protection**
   - Prisma ORM prevents SQL injection
   - Parameterized queries used throughout

## Testing Checklist

- [ ] Create account successfully
- [ ] View all user accounts
- [ ] Filter transactions by account
- [ ] Filter transactions by date range
- [ ] Filter transactions by type
- [ ] Filter transactions by status
- [ ] View transaction details
- [ ] Export statement to CSV
- [ ] Print statement
- [ ] View summary statistics
- [ ] Responsive design on mobile
- [ ] Responsive design on tablet
- [ ] Responsive design on desktop
- [ ] Handle empty states
- [ ] Handle loading states
- [ ] Handle error states
- [ ] Seed sample data works
- [ ] Currency formatting correct
- [ ] Date formatting correct
- [ ] Status badges display correctly
- [ ] Amount signs (+/-) display correctly

## Future Enhancements

1. **PDF Export**
   - Generate professional PDF statements
   - Include company branding
   - Digital signatures
   - Email delivery

2. **Advanced Filtering**
   - Amount range filtering
   - Description/reference search
   - Multiple transaction type selection
   - Saved filter presets

3. **Data Visualization**
   - Transaction charts (line, bar, pie)
   - Spending categories
   - Monthly/yearly comparisons
   - Trend analysis

4. **Scheduled Statements**
   - Monthly automatic statement generation
   - Email delivery
   - Downloadable from dashboard

5. **Transaction Receipts**
   - Individual transaction receipts
   - QR codes for verification
   - Share functionality

6. **Bulk Operations**
   - Bulk export
   - Bulk categorization
   - Bulk status updates (for admins)

## Troubleshooting

### No transactions showing
- Check if user has any accounts created
- Verify filters aren't too restrictive
- Check date range includes transaction dates
- Seed sample data using `/api/seed-statement`

### Filters not working
- Clear browser cache
- Check console for errors
- Verify API responses in Network tab
- Ensure date format is ISO 8601

### Export not working
- Check browser allows downloads
- Verify transactions exist
- Check browser console for errors

### Balance mismatch
- Transactions should update `balanceAfter` field
- Ensure transactions ordered chronologically
- Verify account balance calculation logic

## Support

For issues or questions:
1. Check this documentation
2. Review API endpoint responses
3. Check browser console for errors
4. Contact support team

---

**Version**: 1.0.0  
**Last Updated**: January 17, 2026  
**Author**: Acredis Finance Development Team
