import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  VerifyOtpRequestSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
} from '@careerforge/schema';
import * as authService from './auth.service.js';
import { toPublicUser } from './auth.service.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { setRefreshCookie, clearRefreshCookie, REFRESH_COOKIE_NAME } from '../../lib/cookies.js';
import { requireAuth } from '../../middleware/authGuard.js';
import { otpRateLimit, authRateLimit } from '../../middleware/rateLimit.js';
import { BadRequestError, UnauthorizedError } from '../../lib/errors.js';
import { env, isProd } from '../../config/env.js';

export const authRouter = Router();

// --- Email / password --------------------------------------------------------

authRouter.post(
  '/register',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const input = RegisterRequestSchema.parse(req.body);
    const { user, tokens } = await authService.register(input);
    setRefreshCookie(res, tokens.refreshToken);
    res.status(201).json({ accessToken: tokens.accessToken, user: toPublicUser(user) });
  }),
);

authRouter.post(
  '/login',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const input = LoginRequestSchema.parse(req.body);
    const { user, tokens } = await authService.login(input);
    setRefreshCookie(res, tokens.refreshToken);
    res.status(200).json({ accessToken: tokens.accessToken, user: toPublicUser(user) });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const raw = req.cookies?.[REFRESH_COOKIE_NAME];
    if (raw) await authService.revokeSession(raw);
    clearRefreshCookie(res);
    res.status(204).send();
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const raw = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!raw) throw new UnauthorizedError('No refresh token provided.', 'NO_REFRESH_TOKEN');
    const { user, tokens } = await authService.refreshSession(raw);
    setRefreshCookie(res, tokens.refreshToken);
    res.status(200).json({ accessToken: tokens.accessToken, user: toPublicUser(user) });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.status(200).json({ user: toPublicUser(req.user!) });
  }),
);

authRouter.post(
  '/complete-onboarding',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.completeOnboarding(req.user!.id);
    res.status(200).json({ user: toPublicUser(user) });
  }),
);

// --- Email verification (OTP) ------------------------------------------------

authRouter.post(
  '/otp/verify',
  requireAuth,
  otpRateLimit,
  asyncHandler(async (req, res) => {
    const { code } = VerifyOtpRequestSchema.parse(req.body);
    const user = await authService.verifyEmail(req.user!.id, code);
    res.status(200).json({ user: toPublicUser(user) });
  }),
);

authRouter.post(
  '/otp/resend',
  requireAuth,
  otpRateLimit,
  asyncHandler(async (req, res) => {
    await authService.sendVerificationOtp(req.user!.id);
    res.status(202).json({ message: 'Verification code sent.' });
  }),
);

// --- Forgot / reset password --------------------------------------------------

authRouter.post(
  '/forgot-password',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const { email } = ForgotPasswordRequestSchema.parse(req.body);
    await authService.forgotPassword(email);
    // Always the same response, whether or not the email exists — prevents
    // account enumeration via response-content timing/shape differences.
    res.status(202).json({ message: 'If that email exists, a reset code has been sent.' });
  }),
);

authRouter.post(
  '/reset-password',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const { email, code, newPassword } = ResetPasswordRequestSchema.parse(req.body);
    await authService.resetPassword(email, code, newPassword);
    res.status(200).json({ message: 'Password updated. Please log in again.' });
  }),
);

// --- OAuth ---------------------------------------------------------------------

const OAUTH_PROVIDER_MAP = { google: 'GOOGLE', github: 'GITHUB' } as const;
type OAuthSlug = keyof typeof OAUTH_PROVIDER_MAP;

function parseProviderSlug(slug: string): 'GOOGLE' | 'GITHUB' {
  const mapped = OAUTH_PROVIDER_MAP[slug as OAuthSlug];
  if (!mapped) throw new BadRequestError(`Unsupported OAuth provider: ${slug}`, 'UNSUPPORTED_PROVIDER');
  return mapped;
}

authRouter.get(
  '/oauth/:provider',
  asyncHandler(async (req, res) => {
    const provider = parseProviderSlug(req.params.provider);
    const state = randomBytes(16).toString('hex');
    // `state` is set as a short-lived cookie and re-checked on callback to
    // guard against CSRF on the OAuth redirect — a real check, not a no-op.
    //
    // no-store is critical here: this route has a side effect (setting a
    // fresh, single-use state cookie) on every hit, then 302s to Google
    // with that same state baked into the URL. Without an explicit
    // Cache-Control header, a CDN/proxy/browser is free to cache this GET
    // and later replay the cached 302 (with a stale `state`) WITHOUT
    // resending the Set-Cookie — so the browser's cookie jar and the
    // state Google is handed fall out of sync, and the very next real
    // attempt fails with INVALID_STATE even though nothing was misclicked.
    res.set('Cache-Control', 'no-store');
    res.cookie('cf_oauth_state', state, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000,
      path: '/api/auth/oauth',
    });
    const url = await authService.startOAuth(provider, state);
    res.redirect(url);
  }),
);

authRouter.get(
  '/oauth/:provider/callback',
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const provider = parseProviderSlug(req.params.provider);
    const { code, state } = req.query as { code?: string; state?: string };
    const expectedState = req.cookies?.cf_oauth_state;

    if (!code) throw new BadRequestError('Missing authorization code.', 'MISSING_CODE');
    if (!state || !expectedState || state !== expectedState) {
      throw new BadRequestError('Invalid OAuth state. Please try signing in again.', 'INVALID_STATE');
    }

    res.clearCookie('cf_oauth_state', { path: '/api/auth/oauth' });
    const { tokens } = await authService.completeOAuth(provider, code);
    setRefreshCookie(res, tokens.refreshToken);

    // No tokens are ever placed in the URL. The frontend's callback page
    // calls POST /api/auth/refresh immediately, which mints an access token
    // from the refresh cookie that's already set above.
    res.redirect(`${env.FRONTEND_URL}/oauth/callback`);
  }),
);