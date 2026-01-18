import { unlink } from 'fs/promises';
import { join } from 'path';

/**
 * Delete a user's avatar file from the uploads folder
 * @param avatarUrl - The avatar URL path (e.g., "/uploads/avatars/userid_timestamp.jpg")
 */
export async function deleteAvatarFile(avatarUrl: string | null): Promise<void> {
  if (!avatarUrl) return;

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
