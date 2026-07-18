import type { OAuthProviderName as PrismaOAuthProviderName, User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword, generateRefreshToken, hashOpaqueToken } from '../../lib/hash.js';
import { signAccessToken } from '../../lib/jwt.js';
import { issueOtp, consumeOtp } from './otp.service.js';
import { emailProvider } from '../providers/email/index.js';
import { oauthProviders } from '../providers/oauth/index.js';
import { env } from '../../config/env.js';
import { BadRequestError, ConflictError, UnauthorizedError } from '../../lib/errors.js';
import type { RegisterRequest, LoginRequest, UserPublic } from '@careerforge/schema';
import { ensureCareerProfile } from '../profile/profile.service.js';
export function toPublicUser(user: User): UserPublic {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    isEmailVerified: user.isEmailVerified,
    role: user.role,
    subscriptionTier: user.subscriptionTier,
    pointsBalance: user.pointsBalance,
    hasCompletedOnboarding: user.hasCompletedOnboarding,
    createdAt: user.createdAt.toISOString(),
  };
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string; // raw value — caller sets this as an httpOnly cookie, never returns it in a JSON body
}

async function issueSession(user: User): Promise<SessionTokens> {
  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });

  const refreshToken = generateRefreshToken();
  const tokenHash = hashOpaqueToken(refreshToken);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  return { accessToken, refreshToken };
}

export async function register(input: RegisterRequest): Promise<{ user: User; tokens: SessionTokens }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError('An account with this email already exists.', 'EMAIL_TAKEN');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: { email: input.email, fullName: input.fullName, passwordHash },
  });
  // In register(), after user creation — add:
  await ensureCareerProfile(user.id).catch((err) => {
    console.error('Failed to create career profile after registration:', err);
  });

  // In completeOAuth(), after new user creation — add:
  await ensureCareerProfile(user.id).catch((err) => {
    console.error('Failed to create career profile after OAuth registration:', err);
  });

  // Email sending is best-effort — a provider failure should never prevent
  // account creation. The user can request a new OTP from the verify page.
  sendVerificationOtp(user.id).catch((err) => {
    console.error('Failed to send verification OTP after registration:', err);
  });

  const tokens = await issueSession(user);
  return { user, tokens };
}

export async function login(input: LoginRequest): Promise<{ user: User; tokens: SessionTokens }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.passwordHash) {
    throw new UnauthorizedError('Invalid email or password.', 'INVALID_CREDENTIALS');
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password.', 'INVALID_CREDENTIALS');
  }

  const tokens = await issueSession(user);
  return { user, tokens };
}

export async function sendVerificationOtp(userId: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.isEmailVerified) {
    throw new BadRequestError('This email is already verified.', 'ALREADY_VERIFIED');
  }
  const code = await issueOtp(userId, 'EMAIL_VERIFICATION');
  await emailProvider.sendOtpEmail({ to: user.email, fullName: user.fullName, code, purpose: 'verify' });
}

export async function verifyEmail(userId: string, code: string): Promise<User> {
  await consumeOtp(userId, 'EMAIL_VERIFICATION', code);
  const user = await prisma.user.update({ where: { id: userId }, data: { isEmailVerified: true } });
  // Welcome email is best-effort: a failure here shouldn't undo verification.
  await emailProvider.sendWelcomeEmail({ to: user.email, fullName: user.fullName }).catch((err) => {
    console.error('Failed to send welcome email:', err);
  });
  return user;
}

/** Marks the first-time onboarding flow as done for this account. Idempotent —
 * safe to call even if it's already true (e.g. a retried request). */
export async function completeOnboarding(userId: string): Promise<User> {
  return prisma.user.update({ where: { id: userId }, data: { hasCompletedOnboarding: true } });
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  // Deliberately do not reveal whether the account exists.
  if (!user || !user.passwordHash) return;

  // Both OTP generation and email sending are best-effort — the caller always
  // gets the same generic 202 response regardless of outcome.
  issueOtp(user.id, 'PASSWORD_RESET')
    .then((code) =>
      emailProvider.sendOtpEmail({ to: user.email, fullName: user.fullName, code, purpose: 'reset' }),
    )
    .catch((err) => {
      console.error('Failed to send password reset email:', err);
    });
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Same OTP-shaped error as a real mismatch, so the response doesn't leak account existence.
    throw new BadRequestError('Incorrect code. Please request a new one.', 'OTP_INVALID');
  }
  await consumeOtp(user.id, 'PASSWORD_RESET', code);
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  // Resetting the password invalidates all existing sessions.
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function refreshSession(rawRefreshToken: string): Promise<{ user: User; tokens: SessionTokens }> {
  const tokenHash = hashOpaqueToken(rawRefreshToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    throw new UnauthorizedError('Session expired. Please log in again.', 'INVALID_REFRESH_TOKEN');
  }

  // Rotate: revoke the used token and issue a brand new pair. This means a
  // stolen-and-replayed refresh token is detectable (the legitimate client's
  // next refresh will fail because its token was already revoked).
  await prisma.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
  const tokens = await issueSession(existing.user);
  return { user: existing.user, tokens };
}

export async function revokeSession(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashOpaqueToken(rawRefreshToken);
  await prisma.refreshToken
    .updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } })
    .catch(() => undefined);
}

export async function startOAuth(provider: PrismaOAuthProviderName, state: string): Promise<string> {
  return oauthProviders[provider].getAuthorizationUrl(state);
}

export async function completeOAuth(
  provider: PrismaOAuthProviderName,
  code: string,
): Promise<{ user: User; tokens: SessionTokens }> {
  const profile = await oauthProviders[provider].exchangeCodeForProfile(code);

  const existingAccount = await prisma.oAuthAccount.findUnique({
    where: { provider_providerUserId: { provider, providerUserId: profile.providerUserId } },
    include: { user: true },
  });

  if (existingAccount) {
    const tokens = await issueSession(existingAccount.user);
    return { user: existingAccount.user, tokens };
  }

  // No linked account yet. If a user already exists with this email
  // (e.g. they registered with a password first), link the OAuth account to
  // it instead of creating a duplicate user.
  let user = await prisma.user.findUnique({ where: { email: profile.email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: profile.email,
        fullName: profile.fullName,
        // The provider has already verified this email address.
        isEmailVerified: true,
      },
    });
  }
  await ensureCareerProfile(user.id).catch((err) => {
    console.error(
      'Failed to create career profile after OAuth registration:',
      err
    );
  });
  await prisma.oAuthAccount.create({
    data: { provider, providerUserId: profile.providerUserId, userId: user.id },
  });

  const tokens = await issueSession(user);
  return { user, tokens };
}
