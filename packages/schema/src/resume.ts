import { z } from 'zod';

/**
 * ============================================================================
 * SCHEMA-DRIVEN RESUME ENGINE — CORE CONTRACT
 * ============================================================================
 * This file is THE single source of truth for "what a resume is." Both the
 * editor UI and the API's persistence/validation layer import these types
 * directly — neither side maintains its own parallel copy.
 *
 * A resume is an ordered list of Sections. Each Section has a `type`. Built-in
 * types (experience, education, ...) get a default field schema and a nicer
 * template layout as a presentational convenience, but structurally a
 * built-in section and a `custom` section are the same shape. This is what
 * makes "templates automatically render custom sections" true by
 * construction: a template never special-cases a section by name, only by
 * iterating `fields` generically with a fallback renderer.
 *
 * Full implementation (API persistence, version history, the actual template
 * render functions) lands in the Resume Core phase. This file defines the
 * contract now so nothing downstream has to guess at the shape.
 * ============================================================================
 */

export const FieldKindSchema = z.enum(['text', 'richtext', 'date', 'list', 'url']);
export type FieldKind = z.infer<typeof FieldKindSchema>;

export const FieldDefSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  kind: FieldKindSchema,
  required: z.boolean().default(false),
});
export type FieldDef = z.infer<typeof FieldDefSchema>;

export const SectionTypeSchema = z.enum([
  'experience',
  'education',
  'skills',
  'certifications',
  'projects',
  'languages',
  'references',
  'summary',
  'custom',
]);
export type SectionType = z.infer<typeof SectionTypeSchema>;

/** A single record within a section, e.g. one job in "Experience". */
export const EntrySchema = z.object({
  id: z.string().uuid(),
  values: z.record(z.string(), z.unknown()),
});
export type Entry = z.infer<typeof EntrySchema>;

export const SectionSchema = z.object({
  id: z.string().uuid(),
  type: SectionTypeSchema,
  title: z.string().min(1),
  order: z.number().int(),
  fields: z.array(FieldDefSchema),
  entries: z.array(EntrySchema),
});
export type Section = z.infer<typeof SectionSchema>;

export const ResumeThemeSchema = z.object({
  templateId: z.string(),
  accentColor: z.string().default('#4f46e5'),
  fontFamily: z.string().default('Inter'),
  // Cloudinary-hosted photo URL, set via the resume editor's photo
  // uploader. Optional -- most templates don't use it, and even ones that
  // do (see dynamicTemplateRenderer.ts's {{#photoUrl}}/{{^photoUrl}}
  // handling) fall back to a placeholder avatar when it's unset.
  photoUrl: z.string().url().optional(),
});
export type ResumeTheme = z.infer<typeof ResumeThemeSchema>;

export const DEFAULT_THEME: ResumeTheme = {
  templateId: 'modern',
  accentColor: '#4f46e5',
  fontFamily: 'Inter',
};

/**
 * ----------------------------------------------------------------------------
 * SCHEMA VERSIONING (per explicit requirement — see resumeMigrations.ts for
 * the migration framework itself; this file only declares the fields that
 * travel on every persisted resume/version record).
 *
 * `schemaVersion`: which version of THIS file's shape (the structural
 * contract — what `sections`/`theme` look like) the record currently
 * conforms to. Migrations are defined as fromVersion -> toVersion functions
 * and this is the number they read and advance.
 *
 * `migrationVersion`: a separate, monotonically increasing counter recording
 * the latest migration *step* applied to this specific record, including
 * steps that don't change schemaVersion at all (e.g. a future data-quality
 * backfill that re-normalizes date strings without altering the structural
 * shape). It exists so a non-structural fix can be marked "already applied"
 * to a record without that record falsely claiming a new structural schema
 * version it doesn't actually have. For a record that has never needed a
 * non-structural fix, migrationVersion simply equals schemaVersion.
 * ----------------------------------------------------------------------------
 */
export const SchemaVersionFieldsSchema = z.object({
  schemaVersion: z.number().int().min(0),
  migrationVersion: z.number().int().min(0),
});
export type SchemaVersionFields = z.infer<typeof SchemaVersionFieldsSchema>;

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});
export type ChatMessageEntry = z.infer<typeof ChatMessageSchema>;

export const ResumeSchema = z
  .object({
    id: z.string().uuid(),
    ownerId: z.string().uuid(),
    title: z.string().min(1),
    theme: ResumeThemeSchema,
    sections: z.array(SectionSchema),
    // The AI chat builder's full transcript for this resume, if it was
    // created/is being refined through that flow. Empty for resumes
    // started any other way. See sectionOperations.ts / the "resumes" table
    // migration for why this needs to be persisted at all — previously it
    // only ever lived in local component state.
    chatMessages: z.array(ChatMessageSchema).default([]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .merge(SchemaVersionFieldsSchema);
export type Resume = z.infer<typeof ResumeSchema>;

/** Lightweight shape for list views (dashboard "recent resumes", resume
 * count) — deliberately excludes the full sections payload. */
export const ResumeSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  templateId: z.string(),
  updatedAt: z.string().datetime(),
  schemaVersion: z.number().int(),
});
export type ResumeSummary = z.infer<typeof ResumeSummarySchema>;

/** An immutable snapshot of a resume at a point in time. Carries its own
 * schemaVersion/migrationVersion because a version created two schema
 * generations ago is still a valid historical record in whatever shape it
 * was actually saved in — it gets migrated in-memory only when it's read
 * for restore/compare, never silently rewritten in place. */
export const ResumeVersionSchema = z
  .object({
    id: z.string().uuid(),
    resumeId: z.string().uuid(),
    title: z.string(),
    theme: ResumeThemeSchema,
    sections: z.array(SectionSchema),
    label: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .merge(SchemaVersionFieldsSchema);
export type ResumeVersion = z.infer<typeof ResumeVersionSchema>;

export const ResumeVersionSummarySchema = z.object({
  id: z.string().uuid(),
  label: z.string().nullable(),
  createdAt: z.string().datetime(),
  schemaVersion: z.number().int(),
});
export type ResumeVersionSummary = z.infer<typeof ResumeVersionSummarySchema>;

// --- Request DTOs --------------------------------------------------------------

export const CreateResumeRequestSchema = z.object({
  title: z.string().min(1).max(200),
});
export type CreateResumeRequest = z.infer<typeof CreateResumeRequestSchema>;

export const UpdateResumeRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  theme: ResumeThemeSchema.optional(),
  sections: z.array(SectionSchema).optional(),
  chatMessages: z.array(ChatMessageSchema).optional(),
});
export type UpdateResumeRequest = z.infer<typeof UpdateResumeRequestSchema>;

export const CreateVersionRequestSchema = z.object({
  label: z.string().max(120).optional(),
});
export type CreateVersionRequest = z.infer<typeof CreateVersionRequestSchema>;

/** A generic, section/entry-level diff between two versions. Built from
 * matching section/entry ids rather than array position, so a reordered
 * section doesn't register as "removed + added." */
export interface SectionDiffEntry {
  entryId: string;
  status: 'added' | 'removed' | 'changed' | 'unchanged';
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changedFields: string[];
}
export interface SectionDiff {
  sectionId: string;
  title: string;
  status: 'added' | 'removed' | 'changed' | 'unchanged';
  entries: SectionDiffEntry[];
}
export interface ResumeVersionDiff {
  sections: SectionDiff[];
}

/**
 * Default field schemas for every built-in section type. A `custom` section
 * starts with an empty field list and the user defines its fields when they
 * create it — the editor UI offers an "Add field" control in that case.
 */
export const DEFAULT_SECTION_FIELDS: Record<Exclude<SectionType, 'custom'>, FieldDef[]> = {
  // The summary section doubles as the resume's "header": besides the
  // summary paragraph itself, its first entry is where getPersonalInfo()
  // (packages/templates/src/helpers.ts) reads firstName/lastName/jobTitle/
  // email/phone/location/linkedin/website from — every template already
  // renders these if present. They were missing from here entirely,
  // though, which meant there was no input anywhere in the manual editor
  // to set or edit them: EntryCard/FieldInput only ever render one input
  // per entry in `section.fields`, so a key with no FieldDef had no UI at
  // all, even though a value for it could still arrive via the AI chat
  // builder or an import. firstName/lastName are stored separately (rather
  // than as one `name` string) specifically so templates can style each
  // independently (e.g. a different color per part) — see modern.ts /
  // classic.ts's header rendering and helpers.ts's name-fallback logic for
  // resumes saved before this existed. All contact fields are optional
  // (required: false) since not every resume needs all of them, and the
  // summary paragraph itself keeps its spot last so it still reads as the
  // section's main "body" content.
  summary: [
    { key: 'firstName', label: 'First Name', kind: 'text', required: false },
    { key: 'lastName', label: 'Last Name', kind: 'text', required: false },
    { key: 'jobTitle', label: 'Job Title / Headline', kind: 'text', required: false },
    { key: 'email', label: 'Email', kind: 'text', required: false },
    { key: 'phone', label: 'Phone', kind: 'text', required: false },
    { key: 'location', label: 'Location', kind: 'text', required: false },
    { key: 'linkedin', label: 'LinkedIn', kind: 'url', required: false },
    { key: 'website', label: 'Website', kind: 'url', required: false },
    { key: 'text', label: 'Summary', kind: 'richtext', required: true },
  ],
  experience: [
    { key: 'title', label: 'Job Title', kind: 'text', required: true },
    { key: 'company', label: 'Company', kind: 'text', required: true },
    { key: 'location', label: 'Location', kind: 'text', required: false },
    { key: 'startDate', label: 'Start Date', kind: 'date', required: false },
    { key: 'endDate', label: 'End Date', kind: 'date', required: false },
    { key: 'description', label: 'Description', kind: 'richtext', required: false },
  ],
  education: [
    { key: 'degree', label: 'Degree', kind: 'text', required: true },
    { key: 'school', label: 'School', kind: 'text', required: true },
    { key: 'startDate', label: 'Start Date', kind: 'date', required: false },
    { key: 'endDate', label: 'End Date', kind: 'date', required: false },
  ],
  skills: [{ key: 'name', label: 'Skill', kind: 'text', required: true }],
  certifications: [
    { key: 'name', label: 'Certification', kind: 'text', required: true },
    { key: 'issuer', label: 'Issuer', kind: 'text', required: false },
    { key: 'date', label: 'Date', kind: 'date', required: false },
  ],
  projects: [
    { key: 'name', label: 'Project Name', kind: 'text', required: true },
    { key: 'description', label: 'Description', kind: 'richtext', required: false },
    { key: 'url', label: 'Link', kind: 'url', required: false },
  ],
  languages: [
    { key: 'name', label: 'Language', kind: 'text', required: true },
    { key: 'proficiency', label: 'Proficiency', kind: 'text', required: false },
  ],
  references: [
    { key: 'name', label: 'Name', kind: 'text', required: true },
    { key: 'relationship', label: 'Relationship', kind: 'text', required: false },
    { key: 'contact', label: 'Contact', kind: 'text', required: false },
  ],
};

/** Seeds a brand-new resume with the most common built-in sections, empty.
 * Users can delete any of these or add custom ones — nothing here is
 * special-cased downstream, it's just a friendlier starting point than a
 * blank sections array. */
export function buildDefaultSections(): Section[] {
  const make = (type: Exclude<SectionType, 'custom'>, title: string, order: number): Section => ({
    id: crypto.randomUUID(),
    type,
    title,
    order,
    fields: DEFAULT_SECTION_FIELDS[type],
    entries: [],
  });

  return [
    make('summary', 'Summary', 0),
    make('experience', 'Experience', 1),
    make('education', 'Education', 2),
    make('skills', 'Skills', 3),
  ];
}