-- AlterTable: in-app Contact Us form (Suggestion / Bug Report)
-- Migration: 20260718110000_contact_submissions
--
-- Backs the /contact page (see components/contact/ContactPage.tsx and
-- domain/contact/contact.routes.ts). Two submission types share one table
-- since they're the same shape (subject, message, optional screenshot);
-- `type` is what the admin panel filters/sorts on.

CREATE TYPE "ContactSubmissionType" AS ENUM ('SUGGESTION', 'BUG_REPORT');
CREATE TYPE "ContactSubmissionStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TABLE "contact_submissions" (
    "id"            TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "type"          "ContactSubmissionType" NOT NULL,
    "subject"       TEXT NOT NULL,
    "message"       TEXT NOT NULL,
    "screenshotUrl" TEXT,
    "status"        "ContactSubmissionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_submissions_userId_createdAt_idx" ON "contact_submissions"("userId", "createdAt");
CREATE INDEX "contact_submissions_status_createdAt_idx" ON "contact_submissions"("status", "createdAt");

ALTER TABLE "contact_submissions" ADD CONSTRAINT "contact_submissions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
