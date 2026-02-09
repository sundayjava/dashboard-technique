# Currency Exchange Rate System

## Overview
The system fetches live exchange rates from ExchangeRate-API once daily and stores them in the database. User conversions fetch from the database with 1-hour caching to minimize database queries.

## Architecture

### 1. Database Storage
- **Model**: `Currency`
- **Fields**:
  - `code`: Currency code (USD, NGN, EUR, etc.)
  - `exchangeRate`: Rate relative to USD (1 USD = X currency)
  - `lastSynced`: When rate was last updated
  - `isActive`: Whether currency is enabled

### 2. Daily Sync (Automatic)
- **Cron Job**: Runs daily at 1:00 AM UTC
- **Endpoint**: `/api/cron/sync-currency-rates`
- **Source**: ExchangeRate-API (Free tier: 1,500 requests/month)
- **Process**:
  1. Fetches latest rates from API
  2. Updates all active currencies in database
  3. Records sync timestamp

### 3. User Conversions
- **Library**: `/src/lib/currency-converter.ts`
- **Caching**: 1-hour in-memory cache
- **Flow**:
  1. Check if cached rates are valid (< 1 hour old)
  2. If cached, use them
  3. If not, fetch from database
  4. Cache for 1 hour
  5. Fallback to hardcoded rates if database fails

### 4. Investment Deposits/Withdrawals
- **Deposit**: Account Currency → USD (Investment Wallet)
  - Example: NGN 10,000 → USD 6.33
- **Withdrawal**: USD (Investment Wallet) → Account Currency
  - Example: USD 100 → NGN 158,000

## Manual Operations

### Sync Rates Manually
```bash
# Via API (for admin)
curl -X POST http://localhost:3000/api/currencies/sync-rates
```

### Check Current Rates
```bash
# Via API
curl http://localhost:3000/api/currencies/sync-rates
```

### Seed Currencies (First Time Setup)
```bash
npm run tsx scripts/seed_currencies.ts
```

## Configuration

### Environment Variables
```env
# ExchangeRate-API Key (already set)
EXCHANGE_RATE_API_KEY=d2b69cc4d8d051cebabb44f5

# Optional: Cron job authorization
CRON_SECRET=your-secret-here
```

### Vercel Cron Configuration
File: `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-currency-rates",
      "schedule": "0 1 * * *"  // Daily at 1 AM UTC
    }
  ]
}
```

## API Endpoints

### 1. Sync Rates (Manual)
**POST** `/api/currencies/sync-rates`

Response:
```json
{
  "success": true,
  "message": "Exchange rates synced successfully",
  "stats": {
    "updated": 51,
    "skipped": 0,
    "syncedAt": "2026-02-08T12:00:00.000Z"
  }
}
```

### 2. Get Current Rates
**GET** `/api/currencies/sync-rates`

Response:
```json
{
  "success": true,
  "currencies": [
    {
      "code": "USD",
      "name": "US Dollar",
      "exchangeRate": 1,
      "lastSynced": "2026-02-08T12:00:00.000Z"
    },
    {
      "code": "NGN",
      "name": "Nigerian Naira",
      "exchangeRate": 1580,
      "lastSynced": "2026-02-08T12:00:00.000Z"
    }
  ],
  "lastSync": "2026-02-08T12:00:00.000Z",
  "totalCurrencies": 51
}
```

### 3. Cron Job (Automatic)
**GET** `/api/cron/sync-currency-rates`
- Called automatically by Vercel Cron
- Requires `Authorization: Bearer <CRON_SECRET>` header (if CRON_SECRET is set)

## Supported Currencies (51)
USD, EUR, GBP, NGN, ZAR, KES, GHS, CAD, AUD, JPY, CNY, INR, SAR, AED, QAR, KWD, OMR, BHD, EGP, TRY, CHF, SEK, NOK, DKK, PLN, CZK, HUF, RON, BGN, HRK, RUB, UAH, BRL, MXN, ARS, CLP, COP, PEN, SGD, HKD, KRW, THB, MYR, IDR, PHP, VND, NZD, PKR, BDT, LKR, NPR

## Performance Optimization
1. **Database**: Rates stored once, updated daily
2. **Memory Cache**: 1-hour cache reduces DB queries
3. **Fallback**: Hardcoded rates if DB/API fails
4. **Minimal API Calls**: Only 1 API request per day (30/month vs 1,500 limit)

## Monitoring
- Check sync status: `GET /api/currencies/sync-rates`
- View `lastSynced` timestamp for each currency
- Logs in console: `[Currency Converter] Loaded X rates from database`
