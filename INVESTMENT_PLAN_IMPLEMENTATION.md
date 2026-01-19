# Investment Plan System Implementation

## Database Schema
Updated schema with:
- **InvestmentPlan** model (admin creates plans)
- **Investment** model (user investments)
- Payment methods: BANK_WALLET, CRYPTO
- Investment statuses: PENDING, ACTIVE, COMPLETED, CANCELLED, FAILED

## Implementation Steps

### 1. Admin Side - Investment Plan Management
Create these files:
- `/src/app/admin/investment-plans/page.tsx` - List all plans
- `/src/app/api/admin/investment-plans/route.ts` - CRUD API

### 2. User Side - Investment Interface  
Create these files:
- `/src/app/investment/plans/page.tsx` - Browse available plans (ALREADY EXISTS - needs update)
- `/src/app/investment/invest/[planId]/page.tsx` - Investment checkout page
- `/src/app/api/investments/route.ts` - Create investment API
- `/src/app/api/investments/payment/route.ts` - Process payment API

### 3. Features
- Admin creates plans with: name, min/max amount, ARK_II allocation, duration, profit%, crypto address
- User selects plan and enters investment amount
- Payment options:
  1. Bank Wallet (default) - deduct from account balance
  2. Crypto - show admin's crypto address for payment
- Track investment status and profits

## Next: Run database migration
`npx prisma db push && npx prisma generate`
