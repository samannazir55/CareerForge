import { randomBytes } from 'node:crypto';
import { prisma } from './prisma.js';

// Excludes 0/O and 1/I/L — codes get typed, texted, and read off a screen,
// and those pairs are the ones people actually mistype.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 7;

function randomCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

/**
 * Generates a referral code guaranteed unique against the users table at
 * call time. Collision odds are astronomically low (32^7 ≈ 3.4×10^10
 * combinations) so a short existence-check loop is simpler and safer here
 * than relying on catching a unique-constraint error from the eventual
 * insert, and cheap enough to just always do.
 */
export async function generateUniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const existing = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
    if (!existing) return code;
  }
  // Practically unreachable given the odds above, but fail loudly rather
  // than silently handing back a colliding code if it ever somehow happens.
  throw new Error('Could not generate a unique referral code after 5 attempts.');
}
