import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';
import { BadRequestError, ConfigurationError } from '../../lib/errors.js';

// ---------------------------------------------------------------------------
// Cloudinary photo uploads (resume profile photos)
// ---------------------------------------------------------------------------
// No mock/fallback mode by design, same reasoning as the Hostinger email
// adapter: an upload that silently "succeeds" without actually storing
// anything would be far worse than a loud, obvious failure at request time.
// All three CLOUDINARY_* env vars are required together for this to work.
// ---------------------------------------------------------------------------

let configured = false;

function getClient() {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new ConfigurationError(
      'Photo upload is not configured — CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and ' +
        'CLOUDINARY_API_SECRET must all be set.',
    );
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB — generous for a phone photo, well under Cloudinary's 40MB free-tier image limit
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface UploadedPhoto {
  url: string;
  publicId: string;
}

/**
 * Uploads a resume profile photo to Cloudinary. Applies a face-aware square
 * crop and caps the delivered size at 500x500 — resume photos are always
 * small (an avatar-sized circle/square in a template header), so there's no
 * reason to store or serve a multi-megapixel original.
 *
 * `folder` scopes uploads per-user (resume-photos/{userId}) so a listing of
 * one user's assets never surfaces another's, and so all of one user's
 * photos can be cleaned up together if their account is deleted.
 */
export async function uploadResumePhoto(
  fileBuffer: Buffer,
  mimeType: string,
  userId: string,
): Promise<UploadedPhoto> {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new BadRequestError(`Unsupported image type "${mimeType}" — use JPEG, PNG, or WebP.`);
  }
  if (fileBuffer.byteLength > MAX_PHOTO_BYTES) {
    throw new BadRequestError(`Photo is too large (max ${MAX_PHOTO_BYTES / 1024 / 1024}MB).`);
  }

  const client = getClient();
  const dataUri = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;

  const result = await client.uploader.upload(dataUri, {
    folder: `resume-photos/${userId}`,
    resource_type: 'image',
    transformation: [
      { width: 500, height: 500, crop: 'fill', gravity: 'face' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
    // Overwrite this user's previous photo instead of accumulating one
    // asset per upload — a resume only ever needs its current photo, not
    // a history of every one that was ever set.
    public_id: 'photo',
    overwrite: true,
    invalidate: true,
  });

  return { url: result.secure_url, publicId: result.public_id };
}

/** Deletes a user's uploaded resume photo, if one exists. Safe to call even
 * when there isn't one — Cloudinary's destroy is a no-op on a missing id. */
export async function deleteResumePhoto(userId: string): Promise<void> {
  const client = getClient();
  await client.uploader.destroy(`resume-photos/${userId}/photo`, { resource_type: 'image' });
}