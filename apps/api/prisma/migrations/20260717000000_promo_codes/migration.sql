-- CreateTable: promo codes + redemptions
-- Migration: 20260717000000_promo_codes
--
-- Lets admins mint a code (e.g. "NEWYEAR2026") worth N points, cap how many
-- times it can be redeemed in total and per user, optionally expire it, and
-- send it out to subscribers via email + in-dashboard notification. Points
-- are awarded through the existing pointsService ledger — this migration
-- only adds the code definition and the redemption log used to enforce caps.

-- AlterEnum: add PROMO_CODE as a valid points-earn reason
ALTER TYPE "PointsEarnReason" ADD VALUE 'PROMO_CODE';

CREATE TABLE "promo_codes" (
    "id"             TEXT NOT NULL,
    "code"           TEXT NOT NULL,
    "pointsValue"    INTEGER NOT NULL,
    "description"    TEXT,
    "maxRedemptions" INTEGER,
    "perUserLimit"   INTEGER NOT NULL DEFAULT 1,
    "expiresAt"      TIMESTAMP(3),
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "createdBy"      TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

CREATE TABLE "promo_code_redemptions" (
    "id"          TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_code_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "promo_code_redemptions_promoCodeId_userId_idx" ON "promo_code_redemptions"("promoCodeId", "userId");

ALTER TABLE "promo_codes"
    ADD CONSTRAINT "promo_codes_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "promo_code_redemptions"
    ADD CONSTRAINT "promo_code_redemptions_promoCodeId_fkey"
    FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "promo_code_redemptions"
    ADD CONSTRAINT "promo_code_redemptions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
