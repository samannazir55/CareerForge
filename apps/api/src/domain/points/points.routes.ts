import { Router } from 'express';
import { requireAuth, requireVerifiedEmail } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { pointsService } from './points.service.js';
import { getAllTemplateMetadata, isPremiumTemplate } from '@careerforge/templates';
import { prisma } from '../../lib/prisma.js';
import { BadRequestError } from '../../lib/errors.js';

export const pointsRouter = Router();

const TEMPLATE_COSTS: Record<string, number> = {
  'executive-pro': 500,
  'silicon-valley': 400,
  'academic-researcher': 400,
  'startup-founder': 400,
  'healthcare-professional': 400,
  'finance-professional': 400,
  'ats-elite': 300,
  'german-bewerbung': 300,
};

pointsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const [balance, transactions] = await Promise.all([
      pointsService.getBalance(req.user!.id),
      pointsService.getTransactions(req.user!.id),
    ]);
    res.status(200).json({ balance, transactions });
  }),
);

pointsRouter.post(
  '/purchase-template',
  requireAuth,
  requireVerifiedEmail,
  asyncHandler(async (req, res) => {
    const { templateId } = req.body as { templateId?: string };
    if (!templateId) throw new BadRequestError('templateId is required.');

    // Code-registered templates (modern/classic/…) keep their existing
    // hardcoded cost table. Anything not in that registry is looked up as
    // a DynamicTemplate row instead — without this branch, every
    // AI-generated premium template would 400 as "unknown" the moment it
    // showed up in the marketplace, since isPremiumTemplate() only ever
    // checks the code registry.
    if (getAllTemplateMetadata().some((t) => t.id === templateId)) {
      if (!isPremiumTemplate(templateId)) {
        throw new BadRequestError('This template is free and does not require a purchase.', 'FREE_TEMPLATE');
      }
      const cost = TEMPLATE_COSTS[templateId];
      if (!cost) throw new BadRequestError(`Unknown template: ${templateId}`, 'UNKNOWN_TEMPLATE');

      await pointsService.purchaseTemplate(req.user!.id, templateId, cost);
      res.status(200).json({ message: 'Template purchased successfully.' });
      return;
    }

    const dynamic = await prisma.dynamicTemplate.findUnique({ where: { id: templateId } });
    if (!dynamic) throw new BadRequestError(`Unknown template: ${templateId}`, 'UNKNOWN_TEMPLATE');
    if (dynamic.category !== 'premium') {
      throw new BadRequestError('This template is free and does not require a purchase.', 'FREE_TEMPLATE');
    }

    await pointsService.purchaseTemplate(req.user!.id, templateId, dynamic.pointsCost);
    res.status(200).json({ message: 'Template purchased successfully.' });
  }),
);

pointsRouter.get(
  '/templates',
  asyncHandler(async (_req, res) => {
    const codeTemplates = getAllTemplateMetadata().map((t) => ({
      ...t,
      cost: isPremiumTemplate(t.id) ? (TEMPLATE_COSTS[t.id] ?? 300) : 0,
    }));
    const dynamicTemplates = await prisma.dynamicTemplate.findMany({ where: { isActive: true } });
    const fromDynamic = dynamicTemplates.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      family: t.family,
      previewClass: 'template-dynamic',
      cost: t.category === 'premium' ? t.pointsCost : 0,
    }));
    res.status(200).json({ templates: [...codeTemplates, ...fromDynamic] });
  }),
);
