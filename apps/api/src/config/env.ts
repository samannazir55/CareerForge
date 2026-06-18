import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),

  API_PORT: z.coerce.number().default(4000),
  API_BASE_URL: z.string().default('http://localhost:4000'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  OTP_LENGTH: z.coerce.number().default(6),
  OTP_EXPIRY_MINUTES: z.coerce.number().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().default(60),

  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_REDIRECT_URI: z.string().optional().default(''),

  GITHUB_CLIENT_ID: z.string().optional().default(''),
  GITHUB_CLIENT_SECRET: z.string().optional().default(''),
  GITHUB_REDIRECT_URI: z.string().optional().default(''),

  // No "console"/dev fallback by design: emails are a real integration, not
  // a mockable one. Without a real RESEND_API_KEY, send calls fail loudly
  // (see resend.adapter.ts) rather than silently pretending to succeed.
  EMAIL_PROVIDER: z.enum(['resend']).default('resend'),
  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('CareerForge <noreply@example.com>'),

  // Optional — only used by prisma/seed.ts to create an initial admin user.
  SEED_ADMIN_EMAIL: z.string().optional().default(''),
  SEED_ADMIN_PASSWORD: z.string().optional().default(''),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration. Check .env against .env.example.');
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
