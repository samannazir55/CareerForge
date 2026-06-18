import type { Response } from 'express';
import { env, isProd } from '../config/env.js';

export const REFRESH_COOKIE_NAME = 'cf_refresh_token';

/**
 * Single source of truth for refresh-cookie options. Both setRefreshCookie
 * and clearRefreshCookie use this so the two can never drift out of sync
 * (a classic source of "logout doesn't actually clear the cookie" bugs).
 *
 * NOTE: this assumes the frontend and API are served same-site (via the Vite
 * dev proxy locally, and a reverse proxy / same-domain deploy in production —
 * see README "Deployment" section). If you deploy them on different domains,
 * this needs `sameSite: 'none'` and a real HTTPS certificate on both sides.
 */
function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
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
