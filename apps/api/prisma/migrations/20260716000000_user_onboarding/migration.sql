-- AlterTable: users
-- Tracks whether the first-time onboarding modal has been completed (or
-- explicitly skipped) so it only ever activates once per account.

ALTER TABLE "users" ADD COLUMN "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT false;
