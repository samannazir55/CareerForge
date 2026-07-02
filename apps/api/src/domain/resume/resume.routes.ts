import { Router } from 'express';
import { z } from 'zod';
import {
  CreateResumeRequestSchema,
  UpdateResumeRequestSchema,
  CreateVersionRequestSchema,
  ResumeThemeSchema,
  SectionSchema,
} from '@careerforge/schema';
import * as resumeService from './resume.service.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth, requireVerifiedEmail } from '../../middleware/authGuard.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

export const resumeRouter = Router();

// Every route here requires a verified account — this is the first real
// usage of requireVerifiedEmail, defined back in the Auth phase for exactly
// this purpose ("verification required before access").
resumeRouter.use(requireAuth, requireVerifiedEmail);

resumeRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { title } = CreateResumeRequestSchema.parse(req.body);
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
    const resume = await resumeService.updateResume(req.params.id, req.user!.id, patch);
    res.status(200).json({ resume });
  }),
);

resumeRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await resumeService.deleteResume(req.params.id, req.user!.id);
    res.status(204).send();
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
const PreviewRenderRequestSchema = z.object({
  title: z.string().min(1),
  theme: ResumeThemeSchema,
  sections: z.array(SectionSchema),
});

resumeRouter.post(
  '/preview-render',
  asyncHandler(async (req, res) => {
    const input = PreviewRenderRequestSchema.parse(req.body);
    const { getTemplate } = await import('@careerforge/templates');
    const template = getTemplate(input.theme.templateId ?? 'modern');
    const html = template.renderHtml(input as any);
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
    const { getTemplate } = await import('@careerforge/templates');
    const template = getTemplate((resume.theme as any)?.templateId ?? 'modern');
    const html = template.renderHtml(resume as any);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(html);
  }),
);
