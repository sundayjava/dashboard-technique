# Email Configuration Guide

## Problem Identified

The OTP emails are not being sent because:
1. Email server configuration may be missing or incorrect in `.env` file
2. The system was previously configured to silently fail (just log) when SMTP wasn't configured
3. No clear error messages were shown to help diagnose the issue

## Changes Made

### 1. Updated Email Library (`src/lib/email.ts`)
- Now throws proper errors when SMTP is not configured
- Provides detailed error logging showing which environment variables are missing
- No longer silently fails - will return error to frontend

### 2. Updated OTP Generation Endpoint (`src/app/api/transfer/otp/generate/route.ts`)
- Better error handling for email sending failures
- Cleans up OTP records if email fails to send
- Returns detailed error messages to frontend

### 3. Created Email Test Script (`scripts/test-email.ts`)
- Diagnostic tool to test your email configuration
- Checks all required environment variables
- Verifies SMTP connection
- Sends a test email

## Required Environment Variables

Add these to your `.env.local` or `.env` file:

```env
# Email Configuration
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_AUTH_USER=your-email@gmail.com
EMAIL_SERVER_AUTH_PASSWORD=your-app-password
APP_NAME=Acredis Finance
```

## Gmail Setup (Recommended)

### Step 1: Enable 2-Factor Authentication
1. Go to https://myaccount.google.com/security
2. Enable "2-Step Verification" if not already enabled

### Step 2: Generate App Password
1. Go to https://myaccount.google.com/apppasswords
2. Select app: "Mail"
3. Select device: "Other (Custom name)" → Enter "Acredis Finance"
4. Click "Generate"
5. Copy the 16-character password (remove spaces)
6. Use this as `EMAIL_SERVER_AUTH_PASSWORD`

### Step 3: Configure Environment Variables
```env
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_AUTH_USER=your-gmail@gmail.com
EMAIL_SERVER_AUTH_PASSWORD=abcd efgh ijkl mnop  # Use the app password (remove spaces)
```

## Other Email Providers

### Outlook/Office 365
```env
EMAIL_SERVER_HOST=smtp-mail.outlook.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_AUTH_USER=your-email@outlook.com
EMAIL_SERVER_AUTH_PASSWORD=your-password
```

### Yahoo Mail
```env
EMAIL_SERVER_HOST=smtp.mail.yahoo.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_AUTH_USER=your-email@yahoo.com
EMAIL_SERVER_AUTH_PASSWORD=your-app-password  # Generate app password in settings
```

### Custom SMTP Server
```env
EMAIL_SERVER_HOST=smtp.yourdomain.com
EMAIL_SERVER_PORT=587  # or 465 for SSL
EMAIL_SERVER_AUTH_USER=noreply@yourdomain.com
EMAIL_SERVER_AUTH_PASSWORD=your-password
```

## Testing Your Configuration

### Method 1: Use the Test Script
```bash
npx ts-node scripts/test-email.ts your-email@example.com
```

This will:
- ✅ Check all environment variables
- ✅ Test SMTP connection
- ✅ Send a test email
- ✅ Show detailed error messages if anything fails

### Method 2: Test in Application
1. Navigate to international transfer page
2. Fill in transfer details to Step 4
3. Click "Send OTP to Email"
4. Check browser console and server logs for detailed errors
5. Check your email inbox (including spam folder)

## Troubleshooting

### "SMTP connection failed" Error
- **Gmail**: Make sure you're using an App Password, not your regular password
- **All providers**: Check firewall isn't blocking port 587 or 465
- **Verify credentials**: Username and password are correct

### "Authentication failed" Error
- Double-check EMAIL_SERVER_AUTH_USER and EMAIL_SERVER_AUTH_PASSWORD
- For Gmail: Ensure 2FA is enabled and you're using App Password
- For other providers: Check if app-specific passwords are required

### Emails going to spam
- Set up SPF, DKIM, and DMARC records for your domain
- Use a verified email address as sender
- Consider using a transactional email service (SendGrid, Mailgun, etc.)

### "Email would be sent (SMTP not configured)"
- This message is now obsolete after the update
- If you still see it, clear your Next.js cache: `rm -rf .next`
- Restart your development server

## Production Recommendations

For production, consider using a dedicated transactional email service:

### SendGrid
```env
EMAIL_SERVER_HOST=smtp.sendgrid.net
EMAIL_SERVER_PORT=587
EMAIL_SERVER_AUTH_USER=apikey
EMAIL_SERVER_AUTH_PASSWORD=your-sendgrid-api-key
```

### Mailgun
```env
EMAIL_SERVER_HOST=smtp.mailgun.org
EMAIL_SERVER_PORT=587
EMAIL_SERVER_AUTH_USER=postmaster@your-domain.mailgun.org
EMAIL_SERVER_AUTH_PASSWORD=your-mailgun-smtp-password
```

### Amazon SES
```env
EMAIL_SERVER_HOST=email-smtp.us-east-1.amazonaws.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_AUTH_USER=your-ses-smtp-username
EMAIL_SERVER_AUTH_PASSWORD=your-ses-smtp-password
```

## Verifying the Fix

After configuring your email settings:

1. **Restart your development server**:
   ```bash
   # Stop the current server (Ctrl+C)
   npm run dev
   ```

2. **Test the OTP feature**:
   - Log in as a user
   - Go to international transfer
   - Proceed to Step 4
   - Click "Send OTP to Email"
   - You should now see proper error messages if configuration is wrong
   - If configured correctly, you'll receive the OTP email

3. **Check server logs**:
   - Look for `✅ Email sent successfully` message
   - Or detailed error messages showing what's wrong

## Security Notes

- **Never commit `.env.local` or `.env` to version control**
- Add these files to `.gitignore`
- Use environment variables in production (Vercel, Heroku, etc.)
- For Gmail, always use App Passwords (never your account password)
- Rotate passwords regularly
- Use different passwords for development and production

## Need Help?

If you're still experiencing issues:

1. Run the test script: `npx ts-node scripts/test-email.ts your-email@example.com`
2. Check the detailed error output
3. Verify all environment variables are set correctly
4. Check server logs for `❌ SMTP Configuration Missing` or `❌ Email sending failed`
5. Ensure `.env.local` or `.env` file is in the project root directory
