-- AlterTable: public portfolio fields on career_profiles
-- Migration: 20260718000000_public_profile
--
-- Backs the /u/:slug public profile page (see domain/profile/profile.routes.ts
-- and pages/profile/PublicProfilePage.tsx). isPublic gates page visibility
-- independently of publicSlug being set, so a user can reserve/preview a
-- slug before actually publishing.

ALTER TABLE "career_profiles"
    ADD COLUMN "publicSlug"  TEXT,
    ADD COLUMN "isPublic"    BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "headline"    TEXT,
    ADD COLUMN "bio"         TEXT,
    ADD COLUMN "location"    TEXT,
    ADD COLUMN "website"     TEXT,
    ADD COLUMN "linkedinUrl" TEXT,
    ADD COLUMN "githubUrl"   TEXT,
    ADD COLUMN "twitterUrl"  TEXT,
    ADD COLUMN "avatarUrl"   TEXT;

CREATE UNIQUE INDEX "career_profiles_publicSlug_key" ON "career_profiles"("publicSlug");
