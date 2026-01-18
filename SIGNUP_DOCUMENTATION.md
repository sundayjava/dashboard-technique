# Sign Up Implementation Documentation

## Overview
This document describes the multi-step sign-up implementation for Acredis Finance, featuring a 3-step registration process with email verification, secure password handling, and comprehensive validation.

## Features Implemented

### 1. Multi-Step Form Flow
The sign-up process is divided into three logical steps:

#### Step 1: Basic Information
- **Authorization Code**: Auto-generated (format: AC-XXXXXXXX), non-editable
- **Email**: Valid email address with verification
- **Phone Number**: Country code dropdown + phone number input
  - 50+ country codes supported with flags
  - Validation for 6-15 digit phone numbers

#### Step 2: Account Details
- **Account Type**: Dropdown with options:
  - Personal Account
  - Business Account
  - Corporate Account
- **Currency**: Dropdown with 30+ currencies including:
  - Major currencies (USD, EUR, GBP)
  - African currencies (NGN, KES, ZAR, GHS)
  - Asian currencies (INR, CNY, JPY)
  - And many more

#### Step 3: Security Setup
- **Password**: Minimum 8 characters with complexity requirements
  - At least one lowercase letter
  - At least one uppercase letter
  - At least one number
- **Confirm Password**: Must match password
- **Transaction PIN**: 4-6 digit numeric PIN
- **Confirm Transaction PIN**: Must match PIN

### 2. State Management
- Uses React Hook Form with Yup validation
- Form data persists across steps using React state
- Each step validates independently before proceeding
- Back button preserves previously entered data

### 3. Validation
Comprehensive validation using Yup schemas:
- Email format validation
- Password strength requirements
- Phone number format validation
- Transaction PIN numeric validation
- Match validation for password and PIN confirmations

### 4. Database Schema
Updated Prisma schema includes:
```prisma
model User {
  id                   String      @id @default(cuid())
  email                String      @unique
  emailVerified        Boolean     @default(false)
  emailVerificationToken String?   @unique
  name                 String?
  password             String
  transactionPin       String
  phoneNumber          String
  countryCode          String
  accountType          AccountType @default(PERSONAL)
  currency             String
  authorizationCode    String      @unique
  avatar               String?
  role                 Role        @default(USER)
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt
}

enum AccountType {
  PERSONAL
  BUSINESS
  CORPORATE
}
```

### 5. Email Verification System
- Sends verification email using Nodemailer
- Generates secure verification token (crypto.randomBytes)
- Professional HTML email template
- Verification link expires (handled by database)
- Redirects to login page with success message

### 6. Security Features
- Passwords hashed using bcryptjs (12 salt rounds)
- Transaction PINs hashed separately
- Email verification tokens are unique and one-time use
- Authorization codes are unique per user

## API Endpoints

### POST /api/auth/register
**Request Body:**
```json
{
  "authorizationCode": "AC-ABCD1234",
  "email": "user@example.com",
  "phoneNumber": "8012345678",
  "countryCode": "+234",
  "accountType": "PERSONAL",
  "currency": "USD",
  "password": "SecurePass123",
  "transactionPin": "1234"
}
```

**Response (Success):**
```json
{
  "message": "Account created successfully. Please check your email to verify your account.",
  "userId": "clx..."
}
```

**Response (Error):**
```json
{
  "error": "User with this email already exists"
}
```

### GET /api/auth/verify-email?token={token}
Verifies user email and redirects to login page with success message.

## Files Created/Modified

### New Files
1. `/src/components/forms/SignUpForm.tsx` - Main sign-up form component
2. `/src/constants/countries.ts` - Country codes and currencies data
3. `/src/app/api/auth/register/route.ts` - Registration API endpoint
4. `/src/app/api/auth/verify-email/route.ts` - Email verification endpoint

### Modified Files
1. `/prisma/schema.prisma` - Updated User model with new fields
2. `/src/schemas/validation.schema.ts` - Added sign-up validation schemas
3. `/src/app/create-account/page.tsx` - Integrated SignUpForm component
4. `/src/app/login/page.tsx` - Added verification success message

## Environment Variables
Added to `.env`:
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=postgres://...
EMAIL_SERVER_HOST=smtp.hostinger.com
EMAIL_SERVER_PORT=465
EMAIL_SERVER_AUTH_USER=support@crestinvestmentcat.com
EMAIL_SERVER_AUTH_PASSWORD=...
```

## Dependencies Added
- `bcryptjs` - Password hashing
- `nodemailer` - Email sending
- `@types/bcryptjs` - TypeScript types
- `@types/nodemailer` - TypeScript types
- `dotenv` - Environment variable loading

## Usage Instructions

### Testing the Sign-Up Flow

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to the sign-up page:**
   ```
   http://localhost:3000/create-account
   ```

3. **Complete the form:**
   - Step 1: Note the auto-generated authorization code, enter email and phone
   - Step 2: Select account type and currency
   - Step 3: Create password and transaction PIN

4. **Check email:**
   - Look for verification email
   - Click the verification link
   - Redirected to login page with success message

### Database Commands

```bash
# Generate Prisma client
npm run db:generate

# Push schema changes to database
npm run db:push

# Open Prisma Studio (database GUI)
npm run db:studio
```

## UI/UX Features

- **Progress Indicator**: Shows current step (1/3, 2/3, 3/3) with visual progress bar
- **Border Radius**: All inputs use `rounded-md` (medium border radius)
- **Validation Feedback**: Real-time error messages below each field
- **Responsive Design**: Mobile-friendly layout
- **Loading States**: "Creating Account..." during submission
- **Toast Notifications**: Success/error messages using react-hot-toast
- **Disabled States**: Authorization code field is disabled (auto-generated)

## Authorization Code Generation
The authorization code is automatically generated with format `AC-XXXXXXXX` where:
- Prefix: "AC-"
- 8 random alphanumeric characters (uppercase)
- Unique per user (validated in database)

## Future Enhancements
Potential improvements for future iterations:
1. Rate limiting on registration endpoint
2. CAPTCHA integration
3. Password strength meter UI
4. SMS verification in addition to email
5. Social authentication (Google, Facebook)
6. Two-factor authentication setup during registration
7. Terms and conditions acceptance checkbox
8. Profile picture upload
9. Referral code system
10. KYC (Know Your Customer) document upload

## Troubleshooting

### Common Issues

**Issue**: Email not sending
- Check EMAIL_SERVER_* environment variables
- Verify SMTP credentials
- Check firewall/network settings

**Issue**: Database connection error
- Ensure DATABASE_URL is correct
- Run `npm run db:push` to sync schema
- Check Prisma Postgres service status

**Issue**: TypeScript errors after schema changes
- Run `npm run db:generate` to regenerate Prisma client
- Restart TypeScript server in VS Code

**Issue**: Form validation not working
- Ensure react-hook-form and yup are installed
- Check browser console for errors
- Verify schema definitions in validation.schema.ts

## Security Considerations

1. **Password Storage**: Never stored in plain text, always bcrypt hashed
2. **Transaction PIN**: Separately hashed from password
3. **Email Tokens**: Single-use, cryptographically secure
4. **Authorization Codes**: Unique and validated
5. **Input Validation**: Server-side validation matches client-side
6. **SQL Injection**: Protected by Prisma ORM
7. **XSS Protection**: React automatically escapes user input

## Testing Checklist

- [ ] Form validates all required fields
- [ ] Step navigation works (Next/Back buttons)
- [ ] Email validation accepts valid emails only
- [ ] Phone number accepts only digits
- [ ] Country code dropdown shows all countries
- [ ] Currency dropdown shows all currencies
- [ ] Account type selection works
- [ ] Password strength requirements enforced
- [ ] Password confirmation matches
- [ ] Transaction PIN is 4-6 digits
- [ ] Transaction PIN confirmation matches
- [ ] Authorization code is auto-generated and unique
- [ ] Duplicate email shows error
- [ ] Duplicate authorization code shows error
- [ ] Email verification sends successfully
- [ ] Email verification link works
- [ ] Redirects to login after verification
- [ ] Loading states show during submission
- [ ] Error messages display properly
- [ ] Success toast appears on completion
- [ ] Data persists when going back
- [ ] Form resets after successful submission

---

**Created**: January 15, 2026  
**Version**: 1.0  
**Author**: Acredis Finance Development Team
