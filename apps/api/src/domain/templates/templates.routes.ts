import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/authGuard.js';
import { prisma } from '../../lib/prisma.js';
import { getAllTemplateMetadata } from '@careerforge/templates';
import type { PublicTemplateListItem } from '@careerforge/schema';

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
          family: (listing?.family as string | undefined) ?? t.family,
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
