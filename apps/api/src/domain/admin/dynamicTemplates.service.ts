import { prisma } from '../../lib/prisma.js';
import { recordAuditLog } from './auditLog.js';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateDynamicTemplateInput {
  name: string;
  slug: string;
  category: string;
  /** Optional — defaults to 'modern' (matches the DB column default) when
   * omitted, so callers that don't have a strong opinion (e.g. the bulk
   * generation script, which varies layout/tone/persona directly instead
   * of the family taxonomy) don't need to supply one. */
  family?: string;
  templateHtml: string;
  thumbnailUrl?: string;
  pointsCost?: number;
  displayOrder?: number;
  promptUsed?: string;
}

export interface UpdateDynamicTemplateInput extends Partial<CreateDynamicTemplateInput> {
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RESERVED_SLUGS = new Set(['modern', 'classic', 'minimal', 'executive']);

function validateSlug(slug: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new BadRequestError(
      'Slug must be lowercase alphanumeric with hyphens only (e.g. "creative-blue").',
    );
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new BadRequestError(
      `"${slug}" is reserved for a built-in code template. Choose a different slug.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const dynamicTemplatesService = {
  async list() {
    return prisma.dynamicTemplate.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  },

  async getById(id: string) {
    const t = await prisma.dynamicTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundError('Dynamic template not found.');
    return t;
  },

  async getBySlug(slug: string) {
    return prisma.dynamicTemplate.findUnique({ where: { slug } });
  },

  async create(adminId: string, input: CreateDynamicTemplateInput) {
    validateSlug(input.slug);

    const existing = await prisma.dynamicTemplate.findUnique({
      where: { slug: input.slug },
    });
    if (existing) {
      throw new BadRequestError(`A template with slug "${input.slug}" already exists.`);
    }

    const template = await prisma.dynamicTemplate.create({
      data: {
        name:         input.name,
        slug:         input.slug,
        category:     input.category,
        family:       input.family ?? 'modern',
        templateHtml: input.templateHtml,
        thumbnailUrl: input.thumbnailUrl ?? null,
        pointsCost:   input.pointsCost  ?? 0,
        displayOrder: input.displayOrder ?? 0,
        promptUsed:   input.promptUsed  ?? null,
        isActive:     true,
      },
    });

    await recordAuditLog(adminId, 'DYNAMIC_TEMPLATE_CREATE', 'DynamicTemplate', template.id, {
      name: template.name,
      slug: template.slug,
    });

    return template;
  },

  async update(adminId: string, id: string, input: UpdateDynamicTemplateInput) {
    await dynamicTemplatesService.getById(id); // throws 404 if missing

    if (input.slug) validateSlug(input.slug);

    const template = await prisma.dynamicTemplate.update({
      where: { id },
      data: {
        ...(input.name         !== undefined && { name:         input.name }),
        ...(input.slug         !== undefined && { slug:         input.slug }),
        ...(input.category     !== undefined && { category:     input.category }),
        ...(input.family       !== undefined && { family:       input.family }),
        ...(input.templateHtml !== undefined && { templateHtml: input.templateHtml }),
        ...(input.thumbnailUrl !== undefined && { thumbnailUrl: input.thumbnailUrl }),
        ...(input.pointsCost   !== undefined && { pointsCost:   input.pointsCost }),
        ...(input.displayOrder !== undefined && { displayOrder: input.displayOrder }),
        ...(input.isActive     !== undefined && { isActive:     input.isActive }),
      },
    });

    await recordAuditLog(adminId, 'DYNAMIC_TEMPLATE_UPDATE', 'DynamicTemplate', id, {
      fields: Object.keys(input),
    });

    return template;
  },

  async delete(adminId: string, id: string) {
    await dynamicTemplatesService.getById(id); // throws 404 if missing

    await prisma.dynamicTemplate.delete({ where: { id } });

    await recordAuditLog(adminId, 'DYNAMIC_TEMPLATE_DELETE', 'DynamicTemplate', id, {});
  },
};
