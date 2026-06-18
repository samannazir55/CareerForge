import { prisma } from '../../lib/prisma.js';
import { generateOtpCode, hashOtpCode, verifyOtpCode } from '../../lib/hash.js';
import { env } from '../../config/env.js';
import { BadRequestError, TooManyRequestsError } from '../../lib/errors.js';
import type { OtpPurpose } from '@prisma/client';

/**
 * Single source of truth for OTP lifecycle: generation, expiry, resend
 * cooldown, and attempt-limiting all live here — nowhere else in the
 * codebase touches an OtpCode row directly.
 */

export async function issueOtp(userId: string, purpose: OtpPurpose): Promise<string> {
  const cooldownCutoff = new Date(Date.now() - env.OTP_RESEND_COOLDOWN_SECONDS * 1000);
  const recent = await prisma.otpCode.findFirst({
    where: { userId, purpose, createdAt: { gt: cooldownCutoff } },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) {
    const retryAfterSec = Math.ceil(
      (recent.createdAt.getTime() + env.OTP_RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000,
    );
    throw new TooManyRequestsError(`Please wait ${retryAfterSec}s before requesting another code.`);
  }

  const code = generateOtpCode();
  const codeHash = await hashOtpCode(code);
  const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.otpCode.create({
    data: { userId, purpose, codeHash, expiresAt },
  });

  return code; // caller is responsible for emailing this — never logged, never returned to the HTTP client
}

export async function consumeOtp(userId: string, purpose: OtpPurpose, submittedCode: string): Promise<void> {
  const otp = await prisma.otpCode.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) {
    throw new BadRequestError('No active verification code. Please request a new one.', 'OTP_NOT_FOUND');
  }
  if (otp.expiresAt < new Date()) {
    throw new BadRequestError('This code has expired. Please request a new one.', 'OTP_EXPIRED');
  }
  if (otp.attempts >= env.OTP_MAX_ATTEMPTS) {
    throw new TooManyRequestsError('Too many incorrect attempts. Please request a new code.');
  }

  const isValid = await verifyOtpCode(submittedCode, otp.codeHash);

  if (!isValid) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    const remaining = env.OTP_MAX_ATTEMPTS - (otp.attempts + 1);
    throw new BadRequestError(
      remaining > 0 ? `Incorrect code. ${remaining} attempt(s) remaining.` : 'Incorrect code. No attempts remaining.',
      'OTP_INVALID',
    );
  }

  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
}
