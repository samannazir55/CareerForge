import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';
import { env } from '../config/env.js';

const BCRYPT_ROUNDS = 12;

// --- Passwords -------------------------------------------------------------
// bcrypt has a hard 72-byte input limit. We reject (not silently truncate)
// passwords that would exceed it so behavior is predictable rather than the
// FastAPI prototype's silent-truncation workaround.
export async function hashPassword(plainPassword: string): Promise<string> {
  if (Buffer.byteLength(plainPassword, 'utf8') > 72) {
    throw new Error('Password exceeds maximum supported length (72 bytes).');
  }
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash);
}

// --- Opaque refresh tokens ---------------------------------------------------
// The refresh token itself is a random opaque string handed to the client;
// only its SHA-256 hash is ever persisted, so a database leak doesn't expose
// usable tokens (same principle as password hashing, applied to sessions).
export function generateRefreshToken(): string {
  return randomBytes(48).toString('hex');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// --- OTP codes ---------------------------------------------------------------
export function generateOtpCode(): string {
  const max = 10 ** env.OTP_LENGTH;
  const code = Math.floor(Math.random() * max)
    .toString()
    .padStart(env.OTP_LENGTH, '0');
  return code;
}

export async function hashOtpCode(code: string): Promise<string> {
  // OTPs are short-lived and low-entropy compared to passwords; a fast
  // SHA-256 hash (rather than bcrypt) is sufficient and keeps verification
  // cheap for the resend/attempt-limited flow.
  return createHash('sha256').update(code).digest('hex');
}

export async function verifyOtpCode(code: string, hash: string): Promise<boolean> {
  return (await hashOtpCode(code)) === hash;
}
