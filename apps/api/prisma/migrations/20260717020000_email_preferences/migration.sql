-- CreateTable: per-user email preferences
-- Migration: 20260717020000_email_preferences
--
-- Backs the new proactive-communication features (weekly activity digest,
-- resume-view alerts, job-application follow-up reminders, interview
-- reminders, marketing emails). One row per user; rows are created lazily
-- on first read (see notifications.routes.ts GET /preferences) rather than
-- backfilled here, so existing users implicitly get the column defaults
-- (everything on except marketing) the first time they touch the endpoint
-- or are picked up by the scheduler.

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

ALTER TABLE "email_preferences" ADD CONSTRAINT "email_preferences_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
