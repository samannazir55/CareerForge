import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums — mirrored from Prisma so both sides stay in sync from one file.
// The Prisma schema uses these string values; never change them without
// a DB migration + schema version bump.
// ---------------------------------------------------------------------------

export const ProfileFactCategorySchema = z.enum([
  'IDENTITY',       // name, email, phone, location, website, linkedin
  'EXPERIENCE',     // individual work history entries
  'EDUCATION',      // degree / institution / year entries
  'SKILL',          // technical or soft skill entries
  'PROJECT',        // personal or work project entries
  'CERTIFICATION',  // professional certifications
  'LANGUAGE',       // spoken / written languages + proficiency
  'AWARD',          // honours, recognitions
  'PUBLICATION',    // papers, articles, books
  'GOAL',           // career aspirations, desired roles / industries
  'PREFERENCE',     // job type, location, salary range, work style
  'WRITING_STYLE',  // inferred tone, tense, vocabulary density
  'MISSING_INFO',   // gaps the AI has identified and wants to fill
]);
export type ProfileFactCategory = z.infer<typeof ProfileFactCategorySchema>;

export const FactSourceSchema = z.enum([
  'USER_CONFIRMED',   // user explicitly entered or confirmed
  'AI_EXTRACTED',     // AI extracted from an uploaded document
  'AI_INFERRED',      // AI inferred from conversation context
  'SYSTEM_GENERATED', // auto-generated (e.g. from OAuth profile name/email)
]);
export type FactSource = z.infer<typeof FactSourceSchema>;

// ---------------------------------------------------------------------------
// ProfileFact — one atomic unit of career knowledge.
//
// `key` is a namespaced string that uniquely identifies this fact within a
// profile. Convention: category:entity:attribute, e.g.
//   "experience:google:title"
//   "skill:typescript"
//   "preference:work_style"
//
// `value` is an untyped Json blob validated at the application layer by the
// per-category value schemas below. Storing typed column-per-attribute would
// require a DB migration every time a new attribute is needed; Json lets the
// schema evolve without touching the database.
//
// `confidenceScore` 0–100. 100 = user confirmed. 50 = AI inferred.
// Values below 40 are surfaced to the AI as "unverified — ask user to confirm."
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Per-category value schemas.
// These validate the `value` field at runtime before any fact is saved.
// The discriminated union ensures the right shape for each category.
// ---------------------------------------------------------------------------

export const IdentityValueSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  headline: z.string().optional(), // e.g. "Senior Frontend Engineer"
});
export type IdentityValue = z.infer<typeof IdentityValueSchema>;

export const ExperienceValueSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().optional(),
  startDate: z.string().optional(),   // ISO date string or "Present"
  endDate: z.string().optional(),
  description: z.string().optional(), // bullet points as newline-separated string
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
  category: z.string().optional(), // e.g. "Frontend", "DevOps", "Soft Skills"
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
  timeframe: z.string().optional(),   // e.g. "6 months"
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
  person: z.enum(['FIRST', 'THIRD', 'NONE']).optional(),   // "I led" vs "Led"
  tone: z.enum(['FORMAL', 'PROFESSIONAL', 'CONVERSATIONAL']).optional(),
  usesMetrics: z.boolean().optional(),   // tends to include numbers/percentages
  prefersBullets: z.boolean().optional(),
  avgSentenceLength: z.enum(['SHORT', 'MEDIUM', 'LONG']).optional(),
});
export type WritingStyleValue = z.infer<typeof WritingStyleValueSchema>;

export const MissingInfoValueSchema = z.object({
  description: z.string(), // what the AI wants to know
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  relatedCategory: ProfileFactCategorySchema.optional(),
});
export type MissingInfoValue = z.infer<typeof MissingInfoValueSchema>;

// ---------------------------------------------------------------------------
// API request / response DTOs
// ---------------------------------------------------------------------------

export const UpsertProfileFactRequestSchema = z.object({
  category: ProfileFactCategorySchema,
  key: z.string().min(1).max(250),
  value: z.unknown(),
  confidenceScore: z.number().int().min(0).max(100).optional().default(100), // user edits = 100
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