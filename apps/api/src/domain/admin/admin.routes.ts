import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { BadRequestError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import {
  UpdateTemplateListingRequestSchema,
  UpsertSubscriptionPlanRequestSchema,
  GrantPointsRequestSchema,
  UpdateUserRoleRequestSchema,
  CreatePromoCodeRequestSchema,
  UpdatePromoCodeRequestSchema,
  SendPromoCampaignRequestSchema,
  TEMPLATE_FAMILIES,
  TemplateFamilySchema,
} from '@careerforge/schema';
import { adminTemplatesService } from './templates.service.js';
import { adminPlansService } from './plans.service.js';
import { adminUsersService } from './users.service.js';
import { adminDashboardService } from './dashboard.service.js';
import { adminAuditService } from './audit.service.js';
import { dynamicTemplatesService } from './dynamicTemplates.service.js';
import { promoCodeService } from '../promo/promo.service.js';
import { aiProvider } from '../ai/index.js';
import { generateTemplateViaProvider } from './templateGeneration.js';
import { SAMPLE_RESUME } from './sampleResume.js';
import { runPageSpeed } from './seo.service.js';
import { env } from '../../config/env.js';

export const adminRouter = Router();

// Every route in this router requires a valid session AND the ADMIN role.
adminRouter.use(requireAuth, requireAdmin);

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

adminRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const stats = await adminDashboardService.getStats();
    res.status(200).json(stats);
  }),
);

// ---------------------------------------------------------------------------
// Templates (code-registered)
// ---------------------------------------------------------------------------

adminRouter.get(
  '/templates',
  asyncHandler(async (_req, res) => {
    const [codeTemplates, dynamicTemplates] = await Promise.all([
      adminTemplatesService.listAll(),
      dynamicTemplatesService.list(),
    ]);
    res.status(200).json({ templates: codeTemplates, dynamicTemplates });
  }),
);

adminRouter.put(
  '/templates/:id',
  asyncHandler(async (req, res) => {
    const parsed = UpdateTemplateListingRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');
    }
    const listing = await adminTemplatesService.upsertListing(req.user!.id, req.params.id, parsed.data);
    res.status(200).json({ listing });
  }),
);

// ---------------------------------------------------------------------------
// Dynamic Templates — AI-generated, DB-stored
// ---------------------------------------------------------------------------

// POST /admin/templates/generate
// Calls the AI with a style prompt and returns name, slug, category, html.
// Nothing is saved yet — the admin reviews and calls POST /dynamic to persist.
adminRouter.post(
  '/templates/generate',
  asyncHandler(async (req, res) => {
    const { prompt } = req.body as { prompt?: string };
    if (!prompt?.trim()) throw new BadRequestError('prompt is required.');

    let generated;
    try {
      generated = await generateTemplateViaProvider(aiProvider, prompt);
    } catch (err) {
      throw new BadRequestError(err instanceof Error ? err.message : 'Template generation failed.');
    }

    res.status(200).json(generated);
  }),
);

// POST /admin/templates/preview
// Renders a raw HTML template string with hardcoded sample data so the admin
// can see what it looks like before saving. Returns text/html.
adminRouter.post(
  '/templates/preview',
  asyncHandler(async (req, res) => {
    const { html } = req.body as { html?: string };
    if (!html?.trim()) throw new BadRequestError('html is required.');

    const { renderDynamicTemplate } = await import('./dynamicTemplateRenderer.js');

    const rendered = renderDynamicTemplate(html, SAMPLE_RESUME);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(rendered);
  }),
);

// POST /admin/templates/dynamic  — persist a generated (or hand-crafted) template
adminRouter.post(
  '/templates/dynamic',
  asyncHandler(async (req, res) => {
    const { name, slug, category, family: familyRaw, templateHtml, thumbnailUrl, pointsCost, displayOrder, promptUsed } =
      req.body as Record<string, string | number | undefined>;

    if (!name || !slug || !templateHtml) {
      throw new BadRequestError('name, slug, and templateHtml are required.');
    }

    const familyParsed = TemplateFamilySchema.safeParse(familyRaw ?? 'modern');
    if (!familyParsed.success) {
      throw new BadRequestError(`family must be one of: ${TEMPLATE_FAMILIES.map((f) => f.id).join(', ')}.`);
    }

    const template = await dynamicTemplatesService.create(req.user!.id, {
      name:         String(name),
      slug:         String(slug),
      category:     String(category ?? 'free'),
      family:       familyParsed.data,
      templateHtml: String(templateHtml),
      thumbnailUrl: thumbnailUrl ? String(thumbnailUrl) : undefined,
      pointsCost:   pointsCost   ? Number(pointsCost)  : 0,
      displayOrder: displayOrder ? Number(displayOrder) : 0,
      promptUsed:   promptUsed   ? String(promptUsed)  : undefined,
    });

    res.status(201).json({ template });
  }),
);

// PUT /admin/templates/dynamic/:id
adminRouter.put(
  '/templates/dynamic/:id',
  asyncHandler(async (req, res) => {
    const template = await dynamicTemplatesService.update(req.user!.id, req.params.id, req.body);
    res.status(200).json({ template });
  }),
);

// DELETE /admin/templates/dynamic/:id
adminRouter.delete(
  '/templates/dynamic/:id',
  asyncHandler(async (req, res) => {
    await dynamicTemplatesService.delete(req.user!.id, req.params.id);
    res.status(200).json({ success: true });
  }),
);

// ---------------------------------------------------------------------------
// Subscription plans
// ---------------------------------------------------------------------------

adminRouter.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    const plans = await adminPlansService.listAll();
    res.status(200).json({ plans });
  }),
);

adminRouter.post(
  '/plans',
  asyncHandler(async (req, res) => {
    const parsed = UpsertSubscriptionPlanRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');
    const plan = await adminPlansService.create(req.user!.id, parsed.data);
    res.status(201).json({ plan });
  }),
);

adminRouter.put(
  '/plans/:id',
  asyncHandler(async (req, res) => {
    const parsed = UpsertSubscriptionPlanRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');
    const plan = await adminPlansService.update(req.user!.id, req.params.id, parsed.data);
    res.status(200).json({ plan });
  }),
);

adminRouter.delete(
  '/plans/:id',
  asyncHandler(async (req, res) => {
    await adminPlansService.delete(req.user!.id, req.params.id);
    res.status(200).json({ success: true });
  }),
);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const { search, role, tier, page, pageSize } = req.query;
    const result = await adminUsersService.list({
      search:   typeof search === 'string' ? search : undefined,
      role:     role === 'USER' || role === 'ADMIN' ? role : undefined,
      tier:     tier === 'FREE' || tier === 'PROFESSIONAL' || tier === 'PREMIUM' ? tier : undefined,
      page:     page     ? Math.max(1, parseInt(String(page),     10) || 1) : undefined,
      pageSize: pageSize ? Math.min(100, parseInt(String(pageSize), 10) || 25) : undefined,
    });
    res.status(200).json(result);
  }),
);

adminRouter.post(
  '/users/grant-points',
  asyncHandler(async (req, res) => {
    const parsed = GrantPointsRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');
    const newBalance = await adminUsersService.grantPoints(req.user!.id, parsed.data);
    res.status(200).json({ newBalance });
  }),
);

adminRouter.post(
  '/users/role',
  asyncHandler(async (req, res) => {
    const parsed = UpdateUserRoleRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');
    const result = await adminUsersService.updateRole(req.user!.id, parsed.data);
    res.status(200).json(result);
  }),
);

// ---------------------------------------------------------------------------
// Points economy
// ---------------------------------------------------------------------------

adminRouter.get(
  '/points/transactions',
  asyncHandler(async (req, res) => {
    const rawLimit = parseInt(String(req.query.limit ?? '100'), 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 100;

    const transactions = await prisma.pointsTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { email: true, fullName: true } } },
    });

    res.status(200).json({
      transactions: transactions.map((t) => ({
        id:          t.id,
        userId:      t.userId,
        userEmail:   t.user.email,
        userFullName:t.user.fullName,
        type:        t.type,
        amount:      t.amount,
        earnReason:  t.earnReason   ?? null,
        spendReason: t.spendReason  ?? null,
        description: t.description  ?? null,
        createdAt:   t.createdAt.toISOString(),
      })),
    });
  }),
);

// ---------------------------------------------------------------------------
// Promo codes
// ---------------------------------------------------------------------------

adminRouter.get(
  '/promo-codes',
  asyncHandler(async (_req, res) => {
    const promoCodes = await promoCodeService.list();
    res.status(200).json({ promoCodes });
  }),
);

adminRouter.post(
  '/promo-codes',
  asyncHandler(async (req, res) => {
    const parsed = CreatePromoCodeRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');
    const promoCode = await promoCodeService.create(req.user!.id, parsed.data);
    res.status(201).json({ promoCode });
  }),
);

adminRouter.put(
  '/promo-codes/:id',
  asyncHandler(async (req, res) => {
    const parsed = UpdatePromoCodeRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');
    const promoCode = await promoCodeService.update(req.user!.id, req.params.id, parsed.data);
    res.status(200).json({ promoCode });
  }),
);

adminRouter.delete(
  '/promo-codes/:id',
  asyncHandler(async (req, res) => {
    await promoCodeService.deactivate(req.user!.id, req.params.id);
    res.status(200).json({ success: true });
  }),
);

// POST /admin/promo-codes/:id/send — broadcast the code to a user segment
// via email + in-dashboard notification (e.g. "New Year" campaign).
adminRouter.post(
  '/promo-codes/:id/send',
  asyncHandler(async (req, res) => {
    const parsed = SendPromoCampaignRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');
    const result = await promoCodeService.sendCampaign(req.user!.id, req.params.id, parsed.data);
    res.status(200).json(result);
  }),
);

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

adminRouter.get(
  '/audit-log',
  asyncHandler(async (req, res) => {
    const rawLimit = parseInt(String(req.query.limit ?? '200'), 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 1000) : 200;
    const entries = await adminAuditService.list(limit);
    res.status(200).json({ entries });
  }),
);

// ---------------------------------------------------------------------------
// SEO — PageSpeed Insights
// ---------------------------------------------------------------------------

adminRouter.get(
  '/seo/pagespeed',
  asyncHandler(async (req, res) => {
    const url = typeof req.query.url === 'string' ? req.query.url : env.FRONTEND_URL;
    const strategy = req.query.strategy === 'desktop' ? 'desktop' : 'mobile';
    try {
      new URL(url);
    } catch {
      throw new BadRequestError('url must be a valid absolute URL, e.g. https://corvyx.app');
    }
    const result = await runPageSpeed(url, strategy);
    res.status(200).json(result);
  }),
);
