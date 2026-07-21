import { z } from 'zod';
import { UserPublicSchema } from './user.js';

export const RegisterRequestSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(120),
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
  referralCode: z.string().trim().max(20).optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const VerifyOtpRequestSchema = z.object({
  code: z.string().length(6).regex(/^\d+$/, 'OTP must be numeric'),
});
export type VerifyOtpRequest = z.infer<typeof VerifyOtpRequestSchema>;

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

export const ResetPasswordRequestSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6).regex(/^\d+$/),
  newPassword: z.string().min(8).max(72),
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

/** What the API returns after a successful auth action. Refresh token is
 * never included here — it only ever travels as an httpOnly cookie. */
export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: UserPublicSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
