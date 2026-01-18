# International Transfer Feature - Complete Documentation

## Overview
This document describes the international transfer feature with admin approval workflow, OTP verification, and admin permission controls.

---

## 🌍 International Transfer Workflow

### User Journey

**Step 1: Transfer Initiation**
1. User navigates to `/dashboard/transfer/international`
2. Fills in transfer details across 4 steps:
   - **Step 1:** Amount, account selection, and currency
   - **Step 2:** Beneficiary personal details
   - **Step 3:** Bank details and transfer purpose
   - **Step 4:** Confirmation with PIN and OTP

**Step 2: OTP Verification**
1. User clicks "Send OTP" button
2. System generates 6-digit OTP
3. OTP sent to user's registered email
4. OTP valid for 10 minutes
5. 60-second cooldown between OTP requests

**Step 3: PIN & OTP Submission**
1. User enters transaction PIN
2. User enters OTP received via email
3. System validates both PIN and OTP
4. System performs admin control checks

**Step 4: Transfer Creation**
1. Status: `PENDING` (awaiting admin approval)
2. Funds **immediately locked** from availableBalance
3. Transaction reference: `INT{timestamp}{random}`
4. Notifications sent to:
   - User: "Transfer pending approval"
   - All admins: "New international transfer pending"

**Step 5: Admin Processing** (To be implemented)
1. Admin reviews transfer details
2. Can approve or reject with reason
3. **If Approved:**
   - Status → `COMPLETED`
   - Balance deducted
   - Funds released
   - User notified
4. **If Rejected:**
   - Status → `REJECTED`
   - Locked funds refunded
   - User notified with reason

---

## 🔐 Admin Permission Controls

### Three-Level Permission System

#### 1. **Transfer Permission** (`canTransfer`)
- **Default:** `true`
- **When Disabled:**
  - User cannot initiate any transfers (domestic or international)
  - Error: "Transfer privileges have been disabled for your account"
  - User receives notification
- **Admin Action:** Can toggle on/off from User Management UI

#### 2. **Account Status** (`accountDisabled`)
- **Default:** `false`
- **When Disabled:**
  - User cannot access account
  - All features blocked
  - Error: "Your account has been disabled. Please contact support."
  - User receives notification
- **Admin Action:** Can disable/enable from User Management UI

#### 3. **Verification Status** (`isVerified`)
- **Default:** `false`
- **When Unverified:**
  - User can use most features
  - **Cannot** make international transfers
  - Error: "Your account must be verified before you can make international transfers"
  - Domestic transfers still allowed
- **When Verified:**
  - User can make international transfers
  - User receives congratulatory notification
- **Admin Action:** Can verify/unverify from User Management UI

---

## 📁 Files Created/Modified

### Database Schema
**File:** `/prisma/schema.prisma`

#### Added Models:
```prisma
model User {
  // ... existing fields
  canTransfer      Boolean  @default(true)
  accountDisabled  Boolean  @default(false)
  isVerified       Boolean  @default(false)
}

model TransferOTP {
  id        String   @id @default(cuid())
  userId    String
  otp       String
  type      String   // 'international_transfer' or 'domestic_transfer'
  expiresAt DateTime
  verified  Boolean  @default(false)
}

model InternationalTransfer {
  id                    String   @id @default(cuid())
  userId                String
  transactionId         String   @unique
  // Sender details
  senderAccountId       String
  amount                Float
  currency              String
  fee                   Float
  // Beneficiary details (name, email, phone, address, city, state, country, postal code)
  // Bank details (name, address, city, country, account number, IBAN, SWIFT, routing, sort code)
  // Transfer details (purpose, narration, status, rejection reason, processed by/at)
}
```

### API Endpoints

#### 1. **Generate OTP** 
**Endpoint:** `POST /api/transfer/otp/generate`
**File:** `/src/app/api/transfer/otp/generate/route.ts`

**Request:**
```json
{
  "userId": "cmkjgj6j60000zei0tgn3rspj",
  "type": "international_transfer"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent to your email address",
  "expiresAt": "2026-01-18T12:30:00.000Z"
}
```

**Features:**
- Generates 6-digit OTP
- Invalidates previous OTPs
- Sends email with formatted OTP
- 10-minute expiration
- Checks if account is disabled

---

#### 2. **Verify OTP**
**Endpoint:** `POST /api/transfer/otp/verify`
**File:** `/src/app/api/transfer/otp/verify/route.ts`

**Request:**
```json
{
  "userId": "cmkjgj6j60000zei0tgn3rspj",
  "otp": "123456",
  "type": "international_transfer"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "otpId": "otp_id_here"
}
```

**Checks:**
- OTP matches
- OTP not expired
- OTP not already used
- Marks OTP as verified

---

#### 3. **International Transfer**
**Endpoint:** `POST /api/transfer/international`
**File:** `/src/app/api/transfer/international/route.ts`

**Request:**
```json
{
  "userId": "user_id",
  "accountId": "account_id",
  "amount": 1000,
  "currency": "USD",
  "pin": "1234",
  "otp": "123456",
  "beneficiaryName": "John Doe",
  "beneficiaryAddress": "123 Main St",
  "beneficiaryCountry": "United States",
  "bankName": "Bank of America",
  "bankAddress": "100 North Tryon St",
  "bankCountry": "United States",
  "accountNumber": "123456789",
  "swiftCode": "BOFAUS3N",
  "purpose": "Family Support"
}
```

**Validations:**
1. All required fields present
2. User exists
3. Account not disabled (`accountDisabled === false`)
4. Transfer permission enabled (`canTransfer === true`)
5. Account verified (`isVerified === true`)
6. PIN correct
7. OTP valid and verified
8. Sufficient balance (amount + fee)
9. No duplicate submission (30-second window)

**Response:**
```json
{
  "success": true,
  "message": "International transfer initiated successfully",
  "reference": "INT17370890123456",
  "transaction": { /* transaction details */ },
  "transfer": { /* international transfer details */ }
}
```

**Actions:**
- Creates transaction (PENDING status)
- Creates international transfer record
- Locks funds (availableBalance -= total)
- Notifies user and admins
- Logs activity
- Invalidates OTP

---

#### 4. **Get Users** (Admin)
**Endpoint:** `GET /api/admin/users`
**File:** `/src/app/api/admin/users/route.ts`

**Response:**
```json
[
  {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "USER",
    "canTransfer": true,
    "accountDisabled": false,
    "isVerified": true,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
]
```

---

#### 5. **Update User Permissions** (Admin)
**Endpoint:** `PATCH /api/admin/users/permissions`
**File:** `/src/app/api/admin/users/permissions/route.ts`

**Request:**
```json
{
  "userId": "user_id",
  "canTransfer": false,
  "accountDisabled": false,
  "isVerified": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "User permissions updated successfully",
  "user": { /* updated user details */ }
}
```

**Features:**
- Cannot modify admin accounts
- Sends notification to user
- Logs activity
- Updates one or all permissions at once

---

### Frontend Pages

#### 1. **International Transfer Form**
**File:** `/src/app/dashboard/transfer/international/page.tsx`
**URL:** `/dashboard/transfer/international`

**Features:**
- 4-step wizard interface
- Progress bar showing current step
- Real-time fee calculation
- OTP generation and verification
- Form validation at each step
- Responsive design
- Back/Next navigation
- Summary review before submission

**Fields Collected:**
- Amount and currency
- Beneficiary: name, email, phone, address, city, state, country, postal code
- Bank: name, address, city, country, account number, IBAN, SWIFT, routing number, sort code
- Purpose (dropdown), narration (optional)
- PIN and OTP

---

#### 2. **Admin User Management**
**File:** `/src/app/admin/users/page.tsx`
**URL:** `/admin/users`

**Features:**
- List all users with status badges
- Search by name or email
- Filter by status (all, active, disabled, verified, unverified)
- Toggle buttons for each permission:
  - Enable/Disable Transfers
  - Enable/Disable Account
  - Verify/Unverify Account
- Cannot modify admin accounts
- Real-time updates after permission changes
- Status indicators:
  - Green badge: Active/Enabled
  - Red badge: Disabled
  - Blue badge: Verified
  - Gray badge: Unverified
  - Purple badge: Admin role

---

#### 3. **Admin Settings Management**
**File:** `/src/app/admin/settings/page.tsx`
**URL:** `/admin/settings`

**Features:**
- View all system settings grouped by category
- Edit settings inline
- Type-specific input validation
- Search and filter by category
- Settings include:
  - `international_transfer_fee`: $25 (editable)
  - `domestic_transfer_fee`: $3 (editable)
  - Transfer limits (min, max, daily)

---

### Utility Files

#### 1. **Email Service**
**File:** `/src/lib/email.ts`

**Functions:**
- `sendEmail({ to, subject, html, text })`
- `sendOTPEmail(email, otp, name, type)`

**Configuration:**
Requires environment variables:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@acredisfinance.com
APP_NAME=Acredis Finance
```

**Fallback:**
If SMTP not configured, logs email to console (development mode)

---

## 🗄️ Database Changes

### Migration Commands (Already Run)
```bash
npx prisma db push
npx prisma generate
npx ts-node prisma/seed-settings.ts
```

### New Tables
1. `transfer_otps` - Stores OTPs for transfer verification
2. `international_transfers` - Stores international transfer details

### Updated Tables
- `users` - Added: `canTransfer`, `accountDisabled`, `isVerified`
- `system_settings` - Added: `international_transfer_fee` ($25)

---

## 🚀 Usage Examples

### User Making International Transfer

**Step 1: Navigate to Page**
```
/dashboard/transfer/international
```

**Step 2: Fill Amount (Step 1)**
- Select account
- Enter amount: $1000
- Select currency: USD
- See fee: $25
- Total: $1025

**Step 3: Beneficiary Details (Step 2)**
- Name: John Doe
- Email: john@example.com
- Address: 123 Main Street
- Country: United Kingdom

**Step 4: Bank Details (Step 3)**
- Bank: Barclays Bank
- Address: 1 Churchill Place
- Country: United Kingdom
- Account Number: 12345678
- IBAN: GB82WEST12345698765432
- SWIFT: BARCGB22
- Purpose: Family Support

**Step 5: Confirm & Verify (Step 4)**
1. Click "Send OTP"
2. Check email for OTP (e.g., 654321)
3. Enter OTP: 654321
4. Enter PIN: 1234
5. Click "Complete Transfer"

**Result:**
- Transfer created with status PENDING
- $1025 locked from available balance
- Notification: "Transfer pending admin approval"
- Reference: INT17370890123456

---

### Admin Managing User Permissions

**Navigate to:**
```
/admin/users
```

**Scenario 1: Disable Transfers for Suspicious User**
1. Search for user by email
2. Click "Disable Transfers"
3. User receives notification
4. User cannot initiate transfers until re-enabled

**Scenario 2: Verify New User**
1. Filter by "Unverified Users"
2. Find user to verify
3. Click "Verify"
4. User receives "Account Verified" notification
5. User can now make international transfers

**Scenario 3: Disable Compromised Account**
1. Search for user
2. Click "Disable Account"
3. User immediately logged out
4. User cannot access account until re-enabled

---

### Admin Updating Transfer Fee

**Navigate to:**
```
/admin/settings
```

**Steps:**
1. Filter by "Fees" category
2. Find "international_transfer_fee"
3. Click "Edit"
4. Change value from 25 to 30
5. Click "Save"
6. New fee applies immediately to all new transfers

---

## 🔍 Error Messages

### Transfer Permission Errors

**Account Disabled:**
```
Your account has been disabled. Please contact support.
```

**Transfer Permission Disabled:**
```
Transfer privileges have been disabled for your account. Please contact support.
```

**Account Not Verified:**
```
Your account must be verified before you can make international transfers. Please contact support.
```

### OTP Errors

**Invalid OTP:**
```
Invalid OTP. Please check and try again.
```

**Expired OTP:**
```
OTP has expired. Please request a new one.
```

**OTP Not Verified:**
```
Invalid or expired OTP. Please generate a new one.
```

### Transfer Errors

**Incorrect PIN:**
```
Incorrect transaction PIN
```

**Insufficient Balance:**
```
Insufficient balance. You need $1025.00 (including $25.00 fee)
```

**Missing Required Fields:**
```
Bank details are incomplete. SWIFT code is required for international transfers.
```

**Rate Limiting:**
```
Please wait before submitting another transfer
```

---

## 📊 Admin Control Matrix

| Permission | Default | Effect When Disabled | Affects Domestic? | Affects International? |
|-----------|---------|---------------------|-------------------|----------------------|
| `canTransfer` | `true` | Cannot initiate any transfers | ✅ Yes | ✅ Yes |
| `accountDisabled` | `false` | Cannot access account at all | ✅ Yes | ✅ Yes |
| `isVerified` | `false` | Cannot make international transfers | ❌ No | ✅ Yes |

---

## 🎯 Testing Checklist

### User Flow Tests
- [ ] User can access international transfer page
- [ ] Step 1: Amount validation works
- [ ] Step 2: Beneficiary validation works
- [ ] Step 3: Bank details validation (SWIFT required)
- [ ] Step 4: OTP sends to email
- [ ] OTP expires after 10 minutes
- [ ] PIN validation works
- [ ] Invalid OTP shows error
- [ ] Insufficient balance shows error
- [ ] Transfer creates with PENDING status
- [ ] Funds locked from availableBalance
- [ ] User receives notification
- [ ] Admin receives notification

### Admin Permission Tests
- [ ] Admin can view all users
- [ ] Admin can disable transfers for user
- [ ] Admin can disable account
- [ ] Admin can verify/unverify user
- [ ] Cannot modify admin accounts
- [ ] User receives notifications on permission changes
- [ ] Unverified user blocked from international transfer
- [ ] Transfer-disabled user blocked from all transfers
- [ ] Disabled account cannot login

### Admin Settings Tests
- [ ] Admin can view settings by category
- [ ] Admin can search settings
- [ ] Admin can edit international_transfer_fee
- [ ] New fee applies immediately
- [ ] Type validation works (number only)

---

## 🔐 Security Features

1. **Two-Factor Authentication**
   - PIN verification
   - Email OTP verification
   - OTP expires in 10 minutes
   - Rate limiting (30-second window)

2. **Admin Controls**
   - Three-level permission system
   - Cannot modify admin accounts
   - Activity logging on permission changes
   - Notifications on permission changes

3. **Fund Protection**
   - Funds locked immediately
   - Balance check before transfer
   - Admin approval required
   - Cannot double-submit

4. **Data Validation**
   - SWIFT code required for international
   - Transfer purpose required
   - Email format validation
   - Amount range validation

---

## 🛠️ Environment Configuration

Add to `.env` file:

```env
# Email Configuration (for OTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@acredisfinance.com
APP_NAME=Acredis Finance

# Database (already configured)
DATABASE_URL=your_database_url
```

**Gmail Setup:**
1. Enable 2-factor authentication
2. Generate App Password
3. Use App Password as SMTP_PASSWORD

---

## 📝 Next Steps (To Be Implemented)

1. **Admin Approval UI**
   - Page: `/admin/transfers/international/pending`
   - List all pending international transfers
   - Approve/Reject buttons
   - Rejection reason input
   - Transfer details view

2. **Approval API Endpoints**
   - `POST /api/admin/transfers/international/approve`
   - `POST /api/admin/transfers/international/reject`
   - Update transaction status
   - Refund or deduct funds
   - Notify user

3. **Transfer History**
   - User can view international transfer history
   - Status tracking (Pending → Approved/Rejected)
   - Download receipt

4. **Saved Beneficiaries**
   - Save international beneficiaries
   - Quick select on next transfer
   - Edit/delete beneficiaries

---

## 📞 Support

For issues or questions:
- Check error messages for guidance
- Contact admin if account disabled
- Verify email configuration for OTP delivery
- Check available balance before transfer

---

**Last Updated:** January 18, 2026
**Version:** 1.0.0
