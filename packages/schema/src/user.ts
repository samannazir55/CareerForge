import { z } from 'zod';

export const RoleSchema = z.enum(['USER', 'ADMIN']);
export type Role = z.infer<typeof RoleSchema>;

export const OAuthProviderNameSchema = z.enum(['GOOGLE', 'GITHUB']);
export type OAuthProviderName = z.infer<typeof OAuthProviderNameSchema>;

export const SubscriptionTierSchema = z.enum(['FREE', 'PROFESSIONAL', 'PREMIUM']);
export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>;

/**
 * Public-facing user shape. This is the ONE definition of "what a user looks
 * like" shared by the API's response serializer and the frontend's type
 * system — never hand-duplicated on either side.
 */
export const UserPublicSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  isEmailVerified: z.boolean(),
  role: RoleSchema,
  subscriptionTier: SubscriptionTierSchema,
  pointsBalance: z.number().int(),
  hasCompletedOnboarding: z.boolean(),
  createdAt: z.string().datetime(),
});
export type UserPublic = z.infer<typeof UserPublicSchema>;
