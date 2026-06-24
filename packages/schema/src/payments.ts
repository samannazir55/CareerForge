import { z } from 'zod';
import { SubscriptionTierSchema } from './user.js';

export const SubscriptionStatusSchema = z.enum(['ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING']);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const SubscriptionInfoSchema = z.object({
  tier: SubscriptionTierSchema,
  status: SubscriptionStatusSchema,
  currentPeriodEnd: z.string().nullable(),
  cancelAtPeriodEnd: z.boolean(),
});
export type SubscriptionInfo = z.infer<typeof SubscriptionInfoSchema>;

export const TemplateMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['free', 'premium']),
  previewClass: z.string(),
  cost: z.number(),
});
export type TemplateMetadata = z.infer<typeof TemplateMetadataSchema>;
