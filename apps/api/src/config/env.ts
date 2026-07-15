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
  // Falls back to Render's own automatically-provided RENDER_EXTERNAL_URL
  // (the real public HTTPS URL of this service, injected into every Render
  // web service with no configuration needed) before falling back further
  // to a localhost default. Previously FRONTEND_URL defaulted straight to
  // localhost, which silently became the OAuth callback redirect target
  // AND the Stripe checkout success/cancel/return URLs whenever the
  // FRONTEND_URL env var wasn't explicitly set on a deployment — an easy
  // step to forget, since a single-origin deployment like this one doesn't
  // obviously need it set at all if you're not aware of this default.
  FRONTEND_URL: z.string().default(process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173'),

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
  EMAIL_FROM: z.string().default('Corvyx <noreply@example.com>'),

  // Optional — only used by prisma/seed.ts to create an initial admin user.
  SEED_ADMIN_EMAIL: z.string().optional().default(''),
  SEED_ADMIN_PASSWORD: z.string().optional().default(''),

  // Required for PDF export. Set to the path of a Chromium or Chrome binary.
  // Local dev: run `npx puppeteer browsers install chrome` and set the printed path.
  // Production (Render/Ubuntu): typically /usr/bin/chromium-browser or similar.
  PUPPETEER_EXECUTABLE_PATH: z.string().optional().default(''),

  // Payments (Stripe)
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  STRIPE_PRICE_PROFESSIONAL: z.string().optional().default(''),
  STRIPE_PRICE_PREMIUM: z.string().optional().default(''),

  // PageSpeed Insights API key (Google Cloud Console -> APIs & Services ->
  // Credentials). Free tier, no OAuth needed. Admin SEO dashboard only.
  PAGESPEED_API_KEY: z.string().optional().default(''),

  // AI provider
  AI_PROVIDER: z.enum(['anthropic', 'openai', 'groq', 'openrouter']).default('openrouter'),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),
  GROQ_API_KEY: z.string().optional().default(''),
  GROQ_MODEL: z.string().default('openai/gpt-oss-20b'),
  OPENROUTER_API_KEY: z.string().optional().default(''),
  OPENROUTER_MODEL: z.string().default('meta-llama/llama-3.2-3b-instruct:free'),

  // Cloudinary — resume photo uploads (see domain/uploads/cloudinary.service.ts).
  // No fallback/mock mode by design, same reasoning as email: an upload
  // that silently "succeeds" without actually storing anything would be
  // far worse than a loud, obvious failure. All three are required
  // together for the photo upload route to work at all.
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),

  // Adzuna job search API (developer.adzuna.com) — powers the "Find Jobs"
  // page (see domain/jobsearch/jobsearch.routes.ts). No fallback/mock mode:
  // if these aren't set, the route fails loudly with a clear config error
  // rather than silently returning empty results.
  ADZUNA_APP_ID: z.string().optional().default(''),
  ADZUNA_APP_KEY: z.string().optional().default(''),

  // Feature flags — set to 'true' to enable; false by default so future
  // modules can be deployed behind flags without affecting current users
  FEATURE_INTERVIEW_PREP: z.string().default('false'),
  FEATURE_LINKEDIN_OPTIMIZER: z.string().default('false'),
  FEATURE_JOB_TRACKER: z.string().default('false'),
  FEATURE_CAREER_COACH: z.string().default('false'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration. Check .env against .env.example.');
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';