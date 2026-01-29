# Crypto Holdings Feature

## Overview
The Crypto Holdings feature allows users to deposit funds from their account balance into cryptocurrency holdings that track real market prices. Users earn daily interest on their holdings and can withdraw at any time.

## Features

### User Features
- **Deposit from Balance**: Users can deposit funds from their account balance into any supported cryptocurrency
- **Real Market Tracking**: Holdings track actual cryptocurrency market prices (via CoinGecko API)
- **Earn Interest**: Users earn daily interest based on the annual percentage yield (APY) set by admin
- **Withdraw Anytime**: Users can withdraw their holdings + interest back to their account balance
- **Multi-Token Support**: Support for multiple cryptocurrencies (BTC, ETH, USDT, BNB, SOL, XRP, etc.)

### Admin Features
- **Token Management**: Create, edit, and delete holding tokens
- **Token Configuration**: 
  - Set token name and symbol
  - Upload token logo
  - Set deposit address
  - Configure interest rate (APY)
  - Enable/disable tokens
- **User Holdings Monitoring**: View all user holdings with real-time values
- **Price Updates**: Manually trigger price updates or use automated updates
- **Statistics Dashboard**: View total holdings, active holdings, total value, and interest earned

## Database Schema

### HoldingToken Model
```prisma
model HoldingToken {
  id              String        @id @default(cuid())
  name            String        // e.g., "Bitcoin"
  symbol          String        @unique // e.g., "BTC"
  logo            String?       // Base64 or URL
  tokenAddress    String?       // Deposit address
  currentPrice    Float         @default(0)
  priceChange24h  Float         @default(0)
  interestRate    Float         @default(0) // Annual interest rate in percentage
  isActive        Boolean       @default(true)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  userHoldings    UserHolding[]
}
```

### UserHolding Model
```prisma
model UserHolding {
  id                String        @id @default(cuid())
  userId            String
  tokenId           String
  depositedAmount   Float         // Original amount deposited in user's currency
  tokenAmount       Float         // Amount in tokens (calculated at deposit time)
  currentValue      Float         // Current value in user's currency
  interestEarned    Float         @default(0)
  status            HoldingStatus @default(ACTIVE)
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  
  user              User          @relation(fields: [userId], references: [id])
  token             HoldingToken  @relation(fields: [tokenId], references: [id])
}

enum HoldingStatus {
  ACTIVE
  WITHDRAWN
  CLOSED
}
```

## API Endpoints

### Admin Endpoints
- `GET /api/admin/holding-tokens` - Get all holding tokens
- `POST /api/admin/holding-tokens` - Create new token
- `PATCH /api/admin/holding-tokens` - Update token
- `DELETE /api/admin/holding-tokens` - Delete token
- `GET /api/admin/user-holdings` - Get all user holdings
- `PATCH /api/admin/user-holdings` - Update user holding
- `DELETE /api/admin/user-holdings` - Delete user holding (with refund)

### User Endpoints
- `GET /api/holdings/tokens` - Get available tokens
- `GET /api/holdings/my-holdings` - Get user's holdings
- `POST /api/holdings/my-holdings` - Create new holding
- `PATCH /api/holdings/my-holdings` - Withdraw holding

### Price Update
- `POST /api/holdings/update-prices` - Update all token prices (cron job)
- `GET /api/holdings/update-prices` - Manual trigger (admin only)

## Setup Instructions

### 1. Run Database Migration
The Prisma schema has already been updated. When you push to production or have database connection:
```bash
npx prisma db push
# or
npx prisma migrate deploy
```

### 2. Seed Initial Tokens
Run the seeding script to create initial tokens:
```bash
npx ts-node scripts/seed_holding_tokens.ts
```

This will create 6 default tokens:
- Bitcoin (BTC) - 5% APY
- Ethereum (ETH) - 6.5% APY
- Tether (USDT) - 8% APY
- Binance Coin (BNB) - 7% APY
- Solana (SOL) - 9% APY
- Ripple (XRP) - 6% APY

### 3. Set Environment Variable
Add to your `.env` file:
```env
CRON_SECRET="your-secret-key-here"
```

### 4. Setup Price Update Automation
The price update endpoint can be called via:
- **Manual**: Admin can click "Update Prices" button in the admin panel
- **Cron Job**: Set up a cron job or GitHub Actions to call the endpoint every 5-10 minutes

Example cron configuration (Vercel Cron):
```json
{
  "crons": [
    {
      "path": "/api/holdings/update-prices",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Or use external cron service (e.g., cron-job.org):
- URL: `https://yourdomain.com/api/holdings/update-prices`
- Method: POST
- Headers: `Content-Type: application/json`
- Body: `{"secret": "your-secret-key"}`
- Schedule: Every 5 minutes

## User Flow

1. **View Holdings**:
   - User clicks the MoreVert icon (⋮) on the Total Balance card
   - Modal opens showing intro about holdings feature

2. **Create Holding**:
   - User clicks "Get Started"
   - Selects cryptocurrency from available tokens
   - Enters deposit amount (funds deducted from account balance)
   - Confirms deposit
   - Holding is created with initial value

3. **Track Performance**:
   - User navigates to "My Holdings" in modal
   - Views all active holdings with:
     - Current value (based on market price)
     - Interest earned (calculated daily)
     - Profit/Loss (percentage and absolute)

4. **Withdraw**:
   - User clicks "Withdraw" on any holding
   - Total amount (current value + interest) returned to account balance
   - Transaction record created
   - Holding status updated to WITHDRAWN

## Admin Flow

1. **Access Holdings Management**:
   - Navigate to Admin → Holdings in sidebar
   - View statistics dashboard

2. **Create Token**:
   - Click "Add Token"
   - Fill in token details:
     - Name (e.g., "Bitcoin")
     - Symbol (e.g., "BTC")
     - Upload logo (optional)
     - Token address (for display)
     - Interest rate (APY percentage)
   - Click "Create"

3. **Update Prices**:
   - Click "Update Prices" button
   - System fetches latest prices from CoinGecko
   - All token prices and user holdings updated
   - Interest calculated and added

4. **Manage Holdings**:
   - View all user holdings in table
   - See user details, token amount, current value, P/L
   - Can delete holdings (funds refunded to user)

## Price Update Logic

The price update mechanism:
1. Fetches current prices from CoinGecko API for all active tokens
2. Updates `currentPrice` and `priceChange24h` in HoldingToken table
3. For each active user holding:
   - Calculates new `currentValue` = `tokenAmount` × `currentPrice`
   - Calculates daily interest based on:
     - Days since creation
     - Annual interest rate (APY)
     - Formula: `interest = depositedAmount × (APY/365/100) × days`
   - Updates `interestEarned` in UserHolding table

## Supported Cryptocurrencies

The system supports any cryptocurrency available on CoinGecko. Default mappings:
- BTC → bitcoin
- ETH → ethereum  
- USDT → tether
- BNB → binancecoin
- XRP → ripple
- ADA → cardano
- DOGE → dogecoin
- SOL → solana
- TRX → tron
- DOT → polkadot

To add new tokens, update the mapping in `/api/holdings/update-prices/route.ts`

## File Structure

```
src/
├── app/
│   ├── admin/
│   │   └── holdings/
│   │       └── page.tsx                    # Admin holdings management page
│   └── api/
│       ├── admin/
│       │   ├── holding-tokens/
│       │   │   └── route.ts                # Admin token CRUD
│       │   └── user-holdings/
│       │       └── route.ts                # Admin holdings management
│       └── holdings/
│           ├── tokens/
│           │   └── route.ts                # Get available tokens (user)
│           ├── my-holdings/
│           │   └── route.ts                # User holdings CRUD
│           └── update-prices/
│               └── route.ts                # Price update mechanism
├── components/
│   └── modals/
│       └── HoldingsModal.tsx               # User holdings modal
└── prisma/
    └── schema.prisma                        # Updated with HoldingToken & UserHolding models

scripts/
└── seed_holding_tokens.ts                  # Seed initial tokens
```

## Security Considerations

1. **CRON_SECRET**: Always use a strong secret for the price update endpoint
2. **Balance Validation**: System checks user balance before creating holdings
3. **Transaction Safety**: All deposits/withdrawals use Prisma transactions
4. **Admin Authorization**: All admin endpoints verify user role
5. **User Authorization**: Users can only access their own holdings

## Future Enhancements

Potential improvements:
- Add historical charts for holding performance
- Support for partial withdrawals
- Automatic compounding of interest
- Staking pools with higher APY
- Referral bonuses for holdings
- Mobile push notifications for price alerts
- CSV export of holdings history

## Troubleshooting

### Prices not updating
- Check CRON_SECRET is set correctly
- Verify cron job is running
- Check CoinGecko API rate limits (free tier: 50 calls/minute)
- Try manual update from admin panel

### Holdings not showing correct value
- Run price update manually
- Check if token is active
- Verify token price is not 0

### Cannot create holding
- Check user has sufficient balance
- Verify token is active
- Check database connection

## Support

For issues or questions about the holdings feature, contact the development team or file an issue in the repository.
