import rateLimit from 'express-rate-limit';

/** Coarse IP-based limiter on auth endpoints (register/login/forgot-password/
 * reset-password) to slow down credential-stuffing and brute-force attempts.
 * This is in addition to, not instead of, the per-user OTP attempt-limiting
 * in otp.service.ts — that one is the source of truth for "how many times
 * has THIS user tried THIS code"; this one just protects the endpoint
 * generally. 10 requests / 15 min per IP, per the pre-launch hardening spec —
 * tight enough to blunt brute force without a real user hitting it from
 * normal typo-and-retry usage. */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' } },
});

export const otpRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' } },
});

/**
 * Shared limiter for every LLM-backed endpoint (ai/coach/interview/linkedin
 * routes). Previously each of those four route files defined its own
 * identical-looking rateLimit() call, but with no keyGenerator — meaning
 * they were all silently keyed by IP, not by user, so one office/NAT/VPN
 * exit IP with several real users on paid plans could exhaust the shared
 * bucket instantly, or the flip side, a single user cycling IPs could
 * evade the limit entirely.
 *
 * Every route this is used on is mounted behind requireAuth first, so
 * req.user is always populated by the time this middleware runs — the
 * req.ip fallback only matters as a defensive default, not the normal path.
 * 20 requests / minute per user, per the pre-launch hardening spec.
 */
export const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'unknown',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many AI requests. Please wait a moment.' } },
});

/**
 * Baseline limiter applied to every request (see app.ts) so a route that
 * forgot its own rate limit isn't left completely unprotected. IP-keyed
 * since it runs ahead of auth on most routes. 100 requests / minute per
 * IP, per the pre-launch hardening spec. Endpoints with a tighter,
 * more specific limiter (auth, AI) still get both — this one is just the
 * floor, not a replacement.
 */
export const globalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } },
});

