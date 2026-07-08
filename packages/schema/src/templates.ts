import { z } from 'zod';

/**
 * The design-family taxonomy used both to categorize/filter templates in
 * the marketplace and as a field on the admin AI template generator (where
 * it steers the system prompt's design brief, in addition to whatever the
 * admin's own free-text prompt says). `brief` is admin-facing only — it's
 * folded into the AI generation prompt in admin.routes.ts, never sent to
 * end users.
 */
export const TEMPLATE_FAMILIES = [
  {
    id: 'executive',
    label: 'Executive',
    description: 'Managers, consultants, finance, law, C-suite',
    brief: 'Dark, elegant tones (deep navy/charcoal/black) with a restrained accent — gold, burgundy, or steel blue. Serif or slab-serif display type for headings paired with a clean sans body. Reads as senior and authoritative, never flashy.',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'ATS-friendly, Scandinavian, lots of whitespace',
    brief: 'Single-column, generous whitespace, near-monochrome palette with at most one restrained accent used sparingly. Plain, highly legible sans-serif type, no decorative elements. Optimized for ATS parsing and calm, uncluttered reading.',
  },
  {
    id: 'creative',
    label: 'Creative',
    description: 'Designers, marketers, content creators, architects',
    brief: 'Confident, expressive layout — asymmetric header, a timeline/rule-driven structure, or bold color blocking. A distinctive type pairing (a characterful display face for the name) and a bolder accent palette than most other families. Should feel designed, not templated.',
  },
  {
    id: 'academic',
    label: 'Academic',
    description: 'Researchers, professors, PhD applicants, publication-heavy CVs',
    brief: 'Dense, single-column, traditional serif-led type system built to hold a lot of text (publications, grants, teaching) cleanly across many pages. Understated color — mostly ink-on-white — with clear, consistent section hierarchy rather than visual flourish.',
  },
  {
    id: 'technical',
    label: 'Technical',
    description: 'Software engineers, data scientists, cybersecurity, compact information density',
    brief: 'Compact/dense layout, tight but legible line-height, monospace or geometric-sans accents for skills/tools. Optimized for fitting a lot of content (skills, projects, stack) cleanly — reads as senior/technical/ATS-conscious, not decorative.',
  },
  {
    id: 'luxury',
    label: 'Luxury',
    description: 'Canva-inspired premium aesthetic, tasteful color palettes, editorial layouts',
    brief: 'Editorial magazine-like composition — refined type scale, tasteful use of color blocking or a soft tinted background, generous margins. Should feel premium and considered, like a well-art-directed spread, without becoming loud or busy.',
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    description: 'Larger project sections, GitHub/Behance/Dribbble emphasis',
    brief: 'Give the projects loop visual priority — larger cards or a grid-like rhythm, room for project descriptions to breathe. Contact/links (linkedin, website) should be prominent in the header since these fields often carry a portfolio URL.',
  },
  {
    id: 'modern',
    label: 'Modern',
    description: 'Contemporary corporate layouts with subtle visual flair',
    brief: 'A contemporary sidebar or header-band layout with one confident accent color used consistently (rules, tags, one background block). Clean sans-serif type system with clear hierarchy. Polished and current without being experimental.',
  },
  {
    id: 'classic',
    label: 'Classic',
    description: 'Traditional layouts for government, healthcare, education, conservative industries',
    brief: 'Traditional single-column, centered header, conservative serif or classic sans type, minimal color (near-monochrome with perhaps one muted accent). Timeless and safe — the kind of resume that reads as appropriate in any conservative industry.',
  },
] as const;

export type TemplateFamily = (typeof TEMPLATE_FAMILIES)[number]['id'];

export const TEMPLATE_FAMILY_IDS = TEMPLATE_FAMILIES.map((f) => f.id) as [TemplateFamily, ...TemplateFamily[]];

export const TemplateFamilySchema = z.enum(TEMPLATE_FAMILY_IDS);

/**
 * A single entry in the public template list — the merged view of
 * code-registered templates (packages/templates, e.g. "modern", "classic")
 * and admin-created dynamic templates (DynamicTemplate rows in the DB),
 * as returned by GET /api/templates. Consumed by the template switcher on
 * the AI chat builder and by the resume editor's export gating.
 */
export const PublicTemplateListItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: z.enum(['free', 'premium']),
  family: TemplateFamilySchema,
  pointsCost: z.number().int().min(0),
  thumbnailUrl: z.string().nullable(),
  displayOrder: z.number().int(),
  isDynamic: z.boolean(),
});
export type PublicTemplateListItem = z.infer<typeof PublicTemplateListItemSchema>;

/**
 * The fixed set of ids reserved for code-registered templates (see
 * RESERVED_SLUGS in apps/api/src/domain/admin/dynamicTemplates.service.ts —
 * kept in sync with that list). Any templateId outside this set refers to a
 * DB-backed DynamicTemplate row (Prisma-generated uuid), not a template in
 * packages/templates's registry.
 */
const CODE_TEMPLATE_IDS = new Set(['modern', 'classic', 'minimal', 'executive']);

/**
 * Dynamic (admin-generated) templates are arbitrary HTML/CSS with no
 * reliable generic mapping to OOXML, so DOCX export isn't supported for
 * them (see export.service.ts). Callers use this to decide, from a
 * resume's theme.templateId alone, whether to show the DOCX export option
 * or look the id up as a code template at all.
 */
export function isDynamicTemplateId(templateId: string): boolean {
  return !CODE_TEMPLATE_IDS.has(templateId);
}
