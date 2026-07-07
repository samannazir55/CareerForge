import { z } from 'zod';

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
