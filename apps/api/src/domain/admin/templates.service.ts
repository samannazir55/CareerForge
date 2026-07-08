import { prisma } from '../../lib/prisma.js';
import { getAllTemplateMetadata } from '@careerforge/templates';
import { NotFoundError } from '../../lib/errors.js';
import { recordAuditLog } from './auditLog.js';
import type { UpdateTemplateListingRequest } from '@careerforge/schema';

/**
 * Admin template management. Deliberately does NOT let admins write
 * renderHtml/buildDocx logic — that stays in packages/templates as typed
 * code, per the architecture mandate that template isolation means
 * "given a Resume, produce the best rendering," with zero business logic
 * inside a template. This service only manages the metadata layer:
 * cost, visibility, category override, ordering, thumbnail.
 */
export const adminTemplatesService = {
  /** Returns every code-registered template merged with its DB listing,
   * if one exists. Templates with no listing row yet show code defaults
   * and hasListing: false — the row is created lazily on first edit. */
  async listAll() {
    const codeTemplates = getAllTemplateMetadata();
    const listings = await prisma.templateListing.findMany();
    const listingMap = new Map(listings.map((l) => [l.id, l]));

    return codeTemplates.map((t) => {
      const listing = listingMap.get(t.id);
      return {
        id: t.id,
        name: t.name,
        codeCategory: t.category,
        codeFamily: t.family,
        listing: listing
          ? {
              id: listing.id,
              isActive: listing.isActive,
              category: listing.category as 'free' | 'premium',
              family: listing.family,
              pointsCost: listing.pointsCost,
              thumbnailUrl: listing.thumbnailUrl,
              displayOrder: listing.displayOrder,
              createdAt: listing.createdAt.toISOString(),
              updatedAt: listing.updatedAt.toISOString(),
            }
          : null,
        hasListing: Boolean(listing),
      };
    });
  },

  /** Creates or updates the listing row for a template. The templateId
   * must correspond to a real code-registered template — admins cannot
   * create listings for templates that don't exist in the registry. */
  async upsertListing(
    adminId: string,
    templateId: string,
    input: UpdateTemplateListingRequest,
  ) {
    const codeTemplates = getAllTemplateMetadata();
    const codeTemplate = codeTemplates.find((t) => t.id === templateId);
    if (!codeTemplate) {
      throw new NotFoundError(`No template registered with id "${templateId}".`);
    }

    const listing = await prisma.templateListing.upsert({
      where: { id: templateId },
      create: {
        id: templateId,
        isActive: input.isActive ?? true,
        category: input.category ?? codeTemplate.category,
        family: input.family ?? codeTemplate.family,
        pointsCost: input.pointsCost ?? 0,
        thumbnailUrl: input.thumbnailUrl || null,
        displayOrder: input.displayOrder ?? 0,
      },
      update: {
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.family !== undefined && { family: input.family }),
        ...(input.pointsCost !== undefined && { pointsCost: input.pointsCost }),
        ...(input.thumbnailUrl !== undefined && { thumbnailUrl: input.thumbnailUrl || null }),
        ...(input.displayOrder !== undefined && { displayOrder: input.displayOrder }),
      },
    });

    await recordAuditLog(adminId, 'TEMPLATE_LISTING_UPDATE', 'TemplateListing', templateId, {
      ...input,
    });

    return listing;
  },
};
