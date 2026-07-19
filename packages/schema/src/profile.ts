import { z } from 'zod';

export const ProfileFactCategorySchema = z.enum([
  'IDENTITY', 'EXPERIENCE', 'EDUCATION', 'SKILL', 'PROJECT', 'CERTIFICATION',
  'LANGUAGE', 'AWARD', 'PUBLICATION', 'GOAL', 'PREFERENCE', 'WRITING_STYLE', 'MISSING_INFO',
]);
export type ProfileFactCategory = z.infer<typeof ProfileFactCategorySchema>;

export const FactSourceSchema = z.enum([
  'USER_CONFIRMED', 'AI_EXTRACTED', 'AI_INFERRED', 'SYSTEM_GENERATED',
]);
export type FactSource = z.infer<typeof FactSourceSchema>;

export const ProfileFactSchema = z.object({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  category: ProfileFactCategorySchema,
  key: z.string().min(1).max(250),
  value: z.unknown(),
  confidenceScore: z.number().int().min(0).max(100),
  source: FactSourceSchema,
  lastVerifiedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProfileFact = z.infer<typeof ProfileFactSchema>;

export const CareerProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CareerProfile = z.infer<typeof CareerProfileSchema>;

export const IdentityValueSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  headline: z.string().optional(),
});
export type IdentityValue = z.infer<typeof IdentityValueSchema>;

export const ExperienceValueSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional(),
  isCurrent: z.boolean().default(false),
});
export type ExperienceValue = z.infer<typeof ExperienceValueSchema>;

export const EducationValueSchema = z.object({
  degree: z.string(),
  field: z.string().optional(),
  institution: z.string(),
  location: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  gpa: z.string().optional(),
  honours: z.string().optional(),
});
export type EducationValue = z.infer<typeof EducationValueSchema>;

export const SkillValueSchema = z.object({
  name: z.string(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional(),
  yearsOfExperience: z.number().optional(),
  category: z.string().optional(),
});
export type SkillValue = z.infer<typeof SkillValueSchema>;

export const ProjectValueSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  url: z.string().url().optional().or(z.literal('')),
  techStack: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
export type ProjectValue = z.infer<typeof ProjectValueSchema>;

export const CertificationValueSchema = z.object({
  name: z.string(),
  issuer: z.string().optional(),
  date: z.string().optional(),
  expiryDate: z.string().optional(),
  credentialId: z.string().optional(),
  url: z.string().url().optional().or(z.literal('')),
});
export type CertificationValue = z.infer<typeof CertificationValueSchema>;

export const LanguageValueSchema = z.object({
  name: z.string(),
  proficiency: z.enum(['BASIC', 'CONVERSATIONAL', 'PROFESSIONAL', 'NATIVE']),
});
export type LanguageValue = z.infer<typeof LanguageValueSchema>;

export const AwardValueSchema = z.object({
  title: z.string(),
  issuer: z.string().optional(),
  date: z.string().optional(),
  description: z.string().optional(),
});
export type AwardValue = z.infer<typeof AwardValueSchema>;

export const PublicationValueSchema = z.object({
  title: z.string(),
  publisher: z.string().optional(),
  date: z.string().optional(),
  url: z.string().url().optional().or(z.literal('')),
  description: z.string().optional(),
});
export type PublicationValue = z.infer<typeof PublicationValueSchema>;

export const GoalValueSchema = z.object({
  targetRole: z.string().optional(),
  targetIndustry: z.string().optional(),
  targetCountry: z.string().optional(),
  timeframe: z.string().optional(),
  description: z.string().optional(),
});
export type GoalValue = z.infer<typeof GoalValueSchema>;

export const PreferenceValueSchema = z.object({
  workType: z.enum(['REMOTE', 'HYBRID', 'ON_SITE', 'FLEXIBLE']).optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  salaryCurrency: z.string().optional(),
  companySizePreference: z.enum(['STARTUP', 'SCALE_UP', 'ENTERPRISE', 'ANY']).optional(),
  willingToRelocate: z.boolean().optional(),
  noticePeriod: z.string().optional(),
});
export type PreferenceValue = z.infer<typeof PreferenceValueSchema>;

export const WritingStyleValueSchema = z.object({
  tense: z.enum(['PAST', 'PRESENT', 'MIXED']).optional(),
  person: z.enum(['FIRST', 'THIRD', 'NONE']).optional(),
  tone: z.enum(['FORMAL', 'PROFESSIONAL', 'CONVERSATIONAL']).optional(),
  usesMetrics: z.boolean().optional(),
  prefersBullets: z.boolean().optional(),
  avgSentenceLength: z.enum(['SHORT', 'MEDIUM', 'LONG']).optional(),
});
export type WritingStyleValue = z.infer<typeof WritingStyleValueSchema>;

export const MissingInfoValueSchema = z.object({
  description: z.string(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  relatedCategory: ProfileFactCategorySchema.optional(),
});
export type MissingInfoValue = z.infer<typeof MissingInfoValueSchema>;

export const UpsertProfileFactRequestSchema = z.object({
  category: ProfileFactCategorySchema,
  key: z.string().min(1).max(250),
  value: z.unknown(),
  confidenceScore: z.number().int().min(0).max(100).optional().default(100),
  source: FactSourceSchema.optional().default('USER_CONFIRMED'),
});
export type UpsertProfileFactRequest = z.infer<typeof UpsertProfileFactRequestSchema>;

export const ProfileCompletenessSchema = z.object({
  score: z.number().int().min(0).max(100),
  breakdown: z.object({
    identity: z.number(),
    experience: z.number(),
    education: z.number(),
    skills: z.number(),
    goals: z.number(),
  }),
  missingHighPriority: z.array(z.string()),
});
export type ProfileCompleteness = z.infer<typeof ProfileCompletenessSchema>;

export const ProfileWithFactsSchema = CareerProfileSchema.extend({
  facts: z.array(ProfileFactSchema),
  completeness: ProfileCompletenessSchema,
});
export type ProfileWithFacts = z.infer<typeof ProfileWithFactsSchema>;

// ---------------------------------------------------------------------------
// Public portfolio — /u/:slug
// ---------------------------------------------------------------------------

/** Full CareerProfile row including the public-portfolio fields, as
 * returned by the authenticated public-settings endpoints (GET /profile
 * already returns ProfileWithFacts without these — they're additive here
 * rather than folded into CareerProfileSchema so existing callers of
 * ProfileWithFacts are unaffected). */
export const CareerProfilePublicFieldsSchema = z.object({
  publicSlug: z.string().nullable(),
  isPublic: z.boolean(),
  headline: z.string().nullable(),
  bio: z.string().nullable(),
  location: z.string().nullable(),
  website: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  githubUrl: z.string().nullable(),
  twitterUrl: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});
export type CareerProfilePublicFields = z.infer<typeof CareerProfilePublicFieldsSchema>;

export const CareerProfileWithPublicFieldsSchema = CareerProfileSchema.merge(CareerProfilePublicFieldsSchema);
export type CareerProfileWithPublicFields = z.infer<typeof CareerProfileWithPublicFieldsSchema>;

// Slug rule shared by client-side validation and the server: 3-30 chars,
// lowercase letters/numbers/hyphens, no leading/trailing/double hyphens —
// kept simple and readable since this becomes a public URL segment.
export const PUBLIC_SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const UpdatePublicProfileSettingsRequestSchema = z.object({
  publicSlug: z.string().trim().toLowerCase().min(3).max(30).regex(PUBLIC_SLUG_REGEX, 'Use lowercase letters, numbers, and single hyphens only.').optional(),
  isPublic: z.boolean().optional(),
  headline: z.string().trim().max(150).optional(),
  bio: z.string().trim().max(1000).optional(),
  location: z.string().trim().max(100).optional(),
  website: z.string().trim().url().max(300).optional().or(z.literal('')),
  linkedinUrl: z.string().trim().url().max(300).optional().or(z.literal('')),
  githubUrl: z.string().trim().url().max(300).optional().or(z.literal('')),
  twitterUrl: z.string().trim().url().max(300).optional().or(z.literal('')),
});
export type UpdatePublicProfileSettingsRequest = z.infer<typeof UpdatePublicProfileSettingsRequestSchema>;

export const PublicResumeSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  templateId: z.string(),
  templateName: z.string(),
  slug: z.string(),
  viewCount: z.number().int(),
});
export type PublicResumeSummary = z.infer<typeof PublicResumeSummarySchema>;

export const PublicProfileSchema = z.object({
  fullName: z.string().nullable(),
  headline: z.string().nullable(),
  bio: z.string().nullable(),
  location: z.string().nullable(),
  website: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  githubUrl: z.string().nullable(),
  twitterUrl: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isPublic: z.boolean(),
  publicResumes: z.array(PublicResumeSummarySchema),
  skills: z.array(z.string()),
  totalResumeViews: z.number().int(),
});
export type PublicProfile = z.infer<typeof PublicProfileSchema>;

export const SlugAvailabilitySchema = z.object({
  available: z.boolean(),
});
export type SlugAvailability = z.infer<typeof SlugAvailabilitySchema>;
