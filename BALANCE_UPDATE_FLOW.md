# Balance Update Flow Documentation

## Overview
The system ensures that user balances are updated automatically when deposits are approved or when transfers occur. The balance is stored in the `Account` table and displayed in the user dashboard.

## Balance Update Scenarios

### 1. Bank Deposit Approval
**Flow:**
1. User submits bank deposit via `/api/bank-deposits` (creates Transaction with status=PENDING, channel=BANK)
2. Admin reviews deposit in admin panel
3. Admin approves via `/api/admin/bank-deposits/approve`
4. System performs atomic transaction:
   - Updates Account: `balance += depositAmount` and `availableBalance += depositAmount`
   - Updates Transaction: `status = COMPLETED`, `balanceAfter = newBalance`, `processedAt = now()`
   - Creates notification for user
   - Creates activity logs for user and admin
5. User's dashboard refreshes and shows updated balance

**Code Reference:** [/api/admin/bank-deposits/approve/route.ts](src/app/api/admin/bank-deposits/approve/route.ts#L47-L51)

### 2. Crypto Deposit Approval
**Flow:**
1. User submits crypto deposit via `/api/crypto-deposits` (creates Transaction with status=PENDING, channel=CRYPTO)
2. Admin reviews deposit with transaction hash and wallet details
3. Admin approves via `/api/admin/crypto-deposits/approve`
4. System performs atomic transaction:
   - Updates Account: `balance += depositAmount` and `availableBalance += depositAmount`
   - Updates Transaction: `status = COMPLETED`, `balanceAfter = newBalance`, `processedAt = now()`
   - Creates notification for user
   - Creates activity logs
5. User's dashboard shows updated balance

**Code Reference:** [/api/admin/crypto-deposits/approve/route.ts](src/app/api/admin/crypto-deposits/approve/route.ts#L49-L53)

### 3. Cheque Deposit Approval
**Flow:**
1. User uploads cheque image via `/api/cheque-deposits` (creates Transaction with status=PENDING, channel=CHEQUE)
2. Admin verifies cheque image and details
3. Admin approves via `/api/admin/cheque-deposits/approve`
4. System performs atomic transaction:
   - Updates Account: `balance += depositAmount` and `availableBalance += depositAmount`
   - Updates Transaction: `status = COMPLETED`, `balanceAfter = newBalance`
   - Creates notification and activity logs
5. User sees updated balance in dashboard

**Code Reference:** [/api/admin/cheque-deposits/approve/route.ts](src/app/api/admin/cheque-deposits/approve/route.ts#L47-L51)

### 4. Acredis-to-Acredis Transfer (Instant)
**Flow:**
1. User initiates transfer via `/api/transfer/acredis-to-acredis`
2. System validates sender has sufficient balance
3. System performs atomic transaction:
   - Sender Account: `balance -= transferAmount` and `availableBalance -= transferAmount`
   - Recipient Account: `balance += recipientAmount` and `availableBalance += recipientAmount`
   - Creates 2 Transaction records: TRANSFER_OUT (sender) and TRANSFER_IN (recipient)
   - Both transactions have `status = COMPLETED` immediately
   - Handles currency conversion if needed
4. Both users see updated balances instantly

**Code Reference:** [/api/transfer/acredis-to-acredis/route.ts](src/app/api/transfer/acredis-to-acredis/route.ts#L155-L169)

### 5. International Transfer
**Flow:**
1. User submits international transfer via `/api/transfer/international`
2. Creates Transaction with `status = PENDING`, `channel = INTERNATIONAL`
3. Sender's balance is NOT deducted immediately (pending admin approval)
4. Admin reviews and approves (requires separate admin route implementation)
5. Upon approval:
   - Sender Account: `balance -= transferAmount`
   - Transaction: `status = COMPLETED`
6. User sees updated balance after approval

**Note:** International transfers require admin approval before balance is deducted.

## Dashboard Balance Display

### Frontend Implementation
**File:** [/dashboard/page.tsx](src/app/dashboard/page.tsx#L97)

The dashboard fetches account balance on component mount and displays it:

```typescript
// Fetch account data
const accountRes = await axios.get(`/api/accounts?userId=${userId}`);
setAccountBalance(accountRes.data.accounts[0].balance);
```

**Display Components:**
- Total Balance: Shows `accounts[0].balance`
- Total Assets: Shows `balance + totalInvestments`
- Updates automatically when user refreshes or navigates back to dashboard

### API Endpoint
**File:** `/api/accounts`

Returns user's account(s) with current balance:
```json
{
  "accounts": [{
    "id": "...",
    "accountNumber": "...",
    "balance": 1250.50,
    "availableBalance": 1250.50,
    "currency": "USD"
  }]
}
```

## Database Schema

### Account Table
```prisma
model Account {
  id               String   @id @default(cuid())
  userId           String
  accountNumber    String   @unique
  balance          Float    @default(0)      // Current total balance
  availableBalance Float    @default(0)      // Available for withdrawal/transfer
  currency         String   @default("USD")
  status           AccountStatus @default(ACTIVE)
  // ... other fields
}
```

### Transaction Table
```prisma
model Transaction {
  id              String   @id @default(cuid())
  userId          String
  accountId       String
  transactionType TransactionType  // DEPOSIT, TRANSFER_IN, TRANSFER_OUT, etc.
  channel         TransactionChannel? // BANK, CRYPTO, CHEQUE, INTERNATIONAL, etc.
  amount          Float
  balanceAfter    Float              // Account balance after this transaction
  status          TransactionStatus  // PENDING, COMPLETED, FAILED
  processedAt     DateTime?
  processedBy     String?            // Admin ID who approved
  // ... other fields
}
```

## Transaction Status Flow

### Deposit Lifecycle
```
USER SUBMITS → PENDING → ADMIN REVIEWS → APPROVED/REJECTED
                                        ↓
                                   COMPLETED (balance updated)
                                        or
                                   FAILED (no balance change)
```

### Transfer Lifecycle
```
Internal (Acredis-to-Acredis):
USER INITIATES → COMPLETED (instant, balance updated immediately)

International:
USER INITIATES → PENDING → ADMIN REVIEWS → COMPLETED (balance updated)
```

## Key Features

### Atomic Transactions
All balance updates use Prisma transactions (`prisma.$transaction`) to ensure:
- Balance updates and status changes happen together
- No partial updates if any step fails
- Data consistency across Account and Transaction tables

### Audit Trail
Every balance change creates:
1. **Transaction Record:** Complete details with amount, type, status, balanceAfter
2. **Activity Log:** User action history for compliance
3. **Notification:** Real-time user notification about balance change

### Balance Types
- **balance:** Total account balance (all funds)
- **availableBalance:** Funds available for immediate use (excludes pending/locked amounts)

Currently both are updated together, but the system supports:
- Holding funds for pending transactions
- Implementing withdrawal limits
- Managing locked/invested amounts

## Testing the Flow

### Test Scenario: Bank Deposit
1. Login as user (or create account)
2. Navigate to Dashboard → Monetary → Bank Deposit
3. Fill deposit form (amount: 1000 USD)
4. Submit deposit
5. Check dashboard - balance NOT updated yet (status: PENDING)
6. Login as admin (admin@acredisfinance.com / Admin@Acredis2026)
7. Navigate to Admin → Bank Deposits
8. Find pending deposit and click Approve
9. Login back as user
10. Check dashboard - balance now shows +1000 USD ✓

### Test Scenario: Acredis Transfer
1. Login as User A
2. Navigate to Dashboard → Transfer → Acredis to Acredis
3. Enter User B's account number and amount (500 USD)
4. Confirm transfer
5. Check User A's dashboard - balance immediately decreased by 500
6. Login as User B
7. Check User B's dashboard - balance immediately increased by 500 ✓

## API Endpoints Summary

### Deposits
- `POST /api/bank-deposits` - User submits bank deposit
- `POST /api/crypto-deposits` - User submits crypto deposit  
- `POST /api/cheque-deposits` - User submits cheque deposit
- `POST /api/admin/bank-deposits/approve` - Admin approves bank deposit ✓ **Updates balance**
- `POST /api/admin/crypto-deposits/approve` - Admin approves crypto deposit ✓ **Updates balance**
- `POST /api/admin/cheque-deposits/approve` - Admin approves cheque deposit ✓ **Updates balance**

### Transfers
- `POST /api/transfer/acredis-to-acredis` - Instant internal transfer ✓ **Updates both balances**
- `POST /api/transfer/international` - Creates pending international transfer
- `POST /api/transfer/domestic` - Creates pending domestic transfer

### Account Info
- `GET /api/accounts?userId={userId}` - Fetch user account(s) with current balance

## Notes
- All deposit types require admin approval before balance is credited
- Internal transfers (Acredis-to-Acredis) are instant and don't require approval
- International/domestic transfers may require admin approval (check business rules)
- Currency conversion is handled automatically for multi-currency transfers
- Balance is always in the account's base currency
