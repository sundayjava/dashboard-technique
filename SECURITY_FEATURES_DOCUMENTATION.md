# Security Features Documentation

## Overview
This document covers three interconnected security features:
1. **Change Password** - Allows users to update their login password
2. **Change Transaction PIN** - Allows users to update their 4-digit transaction PIN  
3. **Activity Log** - Audit trail of all security-related activities

All security changes are automatically logged and trigger notifications.

---

## 1. Change Password Feature

### Purpose
Allows authenticated users to change their account password with proper validation and security measures.

### Location
- **Page**: `/dashboard/account/change-password`
- **API**: `/api/change-password`

### UI Features
1. **Three Password Fields**:
   - Current Password (with validation)
   - New Password (minimum 8 characters)
   - Confirm New Password (must match new password)

2. **Eye/EyeOff Toggles**: 
   - Each password field has individual visibility toggle
   - State managed separately: `showPasswords.current`, `showPasswords.new`, `showPasswords.confirm`

3. **Real-time Validation**:
   - Minimum 8 characters for new password
   - New password must be different from current password
   - Confirmation must match new password

4. **Security Notice**:
   - Blue alert banner warning about automatic logout after password change
   - Appears before submission

5. **Password Security Tips**:
   - Best practices section at bottom of page
   - Recommendations for strong passwords

6. **Auto-logout Flow**:
   - Success message displays for 2 seconds
   - localStorage cleared automatically
   - Redirects to login page

### API Endpoint

**POST** `/api/change-password`

**Request Body**:
```json
{
  "userId": "cmk...",
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

**Response**:
```json
{
  "message": "Password changed successfully"
}
```

**Error Responses**:
```json
// Missing fields
{
  "error": "userId, currentPassword, and newPassword are required"
}

// Short password
{
  "error": "New password must be at least 8 characters long"
}

// User not found
{
  "error": "User not found"
}

// Wrong current password
{
  "error": "Current password is incorrect"
}

// Same as old password
{
  "error": "New password must be different from the current password"
}
```

### Backend Logic

1. **Validation**:
   ```typescript
   - Check all required fields present
   - Verify new password length >= 8
   - Find user by userId
   ```

2. **Verification**:
   ```typescript
   const isValid = await bcrypt.compare(currentPassword, user.password);
   if (!isValid) throw error;
   ```

3. **Password Hash**:
   ```typescript
   const hashedPassword = await bcrypt.hash(newPassword, 12);
   ```

4. **Database Update**:
   ```typescript
   await prisma.user.update({
     where: { id: userId },
     data: { password: hashedPassword }
   });
   ```

5. **Activity Logging**:
   ```typescript
   await prisma.activityLog.create({
     data: {
       userId,
       action: "PASSWORD_CHANGED",
       description: "User changed their password",
       ipAddress: headers.get('x-forwarded-for') || headers.get('x-real-ip'),
       userAgent: headers.get('user-agent')
     }
   });
   ```

6. **Notification Creation**:
   ```typescript
   await prisma.notification.create({
     data: {
       userId,
       type: "SECURITY",
       title: "Password Changed",
       message: "Your password was successfully changed. If you didn't make this change, contact support immediately.",
       link: "/dashboard/account/activity-log"
     }
   });
   ```

### Security Measures
- Uses bcrypt with 12 salt rounds
- Captures IP address from `x-forwarded-for` or `x-real-ip` headers
- Captures user agent for device tracking
- Creates audit log entry
- Sends security notification
- Forces logout after password change

---

## 2. Change Transaction PIN Feature

### Purpose
Allows users to change their 4-digit transaction PIN used for authorizing financial transactions.

### Location
- **Page**: `/dashboard/account/change-pin`
- **API**: `/api/change-pin`

### UI Features

1. **4-Digit PIN Input Sets** (3 sets total):
   - Current PIN (4 boxes)
   - New PIN (4 boxes)
   - Confirm New PIN (4 boxes)

2. **Advanced Input UX**:
   ```typescript
   - Auto-focus next input on digit entry
   - Backspace: clear current or move to previous
   - Arrow keys: navigate between inputs
   - Only accepts single digits (0-9)
   - Password-type inputs for security
   - Large centered boxes (w-14 h-14)
   ```

3. **State Management**:
   ```typescript
   currentPin: ['', '', '', '']
   newPin: ['', '', '', '']
   confirmPin: ['', '', '', '']
   ```

4. **Refs for Focus Management**:
   ```typescript
   currentPinRefs: useRef<(HTMLInputElement | null)[]>([])
   newPinRefs: useRef<(HTMLInputElement | null)[]>([])
   confirmPinRefs: useRef<(HTMLInputElement | null)[]>([])
   ```

5. **Keyboard Navigation**:
   ```typescript
   const handleKeyDown = (e, index, pinArray, setPinArray, refs) => {
     if (e.key === 'Backspace' && !pinArray[index] && index > 0) {
       refs.current[index - 1]?.focus();
     } else if (e.key === 'ArrowLeft' && index > 0) {
       refs.current[index - 1]?.focus();
     } else if (e.key === 'ArrowRight' && index < 3) {
       refs.current[index + 1]?.focus();
     }
   };
   ```

### API Endpoint

**POST** `/api/change-pin`

**Request Body**:
```json
{
  "userId": "cmk...",
  "currentPin": "1234",
  "newPin": "5678"
}
```

**Response**:
```json
{
  "message": "Transaction PIN changed successfully"
}
```

**Error Responses**:
```json
// Missing fields
{
  "error": "userId, currentPin, and newPin are required"
}

// Invalid format
{
  "error": "PINs must be exactly 4 digits"
}

// User not found
{
  "error": "User not found"
}

// Wrong current PIN
{
  "error": "Current PIN is incorrect"
}

// Same as old PIN
{
  "error": "New PIN must be different from the current PIN"
}
```

### Backend Logic

1. **Validation**:
   ```typescript
   const pinRegex = /^\d{4}$/;
   if (!pinRegex.test(currentPin) || !pinRegex.test(newPin)) {
     throw error("PINs must be exactly 4 digits");
   }
   ```

2. **Verification**:
   ```typescript
   const isValid = await bcrypt.compare(currentPin, user.transactionPin);
   if (!isValid) throw error;
   ```

3. **PIN Hash**:
   ```typescript
   const hashedPin = await bcrypt.hash(newPin, 12);
   ```

4. **Database Update**:
   ```typescript
   await prisma.user.update({
     where: { id: userId },
     data: { transactionPin: hashedPin }
   });
   ```

5. **Activity Logging**:
   ```typescript
   await prisma.activityLog.create({
     data: {
       userId,
       action: "PIN_CHANGED",
       description: "User changed their transaction PIN",
       ipAddress: headers.get('x-forwarded-for') || headers.get('x-real-ip'),
       userAgent: headers.get('user-agent')
     }
   });
   ```

6. **Notification Creation**:
   ```typescript
   await prisma.notification.create({
     data: {
       userId,
       type: "SECURITY",
       title: "Transaction PIN Changed",
       message: "Your transaction PIN was successfully changed. If you didn't make this change, contact support immediately.",
       link: "/dashboard/account/activity-log"
     }
   });
   ```

### Security Measures
- Regex validation for 4-digit numeric format: `/^\d{4}$/`
- bcrypt hashing with 12 salt rounds
- IP address and user agent logging
- Activity log creation
- Security notification sent
- Prevents reusing same PIN

---

## 3. Activity Log Feature

### Purpose
Provides a comprehensive audit trail of all user activities, especially security-related events.

### Location
- **Page**: `/dashboard/account/activity-log`
- **API**: `/api/activity-log`

### UI Features

1. **Activity List Display**:
   - Chronological list (newest first)
   - Color-coded by action type
   - Icons for each action type
   - Relative timestamps ("2 hours ago", "3 days ago")
   - Full date/time for older entries

2. **Filter System**:
   ```typescript
   Filters: ALL, LOGIN, LOGOUT, PASSWORD_CHANGED, PIN_CHANGED, 
            PROFILE_UPDATED, KYC_SUBMITTED, TRANSACTION
   
   - Active filter highlighted with brand color (#c1ff72)
   - Resets offset when filter changes
   ```

3. **Action Color Coding**:
   ```typescript
   LOGIN: green (bg-green-100 text-green-800)
   LOGOUT: gray
   PASSWORD_CHANGED: blue  
   PIN_CHANGED: purple
   PROFILE_UPDATED: yellow
   KYC_SUBMITTED: orange
   TRANSACTION: cyan
   DEFAULT: gray
   ```

4. **Metadata Display**:
   - IP Address (with MapPin icon)
   - Device Type (Mobile/Tablet/Desktop with Smartphone icon)
   - Browser Name (Chrome/Firefox/Safari/Edge with Monitor icon)

5. **Pagination**:
   ```typescript
   - Default: 50 records per page
   - Previous/Next buttons
   - Shows "X - Y of Z" total
   - Disabled state when at boundaries
   ```

6. **Empty States**:
   - No activity: "Your account activity will appear here"
   - Filter has no results: "Try selecting a different filter"

7. **Security Notice**:
   - Yellow alert banner at bottom
   - Reminds users to review logs regularly
   - Advises to change password if suspicious activity found

### API Endpoint

**GET** `/api/activity-log`

**Query Parameters**:
```typescript
userId: string (required)
limit: number (default: 50)
offset: number (default: 0)
action: string (optional - specific action type or "ALL")
```

**Example Request**:
```
GET /api/activity-log?userId=cmk...&limit=50&offset=0&action=PASSWORD_CHANGED
```

**Response**:
```json
{
  "logs": [
    {
      "id": "log_123",
      "action": "PASSWORD_CHANGED",
      "description": "User changed their password",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      "createdAt": "2024-01-20T10:30:00Z"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

### Backend Logic

1. **Query Construction**:
   ```typescript
   const where: any = { userId };
   
   if (action && action !== 'ALL') {
     where.action = action;
   }
   ```

2. **Fetch Logs**:
   ```typescript
   const logs = await prisma.activityLog.findMany({
     where,
     orderBy: { createdAt: 'desc' },
     take: limit,
     skip: offset
   });
   ```

3. **Count Total**:
   ```typescript
   const total = await prisma.activityLog.count({ where });
   ```

4. **Response Format**:
   ```typescript
   return {
     logs,
     total,
     limit,
     offset
   };
   ```

### Helper Function

The API exports a reusable helper for creating activity logs:

```typescript
export async function createActivityLog(
  userId: string,
  action: string,
  description: string,
  request: NextRequest,
  metadata?: any
) {
  const headers = request.headers;
  const ipAddress = headers.get('x-forwarded-for')?.split(',')[0] || 
                    headers.get('x-real-ip') || 
                    'unknown';
  const userAgent = headers.get('user-agent') || 'unknown';

  return await prisma.activityLog.create({
    data: {
      userId,
      action,
      description,
      ipAddress,
      userAgent,
      metadata: metadata ? JSON.stringify(metadata) : null
    }
  });
}
```

**Usage in Other APIs**:
```typescript
import { createActivityLog } from '@/app/api/activity-log/route';

// In password change API
await createActivityLog(
  userId,
  'PASSWORD_CHANGED',
  'User changed their password',
  request
);
```

### Activity Log Actions

| Action | Description | Triggered By |
|--------|-------------|--------------|
| `LOGIN` | User logged in | Login API |
| `LOGOUT` | User logged out | Logout action |
| `PASSWORD_CHANGED` | Password updated | Change password API |
| `PIN_CHANGED` | Transaction PIN updated | Change PIN API |
| `PROFILE_UPDATED` | Profile information changed | Profile update API |
| `KYC_SUBMITTED` | KYC documents submitted | KYC submission API |
| `TRANSACTION` | Financial transaction performed | Transaction APIs |

### Device Type Detection

```typescript
function getDeviceType(userAgent: string | null): string {
  if (!userAgent) return 'Unknown Device';
  if (/mobile/i.test(userAgent)) return 'Mobile Device';
  if (/tablet/i.test(userAgent)) return 'Tablet';
  return 'Desktop';
}
```

### Browser Detection

```typescript
function getBrowserName(userAgent: string | null): string {
  if (!userAgent) return 'Unknown Browser';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  return 'Other Browser';
}
```

### Time Formatting

```typescript
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
```

---

## Database Schema

### ActivityLog Model

```prisma
model ActivityLog {
  id          String       @id @default(cuid())
  userId      String
  action      String       // Action type identifier
  description String       @db.Text
  ipAddress   String?      // Source IP address
  userAgent   String?      @db.Text // Browser/device info
  metadata    Json?        // Additional data (optional)
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime     @default(now())

  @@index([userId])
  @@index([createdAt])
  @@index([action])
  @@map("activity_logs")
}
```

**Indexes**:
- `userId`: Fast lookup of user's activities
- `createdAt`: Efficient chronological sorting
- `action`: Quick filtering by action type

**Relations**:
- `User.activityLogs`: One-to-many (cascade delete when user deleted)

---

## Integration Flow

### Example: Password Change Flow

1. **User navigates to** `/dashboard/account/change-password`
2. **Enters credentials**:
   - Current password
   - New password (min 8 chars)
   - Confirmation
3. **Client validates**:
   - All fields filled
   - New password meets requirements
   - Passwords match
4. **POST to** `/api/change-password`:
   ```json
   {
     "userId": "cmk...",
     "currentPassword": "old123",
     "newPassword": "new456"
   }
   ```
5. **API processes**:
   - Verifies current password with bcrypt
   - Hashes new password (12 rounds)
   - Updates database
   - **Creates ActivityLog entry**
   - **Creates Notification**
6. **Success response returned**
7. **Client displays success** for 2 seconds
8. **Auto-logout**:
   - `localStorage.clear()`
   - `router.push('/login')`
9. **User checks activity log** to confirm change

### Example: Activity Log Check

1. **User navigates to** `/dashboard/account/activity-log`
2. **Page fetches logs**:
   ```
   GET /api/activity-log?userId=cmk...&limit=50&offset=0
   ```
3. **API returns**:
   ```json
   {
     "logs": [...],
     "total": 150,
     "limit": 50,
     "offset": 0
   }
   ```
4. **Page renders**:
   - List of activities with icons and colors
   - IP addresses and device info
   - Relative timestamps
   - Pagination controls
5. **User filters by action** (e.g., "PASSWORD_CHANGED")
6. **Offset resets**, new request sent
7. **Filtered results displayed**

---

## Security Best Practices

### Password Changes
1. **Always require current password verification**
2. **Enforce minimum length** (8+ characters)
3. **Hash with bcrypt** (12 salt rounds minimum)
4. **Log the change** with IP and user agent
5. **Notify user immediately**
6. **Force logout** to ensure new password used

### PIN Changes
1. **Validate format strictly** (exactly 4 digits)
2. **Verify current PIN** before allowing change
3. **Prevent PIN reuse**
4. **Hash PIN like passwords** (bcrypt, not plain storage)
5. **Log all attempts** (success and failure)
6. **Send security alerts**

### Activity Logging
1. **Log ALL security events**
2. **Capture context**: IP, user agent, timestamp
3. **Index for performance** (userId, createdAt, action)
4. **Allow filtering and searching**
5. **Paginate for large datasets**
6. **Cascade delete** with user accounts
7. **Consider data retention policies**

### IP Address Capture
```typescript
// Best practice: Check multiple headers
const ipAddress = 
  headers.get('x-forwarded-for')?.split(',')[0] ||  // Proxy/load balancer
  headers.get('x-real-ip') ||                        // Nginx
  request.socket?.remoteAddress ||                   // Direct connection
  'unknown';
```

### User Agent Parsing
```typescript
// Store full user agent for detailed analysis
const userAgent = headers.get('user-agent') || 'unknown';

// Parse for display
const browser = detectBrowser(userAgent);
const device = detectDevice(userAgent);
const os = detectOS(userAgent);
```

---

## Error Handling

### Common Error Scenarios

1. **Invalid Credentials**:
   ```typescript
   return NextResponse.json(
     { error: 'Current password is incorrect' },
     { status: 401 }
   );
   ```

2. **Validation Failures**:
   ```typescript
   return NextResponse.json(
     { error: 'New password must be at least 8 characters long' },
     { status: 400 }
   );
   ```

3. **Database Errors**:
   ```typescript
   catch (error) {
     console.error('Error changing password:', error);
     return NextResponse.json(
       { error: 'Failed to change password' },
       { status: 500 }
     );
   }
   ```

4. **User Not Found**:
   ```typescript
   if (!user) {
     return NextResponse.json(
       { error: 'User not found' },
       { status: 404 }
     );
   }
   ```

---

## Testing Checklist

### Change Password
- [ ] Verify current password validation works
- [ ] Test minimum length enforcement (8 chars)
- [ ] Confirm passwords must match
- [ ] Ensure new password can't equal current
- [ ] Check bcrypt hashing (12 rounds)
- [ ] Verify activity log created
- [ ] Confirm notification sent
- [ ] Test auto-logout after 2 seconds
- [ ] Verify can login with new password
- [ ] Test error messages for all failure cases

### Change PIN
- [ ] Test 4-digit validation (exactly 4 digits)
- [ ] Verify only numbers accepted
- [ ] Test current PIN verification
- [ ] Ensure new PIN can't equal current
- [ ] Check auto-focus behavior
- [ ] Test backspace navigation
- [ ] Test arrow key navigation
- [ ] Verify bcrypt hashing
- [ ] Confirm activity log created
- [ ] Check notification sent

### Activity Log
- [ ] Verify logs appear chronologically
- [ ] Test pagination (Previous/Next)
- [ ] Check all filters work correctly
- [ ] Verify IP address captured
- [ ] Confirm user agent stored
- [ ] Test device type detection
- [ ] Test browser name detection
- [ ] Check relative time formatting
- [ ] Verify empty state messages
- [ ] Test with large datasets (100+ logs)
- [ ] Confirm proper color coding
- [ ] Test responsive design

---

## Future Enhancements

### Planned Features
1. **Export Activity Log to CSV**
2. **Date range filtering** for logs
3. **Suspicious activity detection** (unusual IPs, multiple failed attempts)
4. **Email alerts** for security changes
5. **2FA/MFA** integration
6. **Account lockout** after failed attempts
7. **Password strength meter** in UI
8. **PIN biometric unlock** option
9. **Geolocation** from IP addresses
10. **Activity log search** functionality

### Security Improvements
1. **Rate limiting** on password/PIN change APIs
2. **CSRF protection** for sensitive operations
3. **Password history** (prevent reusing last 5 passwords)
4. **PIN complexity requirements** (no sequential digits, no repeated digits)
5. **Session invalidation** across all devices on password change
6. **Failed attempt tracking** and alerts
7. **IP address hashing** for privacy compliance (GDPR)
8. **Audit log immutability** (write-only, no edits/deletes)

---

## API Reference Summary

### Change Password
- **Endpoint**: `POST /api/change-password`
- **Auth**: Required (userId in body)
- **Rate Limit**: Consider 5 requests/hour
- **Body**: `{ userId, currentPassword, newPassword }`
- **Success**: `200 { message }`
- **Errors**: `400, 401, 404, 500`

### Change PIN
- **Endpoint**: `POST /api/change-pin`
- **Auth**: Required (userId in body)
- **Rate Limit**: Consider 5 requests/hour
- **Body**: `{ userId, currentPin, newPin }`
- **Success**: `200 { message }`
- **Errors**: `400, 401, 404, 500`

### Activity Log
- **Endpoint**: `GET /api/activity-log`
- **Auth**: Required (userId in query)
- **Rate Limit**: 100 requests/minute
- **Query**: `userId, limit?, offset?, action?`
- **Success**: `200 { logs, total, limit, offset }`
- **Errors**: `400, 500`

---

## Troubleshooting

### Common Issues

1. **Password change not persisting**:
   - Check bcrypt is being used (not plain text)
   - Verify database update succeeded
   - Confirm Prisma client regenerated after schema changes

2. **Activity log not showing**:
   - Verify ActivityLog model in schema
   - Run `npx prisma db push`
   - Run `npx prisma generate`
   - Check database for `activity_logs` table

3. **IP address showing as "unknown"**:
   - Check reverse proxy configuration
   - Verify `x-forwarded-for` header set
   - Consider running app behind Nginx/Apache

4. **Auto-logout not working**:
   - Verify `localStorage.clear()` called
   - Check redirect logic in `router.push()`
   - Confirm 2-second timeout completes

5. **PIN input not auto-focusing**:
   - Check refs properly initialized
   - Verify focus logic in `handlePinChange`
   - Ensure index bounds checked (< 3)

---

## Conclusion

These three security features work together to provide:
- **User Control**: Easy password and PIN management
- **Transparency**: Full visibility into account activities  
- **Accountability**: Comprehensive audit trail with context
- **Security**: Proper hashing, logging, and notifications

All changes are logged, notified, and traceable for maximum security and user confidence.
