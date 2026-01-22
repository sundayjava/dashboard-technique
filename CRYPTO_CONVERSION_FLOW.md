# Crypto Deposit Currency Conversion

## Overview
When you deposit BTC (or any cryptocurrency) and your account currency is EUR, the conversion happens **at deposit submission time**, not in the dashboard.

## How It Works

### 1. User Submits Crypto Deposit
**Location:** Digital Deposit Page (`/dashboard/monetary/digital-deposit`)

**Flow:**
1. User selects crypto address (e.g., Bitcoin)
2. User enters amount in BTC (e.g., `0.5 BTC`)
3. System automatically fetches live BTC/EUR rate from Binance
4. Shows real-time conversion preview: `"Estimated value: EUR 42,500.00"`
5. User enters transaction hash and submits

**Frontend:** [digital-deposit/page.tsx](src/app/dashboard/monetary/digital-deposit/page.tsx)
- Input shows crypto amount (BTC)
- Blue box below shows EUR equivalent in real-time
- Updates as user types (debounced 500ms)

### 2. Backend Converts Crypto → Fiat
**Location:** `/api/crypto-deposits` POST endpoint

**Conversion Process:**
```
User Input: 0.5 BTC
    ↓
Fetch BTC price from Binance API: $85,000 USD
    ↓
Calculate USD value: 0.5 × $85,000 = $42,500 USD
    ↓
Convert USD → EUR: $42,500 × 0.92 = €39,100 EUR
    ↓
Store in Database: amount = 39100, currency = 'EUR'
```

**Code:** [/api/crypto-deposits/route.ts](src/app/api/crypto-deposits/route.ts)

**What's Stored:**
```typescript
{
  amount: 39100,              // EUR value (not BTC amount!)
  currency: 'EUR',            // Account currency
  tokenSymbol: 'BTC',         // For reference
  metadata: {
    cryptoAmount: 0.5,        // Original BTC amount
    cryptoSymbol: 'BTC',
    cryptoPriceUSD: 85000,    // BTC price at time of deposit
    fiatAmount: 39100,        // Converted EUR amount
    fiatCurrency: 'EUR',
    exchangeRate: 0.92,       // USD to EUR rate
    conversionTimestamp: '2026-01-20T...'
  }
}
```

### 3. Admin Approves Deposit
**Location:** `/api/admin/crypto-deposits/approve`

**What Happens:**
```typescript
// Admin approves the deposit
Account.balance += 39100 EUR  // Credits the EUR amount
Transaction.status = 'COMPLETED'
```

The `amount` field (39,100 EUR) is added to account balance.

### 4. Dashboard Shows Balance
**Location:** `/dashboard`

**Display:**
- Fetches account from `/api/accounts`
- Shows `balance` field: **EUR 39,100.00**
- No conversion needed - already in EUR!

## Key Architecture Decisions

### ✅ Conversion at Deposit Time (Current Implementation)
**Pros:**
- Balance always in user's preferred currency (EUR)
- Simple dashboard display - no real-time conversion needed
- Historical record of exchange rate at deposit time
- Consistent with bank/cheque deposits

**Cons:**
- User deposited 0.5 BTC but balance shows EUR
- If BTC price rises, balance doesn't increase
- Requires live price feed from exchange

### ❌ Alternative: Store as Crypto, Convert in Dashboard
**Would require:**
- Multi-currency account support
- Real-time price feeds on every page load
- Complex balance calculations
- Separate crypto wallet functionality

## Price Data Source

### Binance API
**Endpoint:** `https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT`

**Supported Cryptocurrencies:**
- BTC (Bitcoin)
- ETH (Ethereum)  
- BNB (Binance Coin)
- SOL (Solana)
- XRP (Ripple)
- USDT (Tether)
- And more...

**Library:** [/lib/crypto-converter.ts](src/lib/crypto-converter.ts)

**Functions:**
- `getCryptoPrice(symbol)` - Fetches current price from Binance
- `convertCryptoToFiat(amount, crypto, fiat)` - Full conversion pipeline
- `formatCryptoAmount(amount, symbol)` - Display formatting

### Fallback Handling
If Binance API fails:
- Returns error to user: "Unable to get BTC price. Please try again."
- User can retry submission
- Consider adding backup price sources (CoinGecko, etc.)

## User Experience

### Before Submission
```
┌─────────────────────────────────┐
│ Amount                          │
│ ┌─────────────────────────┐     │
│ │ 0.5                 BTC │     │
│ └─────────────────────────┘     │
│                                 │
│ ┌────────────────────────────┐  │
│ │ Estimated value:           │  │
│ │ EUR 39,100.00         │  │
│ │ This amount will be        │  │
│ │ credited after approval    │  │
│ └────────────────────────────┘  │
└─────────────────────────────────┘
```

### After Approval
**Dashboard Balance:**
```
Total Balance
EUR 39,100.00
```

**Transaction History:**
```
Crypto deposit - 0.5 BTC
EUR 39,100.00
Status: Completed
```

## Testing the Flow

### Test Case 1: BTC Deposit with EUR Account
1. Login as user with EUR account
2. Go to Digital Deposit
3. Select Bitcoin address
4. Enter amount: `0.001 BTC`
5. See conversion: `~EUR 78.20` (varies by market price)
6. Enter transaction hash
7. Submit deposit
8. Login as admin
9. Approve deposit
10. Check user dashboard: Balance increased by ~EUR 78.20

### Test Case 2: ETH Deposit with USD Account  
1. Login as user with USD account
2. Go to Digital Deposit
3. Select Ethereum address
4. Enter amount: `1 ETH`
5. See conversion: `~USD 3,200.00`
6. Complete deposit flow
7. Balance shows USD 3,200.00

## Configuration

### Exchange Rates (Fiat)
**File:** [/lib/currency-converter.ts](src/lib/currency-converter.ts)

```typescript
const EXCHANGE_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  // ... more currencies
}
```

**Note:** These are static rates. Consider integrating live forex API for production.

### Supported Cryptos
Add new cryptocurrencies by:
1. Ensure Binance supports `{SYMBOL}USDT` pair
2. Frontend automatically works with any token name
3. Backend extracts symbol and fetches price

## Metadata Tracking

Every crypto deposit stores complete conversion details:

```json
{
  "metadata": {
    "cryptoAmount": 0.5,
    "cryptoSymbol": "BTC",
    "cryptoPriceUSD": 85000,
    "fiatAmount": 39100,
    "fiatCurrency": "EUR",
    "exchangeRate": 0.92,
    "conversionTimestamp": "2026-01-20T10:30:00Z"
  }
}
```

**Use Cases:**
- Audit trail for compliance
- Dispute resolution ("What was the rate?")
- Historical analysis
- Tax reporting

## Summary

**Your Question:** "Where will conversion happen?"

**Answer:** **At deposit submission time** (when user submits the form)

**Process:**
1. 🔢 User enters: `0.5 BTC`
2. 💱 System converts: `0.5 BTC → EUR 39,100`
3. 💾 Database stores: `amount: 39100, currency: 'EUR'`
4. ✅ Admin approves: `balance += 39100 EUR`
5. 📊 Dashboard shows: `EUR 39,100.00`

**Not in dashboard** - The dashboard just displays the EUR amount already stored in the database. No real-time conversion happens during display.
