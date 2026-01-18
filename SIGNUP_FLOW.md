# Sign-Up Flow Quick Reference

## User Journey

### Step 1: Basic Information
```
┌─────────────────────────────────────────┐
│  Step 1 of 3 - Basic Information       │
│  ━━━━━━━━━━━━━░░░░░░░░░░░░░░  33%      │
├─────────────────────────────────────────┤
│                                         │
│  Authorization Code                     │
│  ┌───────────────────────────────────┐  │
│  │ AC-XYZ12345  [AUTO-GENERATED]     │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Email Address                          │
│  ┌───────────────────────────────────┐  │
│  │ your.email@example.com            │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Phone Number                           │
│  ┌─────┬─────────────────────────────┐  │
│  │+234▼│ 8012345678                  │  │
│  └─────┴─────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │           Next                    │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Step 2: Account Details
```
┌─────────────────────────────────────────┐
│  Step 2 of 3 - Account Details         │
│  ━━━━━━━━━━━━━━━━━━━━━━━░░░░░░  66%    │
├─────────────────────────────────────────┤
│                                         │
│  Account Type                           │
│  ┌───────────────────────────────────┐  │
│  │ Select account type            ▼ │  │
│  │ > Personal Account                │  │
│  │   Business Account                │  │
│  │   Corporate Account               │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Select Your Currency                   │
│  ┌───────────────────────────────────┐  │
│  │ Select currency                ▼ │  │
│  │ > $ USD - US Dollar               │  │
│  │   € EUR - Euro                    │  │
│  │   £ GBP - British Pound           │  │
│  │   ₦ NGN - Nigerian Naira          │  │
│  │   ... (30+ currencies)            │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌────────┬──┬───────────────────────┐  │
│  │  Back  │  │        Next           │  │
│  └────────┴──┴───────────────────────┘  │
└─────────────────────────────────────────┘
```

### Step 3: Security Setup
```
┌─────────────────────────────────────────┐
│  Step 3 of 3 - Security                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  100%   │
├─────────────────────────────────────────┤
│                                         │
│  Password                               │
│  ┌───────────────────────────────────┐  │
│  │ ••••••••••••                      │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Confirm Password                       │
│  ┌───────────────────────────────────┐  │
│  │ ••••••••••••                      │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Transaction PIN                        │
│  ┌───────────────────────────────────┐  │
│  │ ••••                              │  │
│  └───────────────────────────────────┘  │
│  Create a 4-6 digit PIN               │
│                                         │
│  Confirm Transaction PIN                │
│  ┌───────────────────────────────────┐  │
│  │ ••••                              │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌────────┬──┬───────────────────────┐  │
│  │  Back  │  │      Sign Up          │  │
│  └────────┴──┴───────────────────────┘  │
└─────────────────────────────────────────┘
```

### Step 4: Email Verification
```
┌─────────────────────────────────────────┐
│  📧 Check Your Email                    │
├─────────────────────────────────────────┤
│                                         │
│  We've sent a verification email to:    │
│  your.email@example.com                 │
│                                         │
│  Click the link in the email to         │
│  activate your account.                 │
│                                         │
└─────────────────────────────────────────┘

Email Content:
┌─────────────────────────────────────────┐
│  Welcome to Acredis Finance!            │
├─────────────────────────────────────────┤
│  Verify Your Email Address              │
│                                         │
│  Thank you for creating an account.     │
│  Click the button below to verify:      │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │   Verify Email Address            │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

## Data Flow

```
User Input (Step 1)
    ↓
Form Validation (Yup)
    ↓
Store in State
    ↓
User Input (Step 2)
    ↓
Form Validation (Yup)
    ↓
Store in State
    ↓
User Input (Step 3)
    ↓
Form Validation (Yup)
    ↓
Combine All Data
    ↓
POST /api/auth/register
    ↓
Validate All Fields
    ↓
Check Email Unique
    ↓
Check Auth Code Unique
    ↓
Hash Password (bcrypt)
    ↓
Hash Transaction PIN (bcrypt)
    ↓
Generate Verification Token
    ↓
Create User in Database
    ↓
Send Verification Email
    ↓
Return Success Response
    ↓
Show Success Toast
    ↓
Reset Form
```

## Validation Rules

### Email
- Must be valid email format
- Required field
- Checked for uniqueness in database

### Phone Number
- 6-15 digits only
- Combined with country code
- Required field

### Password
- Minimum 8 characters
- At least 1 lowercase letter
- At least 1 uppercase letter
- At least 1 number
- Must match confirmation

### Transaction PIN
- 4-6 digits only
- Numbers only
- Must match confirmation

### Account Type
- Must be one of: PERSONAL, BUSINESS, CORPORATE
- Required field

### Currency
- Must be valid currency code
- Required field

### Authorization Code
- Auto-generated: AC-XXXXXXXX
- 8 random alphanumeric characters
- Checked for uniqueness in database
- Non-editable by user

## Database Records Created

When a user signs up, the following is created:

```javascript
{
  id: "clx1234567890abcdef",           // Auto-generated CUID
  email: "user@example.com",           // From form
  emailVerified: false,                // Set to true after verification
  emailVerificationToken: "abc123...", // 32-byte random hex
  name: null,                          // Optional, can be added later
  password: "$2a$12$...",               // Bcrypt hash
  transactionPin: "$2a$12$...",        // Bcrypt hash (separate)
  phoneNumber: "8012345678",           // From form
  countryCode: "+234",                 // From dropdown
  accountType: "PERSONAL",             // From dropdown
  currency: "USD",                     // From dropdown
  authorizationCode: "AC-XYZ12345",    // Auto-generated
  avatar: null,                        // Optional, can be added later
  role: "USER",                        // Default role
  createdAt: "2026-01-15T10:30:00Z",   // Auto-generated
  updatedAt: "2026-01-15T10:30:00Z"    // Auto-generated
}
```

## API Responses

### Success Response
```json
{
  "message": "Account created successfully. Please check your email to verify your account.",
  "userId": "clx1234567890abcdef"
}
```

### Error Responses

**Duplicate Email:**
```json
{
  "error": "User with this email already exists"
}
```

**Duplicate Authorization Code:**
```json
{
  "error": "Authorization code already in use. Please refresh and try again."
}
```

**Missing Fields:**
```json
{
  "error": "All fields are required"
}
```

**Server Error:**
```json
{
  "error": "Failed to create account. Please try again."
}
```

## Country Codes Available (50+)

🇺🇸 +1 USA/Canada
🇬🇧 +44 United Kingdom
🇳🇬 +234 Nigeria
🇰🇪 +254 Kenya
🇿🇦 +27 South Africa
🇬🇭 +233 Ghana
🇮🇳 +91 India
🇨🇳 +86 China
🇯🇵 +81 Japan
🇩🇪 +49 Germany
... and 40+ more

## Currencies Available (30+)

$ USD - US Dollar
€ EUR - Euro
£ GBP - British Pound
₦ NGN - Nigerian Naira
KSh KES - Kenyan Shilling
R ZAR - South African Rand
₵ GHS - Ghanaian Cedi
₹ INR - Indian Rupee
¥ CNY - Chinese Yuan
¥ JPY - Japanese Yen
... and 20+ more

## Tech Stack

- **Frontend Framework**: Next.js 16 (App Router)
- **Form Management**: React Hook Form
- **Validation**: Yup
- **UI Components**: Custom components with Tailwind CSS
- **Database**: PostgreSQL (Prisma Postgres)
- **ORM**: Prisma
- **Password Hashing**: bcryptjs
- **Email Service**: Nodemailer + Hostinger SMTP
- **Toast Notifications**: react-hot-toast
- **TypeScript**: Full type safety

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── auth/
│   │       ├── register/
│   │       │   └── route.ts          # Registration endpoint
│   │       └── verify-email/
│   │           └── route.ts          # Email verification endpoint
│   ├── create-account/
│   │   └── page.tsx                  # Sign-up page
│   └── login/
│       └── page.tsx                  # Login page (with verification msg)
├── components/
│   ├── forms/
│   │   └── SignUpForm.tsx            # Multi-step sign-up form
│   └── ui/
│       ├── Button.tsx                # Button component
│       └── Input.tsx                 # Input component
├── constants/
│   └── countries.ts                  # Country codes & currencies
└── schemas/
    └── validation.schema.ts          # Yup validation schemas

prisma/
└── schema.prisma                     # Database schema

.env                                  # Environment variables
```
