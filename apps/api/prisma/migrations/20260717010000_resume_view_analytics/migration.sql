-- CreateTable: resume view analytics
-- Migration: 20260717010000_resume_view_analytics
--
-- One row per public-page view of a shared resume, recorded from
-- sharing.routes.ts. Kept separate from ShareableLink's viewCount/
-- lastViewedAt counters (which stay as a fast running summary) so the
-- analytics dashboard can break views down over time, by referrer, etc.

CREATE TABLE "resume_views" (
    "id"        TEXT NOT NULL,
    "resumeId"  TEXT NOT NULL,
    "viewerIp"  TEXT,
    "userAgent" TEXT,
    "country"   TEXT,
    "city"      TEXT,
    "referrer"  TEXT,
    "duration"  INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_views_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "resume_views_resumeId_createdAt_idx" ON "resume_views"("resumeId", "createdAt");

ALTER TABLE "resume_views"
    ADD CONSTRAINT "resume_views_resumeId_fkey"
    FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
