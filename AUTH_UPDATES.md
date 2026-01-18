# Authentication System Updates - Testing Guide

## Changes Made

### 1. reCAPTCHA Relocation
**From:** PIN verification page  
**To:** Login form

**Why:** Better security by verifying users are human at the entry point (login), not after password validation.

### 2. Forgot Password Implementation
Complete password recovery flow with email-based reset tokens.

---

## Updated Files

### Login Flow
1. **[LoginForm.tsx](src/components/forms/LoginForm.tsx)**
   - Added reCAPTCHA v2 component
   - Added reCAPTCHA token state and validation
   - Submit button disabled until reCAPTCHA completed
   - Token sent with login request

2. **[login API](src/app/api/auth/login/route.ts)**
   - Added reCAPTCHA token verification
   - Validates token with Google API before checking credentials
   - Returns error if reCAPTCHA verification fails

3. **[verify-pin page](src/app/verify-pin/page.tsx)**
   - Removed all reCAPTCHA imports and references
   - Simplified to only handle 4-digit PIN input
   - No longer requires reCAPTCHA token

4. **[verify-pin API](src/app/api/auth/verify-pin/route.ts)**
   - Removed reCAPTCHA verification logic
   - Only validates PIN against hashed value in database

### Password Recovery Flow
5. **[forgot-password page](src/app/forgot-password/page.tsx)**
   - Email input form
   - Success state showing confirmation
   - Split-screen design matching login/signup
   - Links back to login

6. **[forgot-password API](src/app/api/auth/forgot-password/route.ts)**
   - Generates secure 32-byte reset token
   - Stores token with 1-hour expiry in database
   - Sends branded email with reset link
   - Prevents email enumeration (always returns success)

7. **[reset-password page](src/app/reset-password/page.tsx)**
   - Token validation on page load
   - New password and confirm password fields
   - Password strength requirements display
   - Eye toggles for password visibility
   - Real-time validation

8. **[reset-password API](src/app/api/auth/reset-password/route.ts)**
   - Validates reset token and expiry
   - Enforces password requirements
   - Hashes new password with bcrypt
   - Clears reset token after successful reset

9. **[validate-reset-token API](src/app/api/auth/validate-reset-token/route.ts)**
   - Checks if reset token exists and is not expired
   - Used by reset-password page on load

### Database
10. **[schema.prisma](prisma/schema.prisma)**
    - Added `passwordResetToken` (String?, unique)
    - Added `passwordResetExpiry` (DateTime?)
    - Migration applied with `npx prisma db push`

### Layout
11. **[layout.tsx](src/app/layout.tsx)**
    - Updated to hide header on `/forgot-password` and `/reset-password` pages

---

## Testing Instructions

### Test 1: Login with reCAPTCHA
1. Navigate to `/login`
2. Fill in email and password
3. **NEW:** reCAPTCHA challenge should appear below the "Remember me" checkbox
4. Complete the reCAPTCHA puzzle
5. Submit button should be disabled until reCAPTCHA is completed
6. Click "Sign In"
7. Should verify reCAPTCHA → check password → route based on role

**Expected:** Admin → `/admin/dashboard`, User → `/verify-pin`

### Test 2: PIN Verification (No reCAPTCHA)
1. Login as a regular user (not admin)
2. Should redirect to `/verify-pin`
3. **NEW:** No reCAPTCHA should appear on this page
4. Enter 4-digit PIN
5. Click "Continue to Dashboard"
6. Should verify PIN and navigate to `/dashboard`

**Expected:** No reCAPTCHA challenge, cleaner UI

### Test 3: Forgot Password Flow
1. Navigate to `/login`
2. Click "Forgot password?" link
3. Should redirect to `/forgot-password`
4. Enter email address
5. Click "Send Reset Link"
6. Should show success message
7. Check email inbox for reset link

**Expected:** Email with reset link (expires in 1 hour)

### Test 4: Reset Password
1. Click reset link from email (or navigate to `/reset-password?token=<token>`)
2. Should validate token and show password form
3. Enter new password (must meet requirements):
   - At least 8 characters
   - One uppercase letter
   - One lowercase letter
   - One number
   - One special character (@$!%*?&#)
4. Confirm password
5. Click "Reset Password"
6. Should redirect to `/login` with success message
7. Login with new password

**Expected:** Password reset successful, can login with new credentials

### Test 5: Expired/Invalid Token
1. Try to access `/reset-password?token=invalid-token`
2. Should show error and redirect to `/forgot-password`
3. For expired tokens (>1 hour old), should show same error

**Expected:** Graceful error handling

---

## Environment Variables Required

All already configured in `.env`:
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` - reCAPTCHA v2 site key
- `RECAPTCHA_SECRET_KEY` - reCAPTCHA v2 secret key
- `NEXT_PUBLIC_APP_URL` - Base URL for reset links (http://localhost:3000)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - Email configuration

---

## Database Changes

```sql
-- New fields added to users table:
ALTER TABLE users ADD COLUMN passwordResetToken TEXT UNIQUE;
ALTER TABLE users ADD COLUMN passwordResetExpiry TIMESTAMP;
```

Applied via: `npx prisma db push` ✅

---

## API Endpoints

### New
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/validate-reset-token` - Check if token is valid
- `POST /api/auth/reset-password` - Reset password with token

### Modified
- `POST /api/auth/login` - Now requires `recaptchaToken` in request body
- `POST /api/auth/verify-pin` - Removed `recaptchaToken` requirement

---

## Security Improvements

1. **reCAPTCHA at Login:** Prevents bot attacks at entry point
2. **Secure Token Generation:** Crypto.randomBytes(32) for reset tokens
3. **Token Expiry:** 1-hour window for password resets
4. **Email Enumeration Prevention:** Always returns success to forgot-password
5. **Password Requirements:** Enforced at API level + client validation
6. **Token Cleanup:** Reset tokens cleared after successful password change
7. **Unique Constraint:** passwordResetToken has unique constraint in database

---

## Email Template

The forgot-password email includes:
- Brand colors (#c1ff72 gradient)
- Clear call-to-action button
- Plain text link fallback
- Warning about 1-hour expiry
- Security notice to ignore if not requested

---

## Notes

- reCAPTCHA v2 uses checkbox challenges (image puzzles)
- Make sure to add `localhost` to reCAPTCHA admin console domains
- Reset tokens are 64 characters (32 bytes hex-encoded)
- Password hashing uses bcrypt with 12 salt rounds
- All password pages have consistent split-screen design

---

## Rollback Instructions

If needed, to revert changes:
1. Remove `passwordResetToken` and `passwordResetExpiry` from schema
2. Delete forgot-password and reset-password pages
3. Delete new API routes
4. Restore old LoginForm.tsx without reCAPTCHA
5. Restore old verify-pin with reCAPTCHA
6. Run `npx prisma db push`
