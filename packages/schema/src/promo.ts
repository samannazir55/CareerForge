import { z } from 'zod';

// ---------------------------------------------------------------------------
// Promo codes
// ---------------------------------------------------------------------------

export const PromoCodeSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  pointsValue: z.number().int(),
  description: z.string().nullable(),
  maxRedemptions: z.number().int().nullable(),
  perUserLimit: z.number().int(),
  expiresAt: z.string().datetime().nullable(),
  isActive: z.boolean(),
  redemptionCount: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PromoCode = z.infer<typeof PromoCodeSchema>;

export const CreatePromoCodeRequestSchema = z.object({
  // Uppercased and trimmed by the server too, but validated here so the
  // admin UI can show a client-side error before round-tripping.
  code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Only letters, numbers, - and _ are allowed.'),
  pointsValue: z.number().int().min(1).max(1_000_000),
  description: z.string().max(250).optional(),
  maxRedemptions: z.number().int().min(1).optional(),
  perUserLimit: z.number().int().min(1).max(1000).default(1),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
});
export type CreatePromoCodeRequest = z.infer<typeof CreatePromoCodeRequestSchema>;

export const UpdatePromoCodeRequestSchema = CreatePromoCodeRequestSchema.partial();
export type UpdatePromoCodeRequest = z.infer<typeof UpdatePromoCodeRequestSchema>;

export const RedeemPromoCodeRequestSchema = z.object({
  code: z.string().trim().min(1).max(40),
});
export type RedeemPromoCodeRequest = z.infer<typeof RedeemPromoCodeRequestSchema>;

export const RedeemPromoCodeResponseSchema = z.object({
  pointsAwarded: z.number().int(),
  newBalance: z.number().int(),
});
export type RedeemPromoCodeResponse = z.infer<typeof RedeemPromoCodeResponseSchema>;

// ---------------------------------------------------------------------------
// Campaign send — broadcast a code to a segment of users via email +
// in-dashboard notification
// ---------------------------------------------------------------------------

export const PromoAudienceSchema = z.enum(['ALL', 'FREE', 'PROFESSIONAL', 'PREMIUM']);
export type PromoAudience = z.infer<typeof PromoAudienceSchema>;

export const SendPromoCampaignRequestSchema = z.object({
  audience: PromoAudienceSchema,
  subject: z.string().min(3).max(150),
  message: z.string().min(3).max(2000),
});
export type SendPromoCampaignRequest = z.infer<typeof SendPromoCampaignRequestSchema>;

export const SendPromoCampaignResponseSchema = z.object({
  recipientCount: z.number().int(),
  emailsSent: z.number().int(),
  emailsFailed: z.number().int(),
});
export type SendPromoCampaignResponse = z.infer<typeof SendPromoCampaignResponseSchema>;
