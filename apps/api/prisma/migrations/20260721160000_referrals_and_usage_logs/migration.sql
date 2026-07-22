-- Migration: 20260721160000_referrals_and_usage_logs
--
-- Catches up the database with fields/models that were added to
-- schema.prisma (referral program on User, UsageLog) but never had a
-- matching migration generated. Safe to run against a live table with
-- existing rows: referralCode is backfilled from each user's id before
-- the NOT NULL + UNIQUE constraints are applied.

-- AlterTable: users — referral columns
ALTER TABLE "users" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "users" ADD COLUMN "referredById" TEXT;
ALTER TABLE "users" ADD COLUMN "referralRewardedAt" TIMESTAMP(3);

-- Backfill a unique referral code for existing rows (8 hex chars derived
-- from each user's own id, so it's guaranteed unique without needing an
-- extension like pgcrypto).
UPDATE "users"
SET "referralCode" = upper(substr(md5("id"), 1, 8))
WHERE "referralCode" IS NULL;

ALTER TABLE "users" ALTER COLUMN "referralCode" SET NOT NULL;

CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

ALTER TABLE "users" ADD CONSTRAINT "users_referredById_fkey"
  FOREIGN KEY ("referredById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "UsageKind" AS ENUM ('AI_CHAT_MESSAGE', 'COVER_LETTER', 'RESUME_TAILORING');

-- CreateTable
CREATE TABLE "usage_logs" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "kind"      "UsageKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "usage_logs_userId_kind_createdAt_idx" ON "usage_logs"("userId", "kind", "createdAt");

ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
