# Session Management System

## Overview

This application now implements a comprehensive session management system with automatic logout on inactivity and session expiration. This ensures enhanced security and prevents unauthorized access to user accounts.

## Key Features

### 1. **Session Expiration**
- Sessions automatically expire after **24 hours**
- JWT-like tokens are used to track session validity
- Expired sessions are automatically cleared

### 2. **Inactivity Timeout**
- Users are automatically logged out after **30 minutes of inactivity**
- Activity tracking includes: mouse movements, keyboard input, scrolling, touch, and clicks
- Inactivity timer resets with any user interaction

### 3. **Session Warnings**
- Users receive a warning **5 minutes** before session expiration
- Warning notification allows users to save their work
- Clear feedback about session status

### 4. **Automatic Token Management**
- Auth tokens are automatically included in all API requests
- Invalid/expired tokens trigger automatic logout
- Seamless session validation without manual intervention

## Configuration

### Session Timeouts

You can adjust the session timeouts in `/src/lib/session.ts`:

```typescript
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours (in milliseconds)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;   // 30 minutes (in milliseconds)
```

### Warning Time

Adjust when users are warned about expiration in your component:

```typescript
useSession({
  warningTime: 5 * 60 * 1000, // 5 minutes (default)
})
```

## Usage

### In Client Components

Use the `useSession` hook to protect pages and enable automatic logout:

```typescript
import { useSession } from '@/hooks/useSession';

export default function MyPage() {
  // Basic usage - redirects to /login on expiration
  useSession();
  
  // Advanced usage with options
  useSession({
    redirectTo: '/login',
    showNotification: true,
    warningTime: 5 * 60 * 1000,
    onSessionExpired: () => {
      console.log('Session expired - cleanup');
    }
  });
  
  return <div>Protected content</div>;
}
```

### Manual Session Management

```typescript
import { SessionManager } from '@/lib/session';

// Check if session is valid
const isValid = SessionManager.isSessionValid();

// Get current user
const user = SessionManager.getUser();

// Get auth token
const token = SessionManager.getToken();

// Manual logout
SessionManager.clearSession();

// Check time until expiration
const timeLeft = SessionManager.getTimeUntilExpiration();

// Update activity manually (automatic with useSession hook)
SessionManager.updateActivity();
```

### Protecting API Routes

Use the authentication middleware to protect API endpoints:

```typescript
import { authenticateRequest, requireAdmin } from '@/lib/auth-middleware';

// For any authenticated user
export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  
  if (!authResult.success) {
    return authResult.response; // Returns 401 error
  }
  
  const userId = authResult.user.userId;
  // ... proceed with authenticated logic
}

// For admin-only routes
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request);
  
  if (!authResult.success) {
    return authResult.response; // Returns 401 or 403 error
  }
  
  // ... proceed with admin logic
}
```

## How It Works

### 1. Login Flow
1. User submits credentials
2. Server validates and creates a session token
3. Token is stored in localStorage via `SessionManager`
4. Token is included in all subsequent API requests

### 2. Activity Tracking
1. `useSession` hook monitors user interactions
2. Activity events update the "last activity" timestamp
3. Session validity is checked every 30 seconds
4. Inactivity > 30 minutes triggers automatic logout

### 3. Session Validation
1. Each API request includes the auth token in the `Authorization` header
2. Server validates token signature and expiration
3. Invalid/expired tokens return 401 error
4. Axios interceptor catches 401 errors and triggers logout

### 4. Logout Flow
1. Session expiration detected (time-based or inactivity)
2. User data and token cleared from localStorage
3. Optional notification shown to user
4. User redirected to login page

## Security Best Practices

### Current Implementation
✅ Session tokens with expiration  
✅ Inactivity timeout  
✅ Automatic token validation  
✅ Secure token storage  
✅ HMAC signature verification  

### Recommendations for Production

1. **Use a proper JWT library**
   ```bash
   npm install jsonwebtoken
   ```
   
2. **Store JWT secret in environment variables**
   ```env
   JWT_SECRET=your-very-strong-secret-key-here
   ```

3. **Consider using HTTP-only cookies** instead of localStorage for token storage (more secure against XSS)

4. **Implement refresh tokens** for seamless session renewal without re-login

5. **Add CSRF protection** for state-changing operations

6. **Enable HTTPS** in production to encrypt token transmission

7. **Implement rate limiting** to prevent brute force attacks

8. **Add IP-based session validation** for enhanced security

## Customization Examples

### Longer Sessions for Admins

```typescript
// In session.ts, create separate session durations
export function createSessionToken(userId: string, email: string, role: string) {
  const duration = role === 'ADMIN' 
    ? 48 * 60 * 60 * 1000  // 48 hours for admins
    : 24 * 60 * 60 * 1000; // 24 hours for users
    
  // ... rest of implementation
}
```

### Custom Warning Messages

```typescript
useSession({
  onSessionExpired: () => {
    toast('Your session has ended. Please log in again.', {
      icon: '🔒',
      duration: 5000,
    });
  }
});
```

### Disable Inactivity Timeout for Specific Pages

```typescript
// For pages where users might be reading/viewing without interaction
const LONG_INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour

// In session.ts, make inactivity timeout configurable
SessionManager.setInactivityTimeout(LONG_INACTIVITY_TIMEOUT);
```

## Troubleshooting

### Session expires too quickly
- Check `SESSION_DURATION` in `/src/lib/session.ts`
- Verify system clock is correct
- Check browser localStorage is not being cleared

### User not logged out on inactivity
- Ensure `useSession` hook is used in protected components
- Check that activity events are being tracked
- Verify `INACTIVITY_TIMEOUT` is set correctly

### API requests failing with 401
- Check token is being included in request headers
- Verify axios interceptors are initialized (should be in `layout.tsx`)
- Check token hasn't expired server-side

### Session persists after logout
- Ensure `SessionManager.clearSession()` is called
- Check for cached data in other parts of the application
- Verify localStorage is being cleared properly

## Migration Notes

### For Existing Code

1. **Replace direct localStorage access:**
   ```typescript
   // Before
   const user = JSON.parse(localStorage.getItem('user'));
   
   // After
   const user = SessionManager.getUser();
   ```

2. **Add session hook to protected pages:**
   ```typescript
   // Add to all dashboard/protected pages
   useSession();
   ```

3. **Update API routes to validate tokens:**
   ```typescript
   // Add to protected API routes
   const authResult = await authenticateRequest(request);
   if (!authResult.success) return authResult.response;
   ```

## Files Modified/Created

### New Files
- `/src/lib/session.ts` - Session management utilities
- `/src/lib/auth-middleware.ts` - API authentication middleware
- `/src/lib/axios-config.ts` - Axios interceptor configuration
- `/src/hooks/useSession.ts` - React hook for session management

### Modified Files
- `/src/app/api/auth/login/route.ts` - Now generates session tokens
- `/src/components/forms/LoginForm.tsx` - Uses SessionManager
- `/src/app/layout.tsx` - Initializes axios interceptors
- `/src/app/dashboard/page.tsx` - Example using useSession hook
- `/src/app/api/admin/users/[id]/route.ts` - Example using auth middleware

## Environment Variables

Add to your `.env` file:

```env
# Session Management
JWT_SECRET=your-production-secret-key-minimum-32-characters-long
```

⚠️ **Important:** Never commit the JWT_SECRET to version control!

## Testing

### Test Inactivity Logout
1. Log in to the application
2. Leave the browser idle for 30 minutes
3. Verify automatic logout occurs

### Test Session Expiration
1. Modify `SESSION_DURATION` to 1 minute for testing
2. Log in and wait 1 minute
3. Verify session expires and user is logged out

### Test Warning Notification
1. Set `warningTime` to 1 minute
2. Set `SESSION_DURATION` to 2 minutes
3. Wait 1 minute after login
4. Verify warning notification appears

## Support

For issues or questions about session management:
1. Check the troubleshooting section above
2. Review the console for error messages
3. Ensure all dependencies are installed
4. Verify environment variables are set correctly
