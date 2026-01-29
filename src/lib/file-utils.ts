import { unlink } from 'fs/promises';
import { join } from 'path';

/**
 * Delete a user's avatar file from the uploads folder
 * Note: This is now deprecated as avatars are stored as base64 in the database
 * This function is kept for backward compatibility with old file-based avatars
 * @param avatarUrl - The avatar URL path (e.g., "/uploads/avatars/userid_timestamp.jpg")
 */
export async function deleteAvatarFile(avatarUrl: string | null): Promise<void> {
  if (!avatarUrl) return;

  // Skip deletion for base64 data URLs (new format)
  if (avatarUrl.startsWith('data:')) {
    console.log('Avatar is base64 format, no file to delete');
    return;
  }

  try {
    const filename = avatarUrl.split('/').pop();
    if (!filename) return;

    const uploadDir = join(process.cwd(), 'public', 'uploads', 'avatars');
    const filePath = join(uploadDir, filename);
    
    await unlink(filePath);
    console.log(`Deleted avatar file: ${filename}`);
  } catch (error) {
    // File might not exist or already deleted
    console.log('Avatar file not found or already deleted:', error);
  }
}
