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
});
export type ResumeTheme = z.infer<typeof ResumeThemeSchema>;

export const ResumeSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  title: z.string().min(1),
  theme: ResumeThemeSchema,
  sections: z.array(SectionSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Resume = z.infer<typeof ResumeSchema>;

/**
 * Default field schemas for every built-in section type. A `custom` section
 * starts with an empty field list and the user defines its fields when they
 * create it — the editor UI offers an "Add field" control in that case.
 */
export const DEFAULT_SECTION_FIELDS: Record<Exclude<SectionType, 'custom'>, FieldDef[]> = {
  summary: [{ key: 'text', label: 'Summary', kind: 'richtext', required: true }],
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
