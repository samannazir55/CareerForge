import { prisma } from '../../lib/prisma.js';
import { pointsService } from '../points/points.service.js';
import { env } from '../../config/env.js';

// Both sides get the same amount, deliberately pegged to SIGNUP_BONUS
// ('FREE' tier's pointsOnSignup in @careerforge/schema's PLAN_LIMITS) —
// small enough not to be worth gaming with throwaway email accounts, but
// a real, felt reward for both the referrer and the friend they brought.
export const REFERRAL_REWARD_POINTS = 50;

/**
 * Looks up a referrer by their referral code. Case-insensitive since codes
 * get typed/pasted from links and people don't reliably preserve case.
 * Returns null (not an error) for an unknown/stale code — a bad or
 * outdated referral link should never block someone from signing up, it
 * should just silently not attribute a referral.
 */
export async function findReferrerByCode(code: string): Promise<{ id: string } | null> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;
  return prisma.user.findUnique({ where: { referralCode: trimmed }, select: { id: true } });
}

/**
 * Awards the referral bonus to both sides, exactly once, the first time
 * this is called for an already-referred user whose email is verified (or
 * who was created pre-verified, e.g. via OAuth). Safe to call from
 * multiple places (verifyEmail, completeOAuth) and safe to call more than
 * once for the same user — everything after the referredById/
 * referralRewardedAt checks is a no-op on any call after the first.
 *
 * The atomicity comes from the conditional updateMany below: it only
 * succeeds (count > 0) for whichever concurrent call gets there first,
 * which is what stops a race (e.g. a retried verify-email request) from
 * paying out twice.
 */
export async function awardReferralIfEligible(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referredById: true, referralRewardedAt: true },
  });
  if (!user?.referredById || user.referralRewardedAt) return;

  const claimed = await prisma.user.updateMany({
    where: { id: userId, referralRewardedAt: null },
    data: { referralRewardedAt: new Date() },
  });
  if (claimed.count === 0) return; // another concurrent call already claimed this reward

  await Promise.all([
    pointsService.award(
      userId,
      REFERRAL_REWARD_POINTS,
      'REFERRAL',
      "Referral bonus — thanks for joining via a friend's link!",
    ),
    pointsService.award(
      user.referredById,
      REFERRAL_REWARD_POINTS,
      'REFERRAL',
      'Referral bonus — a friend joined using your link!',
    ),
  ]);
}

export interface ReferralStats {
  referralCode: string;
  referralUrl: string;
  totalReferred: number;
  rewardedReferrals: number;
  pointsEarned: number;
}

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { referralCode: true },
  });

  const [totalReferred, rewardedReferrals] = await Promise.all([
    prisma.user.count({ where: { referredById: userId } }),
    prisma.user.count({ where: { referredById: userId, referralRewardedAt: { not: null } } }),
  ]);

  return {
    referralCode: user.referralCode,
    referralUrl: `${env.FRONTEND_URL.replace(/\/$/, '')}/register?ref=${user.referralCode}`,
    totalReferred,
    rewardedReferrals,
    pointsEarned: rewardedReferrals * REFERRAL_REWARD_POINTS,
  };
}
