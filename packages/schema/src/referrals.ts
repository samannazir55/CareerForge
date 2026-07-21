import { z } from 'zod';

export const ReferralStatsSchema = z.object({
  referralCode: z.string(),
  referralUrl: z.string(),
  totalReferred: z.number().int(),
  rewardedReferrals: z.number().int(),
  pointsEarned: z.number().int(),
});
export type ReferralStats = z.infer<typeof ReferralStatsSchema>;
