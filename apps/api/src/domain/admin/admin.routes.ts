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
} from '@careerforge/schema';
import { adminTemplatesService } from './templates.service.js';
import { adminPlansService } from './plans.service.js';
import { adminUsersService } from './users.service.js';
import { adminDashboardService } from './dashboard.service.js';
import { adminAuditService } from './audit.service.js';
import { dynamicTemplatesService } from './dynamicTemplates.service.js';
import Anthropic from '@anthropic-ai/sdk';

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

    const client = new Anthropic();

    const SYSTEM = `You are a professional resume template designer.
Generate a complete, self-contained HTML resume template based on the admin's description.

USE ONLY these placeholder variables — they are replaced server-side:

SCALARS (plain text substitution):
  {{name}}       Full name
  {{jobTitle}}   Professional title / current role
  {{email}}      Email address
  {{phone}}      Phone number
  {{location}}   City, Country
  {{linkedin}}   LinkedIn URL (may be empty)
  {{website}}    Personal website (may be empty)
  {{summary}}    Professional summary paragraph (may contain simple HTML)

LOOP BLOCKS (inner HTML repeated for each entry, supports {{#if}} inside):
  {{#experiences}}
    {{exp.title}}       Job title
    {{exp.company}}     Company name
    {{exp.location}}    Work location (may be empty)
    {{exp.dateRange}}   e.g. "Jan 2020 – Present"
    {{exp.description}} Bullet points / description (may contain <br>)
  {{/experiences}}

  {{#education}}
    {{edu.degree}}    Degree and field
    {{edu.school}}    Institution name
    {{edu.dateRange}} e.g. "Sep 2014 – May 2018"
  {{/education}}

  {{#skills}}
    {{skill.name}}    Skill label
  {{/skills}}

CONDITIONAL (renders inner content only if value is non-empty):
  {{#if linkedin}}...{{/if linkedin}}

REQUIREMENTS:
- Return a COMPLETE HTML document including <html>, <head> with <style>, and <body>
- Embed all CSS inside <style> tags (Google Fonts @import is fine)
- Optimise for A4 paper: 794px × 1123px, margin: 0, body padding 24-40px
- Use high-contrast colours (dark text on white/light backgrounds)
- Professional typography — choose fonts appropriate to the described style
- Do NOT include any <script> tags
- Do NOT use any external images unless the admin prompt specifically mentions them

Respond ONLY with a raw JSON object — no markdown fences, no preamble:
{
  "name": "Display name for the template (e.g. 'Executive Dark')",
  "slug": "url-safe-slug (e.g. 'executive-dark', lowercase, hyphens only)",
  "category": "free",
  "html": "THE COMPLETE HTML TEMPLATE STRING"
}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt.trim() }],
    });

    const raw = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    // Strip any accidental markdown fences before parsing
    const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

    let parsed: { name: string; slug: string; category: string; html: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new BadRequestError('AI returned malformed JSON. Try a more specific prompt.');
    }

    if (!parsed.html || !parsed.name || !parsed.slug) {
      throw new BadRequestError('AI response was missing required fields. Try again.');
    }

    res.status(200).json({
      name:     parsed.name,
      slug:     parsed.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      category: parsed.category === 'premium' ? 'premium' : 'free',
      html:     parsed.html,
    });
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
    const { name, slug, category, templateHtml, thumbnailUrl, pointsCost, displayOrder, promptUsed } =
      req.body as Record<string, string | number | undefined>;

    if (!name || !slug || !templateHtml) {
      throw new BadRequestError('name, slug, and templateHtml are required.');
    }

    const template = await dynamicTemplatesService.create(req.user!.id, {
      name:         String(name),
      slug:         String(slug),
      category:     String(category ?? 'free'),
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
