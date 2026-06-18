import rateLimit from 'express-rate-limit';

/** Coarse IP-based limiter on auth endpoints (register/login/forgot-password)
 * to slow down credential-stuffing and brute-force attempts. This is in
 * addition to, not instead of, the per-user OTP attempt-limiting in
 * otp.service.ts — that one is the source of truth for "how many times has
 * THIS user tried THIS code"; this one just protects the endpoint generally. */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
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
