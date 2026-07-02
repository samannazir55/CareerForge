import { z } from 'zod';

// ---------------------------------------------------------------------------
// Template listings
// ---------------------------------------------------------------------------

export const TemplateListingSchema = z.object({
  id: z.string(),
  isActive: z.boolean(),
  category: z.enum(['free', 'premium']),
  pointsCost: z.number().int().min(0),
  thumbnailUrl: z.string().nullable(),
  displayOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TemplateListing = z.infer<typeof TemplateListingSchema>;

/** A template as the admin UI sees it: code-defined renderer metadata
 * merged with the DB-editable listing. `hasListing` is false until an
 * admin first edits it, at which point sensible defaults are persisted. */
export const AdminTemplateRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  codeCategory: z.enum(['free', 'premium']), // the default baked into the TemplateRenderer
  listing: TemplateListingSchema.nullable(),
  hasListing: z.boolean(),
});
export type AdminTemplateRow = z.infer<typeof AdminTemplateRowSchema>;

export const UpdateTemplateListingRequestSchema = z.object({
  isActive: z.boolean().optional(),
  category: z.enum(['free', 'premium']).optional(),
  pointsCost: z.number().int().min(0).optional(),
  thumbnailUrl: z.string().url().optional().or(z.literal('')).optional(),
  displayOrder: z.number().int().optional(),
});
export type UpdateTemplateListingRequest = z.infer<typeof UpdateTemplateListingRequestSchema>;

// ---------------------------------------------------------------------------
// Subscription plans
// ---------------------------------------------------------------------------

export const SubscriptionPlanSchema = z.object({
  id: z.string().uuid(),
  tierKey: z.string(),
  name: z.string(),
  priceMonthlyUsd: z.number(),
  description: z.string().nullable(),
  features: z.array(z.string()),
  pointsGrantedMonthly: z.number().int().min(0),
  stripePriceId: z.string().nullable(),
  isActive: z.boolean(),
  displayOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;

export const UpsertSubscriptionPlanRequestSchema = z.object({
  tierKey: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  priceMonthlyUsd: z.number().min(0),
  description: z.string().max(500).optional(),
  features: z.array(z.string()).default([]),
  pointsGrantedMonthly: z.number().int().min(0).default(0),
  stripePriceId: z.string().optional(),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});
export type UpsertSubscriptionPlanRequest = z.infer<typeof UpsertSubscriptionPlanRequestSchema>;

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

export const AdminUserRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  role: z.enum(['USER', 'ADMIN']),
  subscriptionTier: z.enum(['FREE', 'PROFESSIONAL', 'PREMIUM']),
  pointsBalance: z.number().int(),
  isEmailVerified: z.boolean(),
  resumeCount: z.number().int(),
  createdAt: z.string().datetime(),
});
export type AdminUserRow = z.infer<typeof AdminUserRowSchema>;

export const AdminUserListResponseSchema = z.object({
  users: z.array(AdminUserRowSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type AdminUserListResponse = z.infer<typeof AdminUserListResponseSchema>;

export const GrantPointsRequestSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().int(), // positive = grant, negative = deduct
  reason: z.string().min(3).max(250),
});
export type GrantPointsRequest = z.infer<typeof GrantPointsRequestSchema>;

export const UpdateUserRoleRequestSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['USER', 'ADMIN']),
});
export type UpdateUserRoleRequest = z.infer<typeof UpdateUserRoleRequestSchema>;

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------

export const AdminDashboardStatsSchema = z.object({
  totalUsers: z.number().int(),
  newUsersLast7Days: z.number().int(),
  newUsersLast30Days: z.number().int(),
  activeSubscriptions: z.object({
    PROFESSIONAL: z.number().int(),
    PREMIUM: z.number().int(),
  }),
  totalResumes: z.number().int(),
  totalTemplatePurchases: z.number().int(),
  pointsInCirculation: z.number().int(),
});
export type AdminDashboardStats = z.infer<typeof AdminDashboardStatsSchema>;

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export const AdminAuditLogEntrySchema = z.object({
  id: z.string().uuid(),
  adminId: z.string().uuid(),
  adminEmail: z.string().email(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  metadata: z.unknown().nullable(),
  createdAt: z.string().datetime(),
});
export type AdminAuditLogEntry = z.infer<typeof AdminAuditLogEntrySchema>;
