import type { Resume } from '@careerforge/schema';

/**
 * ============================================================================
 * TEMPLATE CONTRACT
 * ============================================================================
 * A TemplateRenderer is a pure data-in / HTML-out (or DOCX-out) function.
 *
 * Business rules (premium gating, subscription checks, download permissions)
 * live in export.service.ts — NEVER inside a template. A template's only job
 * is: given a Resume, produce the best possible rendering of it. This is what
 * "template isolation" means in the architecture mandate.
 *
 * The renderHtml function is called in two different contexts:
 * 1. Browser (live preview) — the HTML string is set via dangerouslySetInnerHTML.
 * 2. API export service — the HTML string is fed to Puppeteer's page.setContent()
 *    for PDF generation.
 *
 * Because the exact same function runs in both contexts, the PDF is provably
 * WYSIWYG with what the user sees in the editor, by construction — not by
 * cross-checking two separate implementations.
 * ============================================================================
 */

export interface TemplateRenderer {
  id: string;
  name: string;
  category: 'free' | 'premium';
  /** Which design family this template belongs to (see TEMPLATE_FAMILIES
   * in @careerforge/schema) — used for marketplace filtering. Code
   * templates declare this statically since it's inherent to the design,
   * unlike admin-generated DynamicTemplate rows where an admin picks it. */
  family: string;
  /** CSS class suffix shown in the marketplace for preview thumbnails. */
  previewClass: string;
  renderHtml(resume: Resume): string;
  buildDocx(resume: Resume): Promise<Buffer>;
}

export interface TemplateMetadata {
  id: string;
  name: string;
  category: 'free' | 'premium';
  family: string;
  previewClass: string;
}
