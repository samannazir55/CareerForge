import type { Response } from 'express';
import { env, isProd } from '../config/env.js';

export const REFRESH_COOKIE_NAME = 'cf_refresh_token';

/**
 * In production the frontend (Render static site) and API (Render web service)
 * are on different domains, so the refresh cookie must use SameSite=None with
 * Secure=true. Both are HTTPS on Render so this is safe.
 *
 * In local dev the Vite proxy makes them same-origin, so SameSite=Lax works
 * and Secure=false is fine (no HTTPS on localhost).
 */
function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    path: '/api/auth',
    maxAge: maxAgeMs,
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, cookieOptions(env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000));
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions(0));
}
