import { Router } from 'express';
import { z } from 'zod';
import {
  CreateResumeRequestSchema,
  UpdateResumeRequestSchema,
  CreateVersionRequestSchema,
  ResumeThemeSchema,
  FieldDefSchema,
  SectionTypeSchema,
} from '@careerforge/schema';
import * as resumeService from './resume.service.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth, requireVerifiedEmail } from '../../middleware/authGuard.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { getLimits, FREE_TIER_TEMPLATE_IDS, type Tier } from '../../lib/planLimits.js';
import multer from 'multer';
import { uploadResumePhoto, deleteResumePhoto } from '../uploads/cloudinary.service.js';

// Memory storage — photos are small (capped at 8MB, see cloudinary.service.ts)
// and go straight to Cloudinary, never touching this server's disk.
const photoUpload = multer({ storage: multer.memoryStorage() });

export const resumeRouter = Router();

// Every route here requires a verified account — this is the first real
// usage of requireVerifiedEmail, defined back in the Auth phase for exactly
// this purpose ("verification required before access").
resumeRouter.use(requireAuth, requireVerifiedEmail);

resumeRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { title } = CreateResumeRequestSchema.parse(req.body);

    const limits = getLimits(req.user!.subscriptionTier as Tier);
    if (limits.maxResumes !== Infinity) {
      const count = await prisma.resume.count({ where: { ownerId: req.user!.id } });
      if (count >= limits.maxResumes) {
        throw new ForbiddenError(
          `Your ${req.user!.subscriptionTier} plan allows ${limits.maxResumes} resumes. Upgrade to create more.`,
          'PLAN_LIMIT_REACHED',
        );
      }
    }

    const resume = await resumeService.createResume(req.user!.id, title);
    res.status(201).json({ resume });
  }),
);

resumeRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const resumes = await resumeService.listResumes(req.user!.id);
    res.status(200).json({ resumes });
  }),
);

resumeRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const resume = await resumeService.getResume(req.params.id, req.user!.id);
    res.status(200).json({ resume });
  }),
);

resumeRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const patch = UpdateResumeRequestSchema.parse(req.body);

    // Template selection is plan-gated: FREE only gets Modern + Classic.
    // A template the user has separately bought with points (the
    // marketplace's per-template purchase flow, independent of
    // subscription tier) is still allowed even on FREE.
    const requestedTemplateId = patch.theme?.templateId;
    const limits = getLimits(req.user!.subscriptionTier as Tier);
    if (requestedTemplateId && limits.maxTemplates !== Infinity && !FREE_TIER_TEMPLATE_IDS.includes(requestedTemplateId)) {
      const purchased = await prisma.templatePurchase.findUnique({
        where: { userId_templateId: { userId: req.user!.id, templateId: requestedTemplateId } },
      });
      if (!purchased) {
        throw new ForbiddenError(
          `Your ${req.user!.subscriptionTier} plan only includes the Modern and Classic templates. Upgrade or purchase this template with points to use it.`,
          'PLAN_LIMIT_REACHED',
        );
      }
    }

    const resume = await resumeService.updateResume(req.params.id, req.user!.id, patch);
    res.status(200).json({ resume });
  }),
);

// --- Profile photo -----------------------------------------------------------
// Stored as theme.photoUrl (see ResumeThemeSchema) -- same JSON blob
// accentColor already lives in, so no separate DB column/migration needed.
// The actual image lives on Cloudinary; only its URL is persisted here.

resumeRouter.post(
  '/:id/photo',
  photoUpload.single('photo'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new BadRequestError('No photo file provided (expected multipart field "photo").');

    const resume = await resumeService.getResume(req.params.id, req.user!.id); // also checks ownership
    const uploaded = await uploadResumePhoto(req.file.buffer, req.file.mimetype, req.user!.id);

    const updated = await resumeService.updateResume(req.params.id, req.user!.id, {
      theme: { ...resume.theme, photoUrl: uploaded.url },
    });
    res.status(200).json({ resume: updated });
  }),
);

resumeRouter.delete(
  '/:id/photo',
  asyncHandler(async (req, res) => {
    const resume = await resumeService.getResume(req.params.id, req.user!.id); // also checks ownership
    await deleteResumePhoto(req.user!.id);

    const { photoUrl, ...themeWithoutPhoto } = resume.theme;
    const updated = await resumeService.updateResume(req.params.id, req.user!.id, {
      theme: themeWithoutPhoto,
    });
    res.status(200).json({ resume: updated });
  }),
);

resumeRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await resumeService.deleteResume(req.params.id, req.user!.id);
    res.status(204).send();
  }),
);

// --- Sharing analytics ---------------------------------------------------------

resumeRouter.get(
  '/:id/analytics',
  asyncHandler(async (req, res) => {
    // getResume both loads the row and throws NotFoundError if this user
    // doesn't own it — same ownership guard every other :id route here uses,
    // so a stranger can't pull view analytics for someone else's resume by
    // guessing an id.
    await resumeService.getResume(req.params.id, req.user!.id);
    const analytics = await resumeService.getResumeAnalytics(req.params.id);
    res.status(200).json(analytics);
  }),
);

// --- Version history ---------------------------------------------------------

resumeRouter.post(
  '/:id/versions',
  asyncHandler(async (req, res) => {
    const { label } = CreateVersionRequestSchema.parse(req.body ?? {});
    const version = await resumeService.createVersion(req.params.id, req.user!.id, label);
    res.status(201).json({ version });
  }),
);

resumeRouter.get(
  '/:id/versions',
  asyncHandler(async (req, res) => {
    const versions = await resumeService.listVersions(req.params.id, req.user!.id);
    res.status(200).json({ versions });
  }),
);

resumeRouter.get(
  '/:id/versions/:versionId',
  asyncHandler(async (req, res) => {
    const version = await resumeService.getVersion(req.params.id, req.params.versionId, req.user!.id);
    res.status(200).json({ version });
  }),
);

resumeRouter.post(
  '/:id/versions/:versionId/restore',
  asyncHandler(async (req, res) => {
    const resume = await resumeService.restoreVersion(req.params.id, req.params.versionId, req.user!.id);
    res.status(200).json({ resume });
  }),
);

resumeRouter.get(
  '/:id/versions/:versionAId/compare/:versionBId',
  asyncHandler(async (req, res) => {
    const { versionAId, versionBId } = req.params;
    if (!versionAId || !versionBId) {
      throw new BadRequestError('Both version ids are required.', 'MISSING_VERSION_IDS');
    }
    const diff = await resumeService.compareVersions(req.params.id, versionAId, versionBId, req.user!.id);
    res.status(200).json({ diff });
  }),
);

// Stateless preview endpoint — renders whatever resume JSON the client has
// in memory right now, with no DB read or write. Exists specifically for
// drafts that aren't persisted yet (e.g. the AI chat builder's sample/in-
// progress resume before the user has saved anything): the client always
// has the authoritative current draft in state, so rendering that directly
// is both simpler and more accurate than round-tripping through a DB row
// that may lag behind unsaved edits. requireVerifiedEmail (applied above via
// resumeRouter.use) still gates this — it's cheap but not free.
// Deliberately laxer than the real SectionSchema/EntrySchema (which require
// id: z.string().uuid(), correct for persisted DB records). This endpoint
// renders whatever draft the client currently has, which may be entirely
// unsaved — e.g. the AI chat builder's sample resume uses ids like
// 'sample-summary', not UUIDs. Rendering only needs a stable string key,
// not a real UUID, so requiring one here would reject valid unsaved drafts.
const PreviewEntrySchema = z.object({
  id: z.string().min(1),
  values: z.record(z.string(), z.unknown()),
});
const PreviewSectionSchema = z.object({
  id: z.string().min(1),
  type: SectionTypeSchema,
  title: z.string().min(1),
  order: z.number().int(),
  fields: z.array(FieldDefSchema).optional().default([]),
  entries: z.array(PreviewEntrySchema),
});
const PreviewRenderRequestSchema = z.object({
  title: z.string().min(1),
  theme: ResumeThemeSchema,
  sections: z.array(PreviewSectionSchema),
  // When true, injects the click-to-edit/delete bootstrap (see
  // previewInteractivity.ts) into the returned HTML. Only the resume
  // editor's live preview sets this — the read-only AI-chat-builder
  // preview, and PDF/DOCX export (which don't call this route at all),
  // must never render with the editing UI visible.
  interactive: z.boolean().optional(),
});

resumeRouter.post(
  '/preview-render',
  asyncHandler(async (req, res) => {
    const input = PreviewRenderRequestSchema.parse(req.body);
    const { resolveTemplate } = await import('../templates/templateResolver.js');
    const { DEFAULT_SECTION_FIELDS } = await import('@careerforge/schema');

    // A defensive backstop, not the primary source of correct fields —
    // mergeResumeSections() (used by the AI chat builder and the import
    // flow) already normalizes fields via its own normalizeAiSections()
    // before a draft ever reaches this endpoint. This exists for any
    // caller of this stateless endpoint that doesn't go through that path
    // and posts a section with fields genuinely missing/empty. 'custom'
    // sections have no canonical definition — same rule as
    // normalizeAiSections — so their own (possibly AI/user-authored)
    // fields are kept as-is rather than defaulted to [].
    const enrichedSections = input.sections.map((s) => ({
      ...s,
      fields:
        s.fields.length > 0 || s.type === 'custom'
          ? s.fields
          : (DEFAULT_SECTION_FIELDS as Record<string, typeof s.fields>)[s.type] ?? [],
    }));

    const template = await resolveTemplate(input.theme.templateId ?? 'modern');
    let html = template.renderHtml({ ...input, sections: enrichedSections } as any);
    if (input.interactive) {
      const { injectInteractivity } = await import('./previewInteractivity.js');
      html = injectInteractivity(html);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(html);
  }),
);

// Preview endpoint — returns the rendered HTML for a resume so the browser
// can display it in an iframe without bundling server-side template code.
resumeRouter.get(
  '/:id/preview',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await prisma.resume.findUnique({ where: { id: req.params.id } });
    if (!row || row.ownerId !== req.user!.id) {
      throw new NotFoundError('Resume not found.');
    }
    const { runMigrations } = await import('@careerforge/schema');
    const { payload: resume } = runMigrations({
      schemaVersion: row.schemaVersion,
      migrationVersion: row.migrationVersion,
      payload: { id: row.id, ownerId: row.ownerId, title: row.title, theme: row.theme, sections: row.sections, schemaVersion: row.schemaVersion, migrationVersion: row.migrationVersion, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() },
    });
    const { resolveTemplate } = await import('../templates/templateResolver.js');
    const template = await resolveTemplate((resume.theme as any)?.templateId ?? 'modern');
    const html = template.renderHtml(resume as any);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(html);
  }),
);
