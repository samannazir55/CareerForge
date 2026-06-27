import type { Response } from 'express';
import { env, isProd } from '../config/env.js';

export const REFRESH_COOKIE_NAME = 'cf_refresh_token';

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
