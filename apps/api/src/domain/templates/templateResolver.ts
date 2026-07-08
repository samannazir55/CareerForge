import type { Resume } from '@careerforge/schema';
import { getTemplate as getCodeTemplate, getAllTemplateMetadata } from '@careerforge/templates';
import { prisma } from '../../lib/prisma.js';
import { renderDynamicTemplate } from '../admin/dynamicTemplateRenderer.js';

/**
 * ============================================================================
 * TEMPLATE RESOLUTION — the single place that knows about BOTH template
 * sources (code-registered, in packages/templates, AND admin-created
 * DynamicTemplate rows in Postgres).
 * ============================================================================
 * Bug this fixes: every call site that needed to render a resume was
 * calling `getTemplate()` from @careerforge/templates directly. That
 * function's registry only ever contains the two code templates (modern,
 * classic) — it has no knowledge of the DynamicTemplate table at all. Its
 * built-in "graceful fallback" (silently returning Modern for any unknown
 * id) meant that ANY resume using an admin-generated template rendered as
 * Modern everywhere: the live editor preview, the AI chat builder preview,
 * and PDF/DOCX export. Only "classic" ever looked different, because it's
 * the one other id that actually exists in that code registry.
 *
 * This resolver checks the code registry first (by exact id membership,
 * not getTemplate()'s fallback-prone lookup), then falls through to the
 * DynamicTemplate table, and only falls back to Modern if truly nothing
 * matches (e.g. a template was deleted after a resume already referenced
 * it) — logging a warning in that case same as before.
 */

const CODE_TEMPLATE_IDS = new Set(getAllTemplateMetadata().map((t) => t.id));

export interface ResolvedTemplate {
  /** The template id that was actually used to render (may differ from the
   * requested id if a fallback occurred). */
  id: string;
  isDynamic: boolean;
  isPremium: boolean;
  renderHtml(resume: Resume): string;
  /** Dynamic (AI/admin-generated) templates are arbitrary HTML/CSS with no
   * reliable generic mapping to OOXML, so DOCX isn't supported for them —
   * this is null for dynamic templates, and callers must check for that
   * before invoking it. */
  buildDocx: ((resume: Resume) => Promise<Buffer>) | null;
}

export async function resolveTemplate(templateId: string): Promise<ResolvedTemplate> {
  // 1. Code-registered template (modern, classic, …) — exact match only.
  if (CODE_TEMPLATE_IDS.has(templateId)) {
    const template = getCodeTemplate(templateId);
    return {
      id: template.id,
      isDynamic: false,
      isPremium: template.category === 'premium',
      renderHtml: (resume) => template.renderHtml(resume),
      buildDocx: (resume) => template.buildDocx(resume),
    };
  }

  // 2. Admin-created dynamic template stored in Postgres.
  const dynamic = await prisma.dynamicTemplate.findUnique({ where: { id: templateId } });
  if (dynamic && dynamic.isActive) {
    return {
      id: dynamic.id,
      isDynamic: true,
      isPremium: dynamic.category === 'premium',
      renderHtml: (resume) => renderDynamicTemplate(dynamic.templateHtml, resume),
      buildDocx: null,
    };
  }

  // 3. Graceful fallback — the id doesn't correspond to anything live
  // (deleted dynamic template, deactivated template, or a bad id).
  console.warn(`Template "${templateId}" not found or inactive; falling back to "modern".`);
  const fallback = getCodeTemplate('modern');
  return {
    id: fallback.id,
    isDynamic: false,
    isPremium: false,
    renderHtml: (resume) => fallback.renderHtml(resume),
    buildDocx: (resume) => fallback.buildDocx(resume),
  };
}
