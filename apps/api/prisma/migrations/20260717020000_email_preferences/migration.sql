-- CreateTable: per-user email preferences
-- Migration: 20260717020000_email_preferences
--
-- Backs the weekly digest + smart reminder emails (see
-- domain/email/digest.service.ts and lib/scheduler.ts). One row per user,
-- created lazily on first read/write (see notifications.routes.ts) rather
-- than a signup-time insert, so existing users get sane defaults instead
-- of the scheduler having to treat a missing row as a special case.

CREATE TABLE "email_preferences" (
    "id"                      TEXT NOT NULL,
    "userId"                  TEXT NOT NULL,
    "weeklyDigest"            BOOLEAN NOT NULL DEFAULT true,
    "resumeViewAlerts"        BOOLEAN NOT NULL DEFAULT true,
    "jobApplicationReminders" BOOLEAN NOT NULL DEFAULT true,
    "interviewReminders"      BOOLEAN NOT NULL DEFAULT true,
    "marketingEmails"         BOOLEAN NOT NULL DEFAULT false,
    "updatedAt"               TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_preferences_userId_key" ON "email_preferences"("userId");

ALTER TABLE "email_preferences"
    ADD CONSTRAINT "email_preferences_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
