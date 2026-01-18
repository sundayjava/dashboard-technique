# Profile System Documentation

## Overview
This document describes the profile management system that allows users to complete their profile with personal information and upload avatars.

## Features

### 1. Profile Editing
- Edit personal information (Name, Phone Number, Date of Birth, Address)
- Upload profile picture/avatar (max 5MB)
- Email is read-only
- Profile completion status tracking

### 2. Avatar Display
- Shows uploaded avatar image if available
- Displays first letter of name in a colored circle if no avatar
- Consistent color based on name hash
- Sizes: sm (32px), md (40px), lg (64px), xl (96px)

### 3. Profile Completion Modal
- Automatically shows on login if profile is incomplete
- Can be dismissed (stored in localStorage)
- Redirects to profile page when "Complete Profile" is clicked
- Won't show again after profile is completed

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── profile/
│   │   │   └── route.ts           # Profile CRUD API
│   │   └── upload-avatar/
│   │       └── route.ts           # Avatar upload API
│   └── dashboard/
│       └── account/
│           └── profile/
│               └── page.tsx       # Profile editing page
├── components/
│   ├── modals/
│   │   └── ProfileCompletionModal.tsx  # Modal component
│   ├── ui/
│   │   └── Avatar.tsx            # Reusable avatar component
│   └── layout/
│       └── DashboardTopBar.tsx   # Updated to use Avatar component
└── public/
    └── uploads/
        └── avatars/              # Local storage for avatar images
```

## Database Schema

```prisma
model User {
  // ... other fields
  avatar           String?
  dateOfBirth      DateTime?
  address          String?
  profileCompleted Boolean   @default(false)
}
```

## API Endpoints

### GET /api/profile?userId={userId}
Fetch user profile information.

**Response:**
```json
{
  "user": {
    "id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "phoneNumber": "1234567890",
    "countryCode": "+1",
    "avatar": "/uploads/avatars/userId_timestamp.jpg",
    "dateOfBirth": "1990-01-01T00:00:00.000Z",
    "address": "123 Main St",
    "currency": "USD",
    "accountType": "PERSONAL",
    "profileCompleted": true,
    "createdAt": "..."
  }
}
```

### PUT /api/profile
Update user profile information.

**Request Body:**
```json
{
  "userId": "...",
  "name": "John Doe",
  "phoneNumber": "1234567890",
  "countryCode": "+1",
  "dateOfBirth": "1990-01-01",
  "address": "123 Main St"
}
```

**Response:**
```json
{
  "user": { /* updated user object */ }
}
```

### POST /api/upload-avatar
Upload user avatar image.

**Request:** multipart/form-data
- `avatar`: Image file (max 5MB)
- `userId`: User ID

**Response:**
```json
{
  "success": true,
  "avatarUrl": "/uploads/avatars/userId_timestamp.jpg"
}
```

## Usage Examples

### Using the Avatar Component

```tsx
import Avatar from '@/components/ui/Avatar';

function MyComponent({ user }) {
  return (
    <div>
      {/* With image */}
      <Avatar 
        src={user.avatar} 
        name={user.name} 
        size="lg" 
      />
      
      {/* Without image (shows initials) */}
      <Avatar 
        name="John Doe" 
        size="md" 
      />
    </div>
  );
}
```

### Checking Profile Completion

```tsx
// In your dashboard component
useEffect(() => {
  if (!user.profileCompleted) {
    // Show profile completion modal or redirect
    setShowProfileModal(true);
  }
}, [user]);
```

## File Upload Configuration

- **Max File Size:** 5MB
- **Allowed Types:** image/* (jpg, jpeg, png, gif, webp, etc.)
- **Storage Location:** `public/uploads/avatars/`
- **File Naming:** `{userId}_{timestamp}.{extension}`
- **Access URL:** `/uploads/avatars/{filename}`

## Profile Completion Logic

A profile is considered complete when:
1. User has a name
2. User has a phone number
3. User has an address
4. User has a date of birth
5. User has uploaded an avatar

The `profileCompleted` flag is automatically set to `true` when all these conditions are met.

## Modal Dismissal

The profile completion modal can be dismissed by:
1. Clicking "I'll do this later" button
2. Completing the profile
3. Clicking outside the modal

Once dismissed, it won't show again during that session (stored in localStorage as `profileModalDismissed`).

## Security Considerations

1. **File Validation:** File type and size are validated on the server
2. **User Authentication:** All API endpoints should verify user authentication
3. **File Access:** Files are stored in public folder but named with userId to prevent guessing
4. **Old File Cleanup:** When a new avatar is uploaded, the old one should be deleted (to be implemented)

## Future Enhancements

- [ ] Delete old avatar files when uploading new ones
- [ ] Image cropping/resizing before upload
- [ ] Cloud storage integration (AWS S3, Cloudinary)
- [ ] Profile picture approval workflow for admins
- [ ] Multiple profile pictures/gallery
- [ ] Image compression before upload
- [ ] WebP conversion for better performance

## Troubleshooting

### Avatar Not Displaying
- Check if the file exists in `public/uploads/avatars/`
- Verify the avatar URL is correct in the database
- Check file permissions

### Upload Fails
- Verify file size is under 5MB
- Check if the uploads directory has write permissions
- Ensure the file is a valid image format

### Profile Modal Not Showing
- Check `profileCompleted` flag in database
- Clear localStorage item `profileModalDismissed`
- Verify user object is passed to DashboardTopBar

## Testing

Test the following scenarios:
1. Upload a new avatar
2. Edit profile information
3. Complete an incomplete profile
4. Dismiss the profile modal
5. View profile on mobile devices
6. Try uploading files over 5MB (should fail)
7. Try uploading non-image files (should fail)
