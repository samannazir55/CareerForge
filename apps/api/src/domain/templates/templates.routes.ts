import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/authGuard.js';
import { prisma } from '../../lib/prisma.js';
import { getAllTemplateMetadata } from '@careerforge/templates';
import type { PublicTemplateListItem } from '@careerforge/schema';
import { NotFoundError } from '../../lib/errors.js';
import { resolveTemplate } from './templateResolver.js';
import { SAMPLE_RESUME } from '../admin/sampleResume.js';

export const templatesRouter = Router();

/**
 * Public (any authenticated user) list of selectable templates — the merge
 * of code-registered templates (packages/templates) with their optional
 * TemplateListing override (cost/category/ordering set by an admin) and
 * active DynamicTemplate rows (admin-generated HTML templates). This is the
 * single source of truth the AI chat builder's template switcher reads from,
 * so a template an admin deactivates or reprices there is reflected here
 * without a frontend deploy.
 */
templatesRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const codeTemplates = getAllTemplateMetadata();
    const [listings, dynamicTemplates] = await Promise.all([
      prisma.templateListing.findMany(),
      prisma.dynamicTemplate.findMany({ where: { isActive: true } }),
    ]);
    const listingMap = new Map(listings.map((l) => [l.id, l]));

    const fromCode: PublicTemplateListItem[] = codeTemplates
      .filter((t) => listingMap.get(t.id)?.isActive !== false)
      .map((t, index) => {
        const listing = listingMap.get(t.id);
        return {
          id: t.id,
          slug: t.id,
          name: t.name,
          category: (listing?.category as 'free' | 'premium' | undefined) ?? t.category,
          family: (listing?.family as PublicTemplateListItem['family'] | undefined) ?? (t.family as PublicTemplateListItem['family']),
          pointsCost: listing?.pointsCost ?? 0,
          thumbnailUrl: listing?.thumbnailUrl ?? null,
          displayOrder: listing?.displayOrder ?? index,
          isDynamic: false,
        };
      });

    const fromDynamic: PublicTemplateListItem[] = dynamicTemplates.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      category: t.category === 'premium' ? 'premium' : 'free',
      family: t.family as PublicTemplateListItem['family'],
      pointsCost: t.pointsCost,
      thumbnailUrl: t.thumbnailUrl,
      displayOrder: t.displayOrder,
      isDynamic: true,
    }));

    const templates = [...fromCode, ...fromDynamic].sort((a, b) => a.displayOrder - b.displayOrder);

    res.status(200).json({ templates });
  }),
);

/**
 * Real CV preview for the marketplace and template-switcher "View More"
 * flow — renders the actual template HTML with a realistic sample resume
 * (same SAMPLE_RESUME the admin authoring preview uses) so a shopper can
 * see what they're about to spend points on instead of a generic mock-block
 * placeholder. Works for both code-registered templates (modern, classic)
 * and admin/AI-generated DynamicTemplate rows.
 *
 * 404s explicitly for an unknown/inactive id rather than silently falling
 * back to Modern (which is what resolveTemplate() does for callers that
 * render a real resume and always need *something* to show) — a bad id
 * here should surface as "this template isn't available" in the UI, not
 * quietly render Modern as if that were the actual template.
 */
templatesRouter.get(
  '/:id/preview',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const isCodeTemplate = getAllTemplateMetadata().some((t) => t.id === id);
    const dynamic = isCodeTemplate ? null : await prisma.dynamicTemplate.findUnique({ where: { id } });

    if (!isCodeTemplate && (!dynamic || !dynamic.isActive)) {
      throw new NotFoundError('Template not found.');
    }

    const resolved = await resolveTemplate(id);
    const html = resolved.renderHtml(SAMPLE_RESUME);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(html);
  }),
);
