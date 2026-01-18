# KYC (Know Your Customer) System Documentation

## Overview
Complete KYC verification system for identity verification in compliance with financial regulations.

## Features

### 1. **Multi-Step Verification Process**
- Personal information collection
- Address verification
- Identity document upload
- Selfie verification
- Additional financial information

### 2. **Document Support**
- Passport
- National ID Card
- Driver's License
- Residence Permit

### 3. **Status Management**
- **PENDING**: Submitted, awaiting review
- **UNDER_REVIEW**: Being reviewed by admin
- **APPROVED**: Verified and approved
- **REJECTED**: Rejected with reason
- **RESUBMIT_REQUIRED**: Needs corrections

### 4. **File Upload System**
- Document front image (required)
- Document back image (required for non-passport)
- Selfie with document (required)
- Max file size: 5MB
- Supported formats: JPG, PNG, WebP

### 5. **User Experience**
- Pre-filled data from user profile
- Real-time file preview
- Upload progress indicators
- Status-specific UI (approved, pending, rejected)
- Resubmission for rejected applications

## Database Schema

```prisma
model KYC {
  id                 String       @id @default(cuid())
  userId             String       @unique
  
  // Personal Information
  fullName           String
  dateOfBirth        DateTime
  nationality        String
  address            String       @db.Text
  city               String
  state              String
  postalCode         String
  country            String
  
  // Identity Document
  documentType       DocumentType
  documentNumber     String
  documentFrontImage String
  documentBackImage  String?
  
  // Selfie Verification
  selfieImage        String
  
  // Additional Information
  occupation         String?
  employerName       String?
  annualIncome       String?
  sourceOfFunds      String?
  
  // Verification Status
  status             KYCStatus    @default(PENDING)
  rejectionReason    String?      @db.Text
  verifiedBy         String?
  verifiedAt         DateTime?
  submittedAt        DateTime     @default(now())
  
  // Relations
  user               User         @relation(fields: [userId], references: [id])
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @updatedAt
}

enum DocumentType {
  PASSPORT
  NATIONAL_ID
  DRIVERS_LICENSE
  RESIDENCE_PERMIT
}

enum KYCStatus {
  PENDING
  UNDER_REVIEW
  APPROVED
  REJECTED
  RESUBMIT_REQUIRED
}
```

## API Endpoints

### GET /api/kyc
Fetch KYC submission for a user

**Query Parameters:**
- `userId` (required): User ID

**Response:**
```json
{
  "kyc": {
    "id": "string",
    "userId": "string",
    "fullName": "string",
    "status": "PENDING | UNDER_REVIEW | APPROVED | REJECTED | RESUBMIT_REQUIRED",
    ...
  },
  "message": "string"
}
```

### POST /api/kyc
Submit or resubmit KYC verification

**Body:**
```json
{
  "userId": "string",
  "fullName": "string",
  "dateOfBirth": "ISO date string",
  "nationality": "string",
  "address": "string",
  "city": "string",
  "state": "string",
  "postalCode": "string",
  "country": "string",
  "documentType": "PASSPORT | NATIONAL_ID | DRIVERS_LICENSE | RESIDENCE_PERMIT",
  "documentNumber": "string",
  "documentFrontImage": "URL string",
  "documentBackImage": "URL string (optional)",
  "selfieImage": "URL string",
  "occupation": "string (optional)",
  "employerName": "string (optional)",
  "annualIncome": "string (optional)",
  "sourceOfFunds": "string (optional)"
}
```

**Response:**
```json
{
  "kyc": { ... },
  "message": "KYC submitted successfully"
}
```

### PUT /api/kyc (Admin Only)
Update KYC verification status

**Body:**
```json
{
  "kycId": "string",
  "status": "APPROVED | REJECTED | RESUBMIT_REQUIRED | UNDER_REVIEW",
  "rejectionReason": "string (required for REJECTED/RESUBMIT_REQUIRED)",
  "verifiedBy": "string (admin user ID)"
}
```

### POST /api/upload-kyc-document
Upload KYC document images

**Form Data:**
- `file`: Image file (max 5MB)
- `userId`: User ID
- `documentType`: 'front' | 'back' | 'selfie'

**Response:**
```json
{
  "url": "/uploads/kyc/{userId}/{filename}",
  "message": "File uploaded successfully"
}
```

## Page Routes

### /dashboard/account/kyc
Main KYC verification page

**States:**
1. **No Submission**: Shows KYC form
2. **Pending/Under Review**: Shows status card with submission details
3. **Approved**: Shows verification success with details
4. **Rejected/Resubmit Required**: Shows rejection reason + resubmission form

## Usage Guide

### For Users

1. **Navigate to KYC page** from sidebar: My Account → KYC

2. **Fill Personal Information**:
   - Full legal name
   - Date of birth
   - Nationality
   - Occupation (optional)
   - Employer name (optional)
   - Annual income (optional)
   - Source of funds (optional)

3. **Enter Address Details**:
   - Street address
   - City
   - State/Province
   - Postal code
   - Country

4. **Upload Identity Document**:
   - Select document type
   - Enter document number
   - Upload front image
   - Upload back image (if applicable)
   - Upload selfie holding document

5. **Submit** and wait for verification (1-3 business days)

### For Administrators

To approve/reject KYC submissions, use the PUT endpoint:

```javascript
await fetch('/api/kyc', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    kycId: 'kyc_id_here',
    status: 'APPROVED', // or REJECTED, RESUBMIT_REQUIRED
    rejectionReason: 'Optional reason for rejection',
    verifiedBy: 'admin_user_id'
  })
});
```

## File Upload System

Files are stored in: `/public/uploads/kyc/{userId}/`

**Naming convention:** `{documentType}_{timestamp}.{extension}`

Examples:
- `front_1705567890123.jpg`
- `back_1705567890124.png`
- `selfie_1705567890125.jpg`

## Security Considerations

1. **File Validation**
   - Type checking (only images)
   - Size limit (5MB max)
   - Sanitized filenames

2. **Data Protection**
   - User ID verification
   - Unique constraint on userId (one KYC per user)
   - Secure file storage

3. **Access Control**
   - Users can only access their own KYC
   - Admin-only status updates
   - File paths not directly exposed

## Notifications

The system automatically creates notifications for:
- **KYC Submitted**: "Your KYC verification has been submitted and is under review"
- **KYC Approved**: "Congratulations! Your KYC verification has been approved"
- **KYC Rejected**: "Your KYC verification was rejected. Reason: {reason}"
- **Resubmit Required**: "Please resubmit your KYC documents. Reason: {reason}"

## Integration Points

### With User Model
- One-to-one relation
- `user.kycSubmission` accessor
- Pre-fills name and address from user profile

### With Notifications
- Auto-creates notifications on status changes
- Links to `/dashboard/account/kyc`
- Security type notifications

## Best Practices

### For Users
- Use clear, well-lit photos
- Ensure all text on documents is readable
- Face must be clearly visible in selfie
- Hold document next to face for selfie
- Use recent photos (within 6 months)

### For Administrators
- Review all submitted documents carefully
- Provide clear rejection reasons
- Verify document authenticity
- Check name matches across documents
- Verify date of birth
- Ensure selfie matches document photo

## Future Enhancements

1. **Automated Verification**
   - AI-powered document recognition
   - Face matching algorithms
   - OCR for document text extraction

2. **Video Verification**
   - Live video call verification option
   - Liveness detection

3. **Enhanced Security**
   - Encrypted file storage
   - Watermarking
   - Blockchain verification records

4. **Admin Dashboard**
   - Dedicated admin panel for KYC review
   - Batch processing
   - Analytics and reporting
   - Queue management

5. **Additional Features**
   - Proof of address upload
   - Bank statement verification
   - Employment verification
   - Tax ID verification

## Troubleshooting

### File Upload Fails
- Check file size (must be < 5MB)
- Verify file type (JPG, PNG, WebP only)
- Ensure stable internet connection
- Try compressing image

### Submission Error
- Verify all required fields are filled
- Check date of birth is valid
- Ensure document front and selfie are uploaded
- Clear browser cache and retry

### Status Not Updating
- Refresh page
- Wait 24-48 hours for review
- Contact support if delayed beyond 5 business days

## Support

For KYC-related issues:
- Check FAQ section
- Contact support via Messages
- Email: support@acredisfinance.com
- Phone: +1-800-ACREDIS

---

**Last Updated:** January 18, 2026
**Version:** 1.0.0
