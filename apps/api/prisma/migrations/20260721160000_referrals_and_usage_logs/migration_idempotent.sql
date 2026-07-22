-- Idempotent rerun of 20260721160000_referrals_and_usage_logs.
-- Safe to run no matter how far the previous (failed) attempt got —
-- every step checks whether it's already done before acting.

-- Columns
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referredById" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referralRewardedAt" TIMESTAMP(3);

-- Backfill only rows still missing a code
UPDATE "users"
SET "referralCode" = upper(substr(md5("id"), 1, 8))
WHERE "referralCode" IS NULL;

-- NOT NULL (only sets it if not already set — safe to run twice)
ALTER TABLE "users" ALTER COLUMN "referralCode" SET NOT NULL;

-- Unique index
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'users_referralCode_key') THEN
    CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");
  END IF;
END $$;

-- Self-referencing FK
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_referredById_fkey') THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_referredById_fkey"
      FOREIGN KEY ("referredById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UsageKind') THEN
    CREATE TYPE "UsageKind" AS ENUM ('AI_CHAT_MESSAGE', 'COVER_LETTER', 'RESUME_TAILORING');
  END IF;
END $$;

-- Table
CREATE TABLE IF NOT EXISTS "usage_logs" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "kind"      "UsageKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

-- Index
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'usage_logs' AND indexname = 'usage_logs_userId_kind_createdAt_idx') THEN
    CREATE INDEX "usage_logs_userId_kind_createdAt_idx" ON "usage_logs"("userId", "kind", "createdAt");
  END IF;
END $$;

-- FK
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_logs_userId_fkey') THEN
    ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
