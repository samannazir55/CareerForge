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
  TEMPLATE_FAMILIES,
  TemplateFamilySchema,
} from '@careerforge/schema';
import { adminTemplatesService } from './templates.service.js';
import { adminPlansService } from './plans.service.js';
import { adminUsersService } from './users.service.js';
import { adminDashboardService } from './dashboard.service.js';
import { adminAuditService } from './audit.service.js';
import { dynamicTemplatesService } from './dynamicTemplates.service.js';
import { aiProvider } from '../ai/index.js';
import { generateTemplateViaProvider } from './templateGeneration.js';

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

    // Hardcoded sample resume — mirrors the frontend SAMPLE_RESUME
    const sampleResume = {
      id: 'preview',
      ownerId: '',
      title: 'Alex Morgan',
      theme: { templateId: 'preview', accentColor: '#6366f1' },
      schemaVersion: 1,
      migrationVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sections: [
        {
          id: 's1', type: 'summary', title: 'Summary', order: 0, fields: [], entries: [{
            id: 'e1', values: {
              jobTitle: 'Senior Software Engineer', email: 'alex.morgan@email.com',
              phone: '+1 (555) 234-5678', location: 'San Francisco, CA',
              linkedin: 'linkedin.com/in/alexmorgan', website: 'alexmorgan.dev',
              text: 'Full-stack engineer with 7+ years building scalable web products. Passionate about clean architecture and shipping software users love.',
            },
          }],
        },
        {
          id: 's2', type: 'experience', title: 'Experience', order: 1, fields: [], entries: [
            { id: 'e2', values: { title: 'Senior Software Engineer', company: 'Stripe', location: 'San Francisco, CA', startDate: '2021-06', endDate: '', description: 'Led development of the next-generation payments dashboard serving 2M+ merchants.\nReduced API latency by 40% through query optimisation.' } },
            { id: 'e3', values: { title: 'Software Engineer', company: 'Accenture', location: 'New York, NY', startDate: '2018-08', endDate: '2021-05', description: 'Built microservices architecture for a Fortune 500 retail client.' } },
          ],
        },
        {
          id: 's3', type: 'education', title: 'Education', order: 2, fields: [], entries: [
            { id: 'e4', values: { degree: 'B.S. Computer Science', school: 'Carnegie Mellon University', startDate: '2014-09', endDate: '2018-05' } },
          ],
        },
        {
          id: 's4', type: 'skills', title: 'Skills', order: 3, fields: [], entries: [
            { id: 'e5', values: { name: 'TypeScript / JavaScript' } },
            { id: 'e6', values: { name: 'React & Next.js' } },
            { id: 'e7', values: { name: 'Node.js' } },
            { id: 'e8', values: { name: 'PostgreSQL' } },
            { id: 'e9', values: { name: 'AWS' } },
          ],
        },
        {
          id: 's5', type: 'certifications', title: 'Certifications', order: 4, fields: [], entries: [
            { id: 'e10', values: { name: 'AWS Certified Solutions Architect', issuer: 'Amazon Web Services', date: '2023-06' } },
          ],
        },
        {
          id: 's6', type: 'projects', title: 'Projects', order: 5, fields: [], entries: [
            { id: 'e11', values: { name: 'OpenPay', description: 'Open-source payments SDK with 3k+ GitHub stars.', url: 'github.com/alexmorgan/openpay' } },
          ],
        },
        {
          id: 's7', type: 'languages', title: 'Languages', order: 6, fields: [], entries: [
            { id: 'e12', values: { name: 'English', proficiency: 'Native' } },
            { id: 'e13', values: { name: 'Spanish', proficiency: 'Professional working proficiency' } },
          ],
        },
        {
          id: 's8', type: 'references', title: 'References', order: 7, fields: [], entries: [
            { id: 'e14', values: { name: 'Jordan Lee', relationship: 'Former Manager, Stripe', contact: 'jordan.lee@email.com' } },
          ],
        },
        {
          id: 's9', type: 'custom', title: 'Volunteering', order: 8,
          fields: [
            { key: 'org', label: 'Organization', kind: 'text', required: false },
            { key: 'role', label: 'Role', kind: 'text', required: false },
          ],
          entries: [{ id: 'e15', values: { org: 'Code.org', role: 'Volunteer Mentor' } }],
        },
      ],
    };

    const rendered = renderDynamicTemplate(html, sampleResume as any);
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