import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { requireAuth, requireVerifiedEmail } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../lib/errors.js';
import { runMigrations } from '@careerforge/schema';
import { getTemplate } from '@careerforge/templates';

export const sharingRouter = Router();

// Enable/create shareable link for a resume
sharingRouter.post(
  '/:resumeId/share',
  requireAuth,
  requireVerifiedEmail,
  asyncHandler(async (req, res) => {
    const { resumeId } = req.params;
    const row = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!row || row.ownerId !== req.user!.id) throw new NotFoundError('Resume not found.');

    const existing = await prisma.shareableLink.findUnique({ where: { resumeId } });
    if (existing) {
      await prisma.shareableLink.update({ where: { resumeId }, data: { isEnabled: true } });
      res.status(200).json({ slug: existing.slug, isEnabled: true });
      return;
    }

    const slug = randomBytes(8).toString('hex');
    const link = await prisma.shareableLink.create({ data: { resumeId, slug } });
    res.status(201).json({ slug: link.slug, isEnabled: true });
  }),
);

// Disable shareable link
sharingRouter.delete(
  '/:resumeId/share',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { resumeId } = req.params;
    await prisma.shareableLink.updateMany({
      where: { resumeId, resume: { ownerId: req.user!.id } },
      data: { isEnabled: false },
    });
    res.status(204).send();
  }),
);

// Public resume view by slug — no auth required
sharingRouter.get(
  '/public/:slug',
  asyncHandler(async (req, res) => {
    const link = await prisma.shareableLink.findUnique({
      where: { slug: req.params.slug },
      include: { resume: true },
    });

    if (!link || !link.isEnabled) throw new NotFoundError('Resume not found or link disabled.');

    const { payload: resume } = runMigrations({
      schemaVersion: link.resume.schemaVersion,
      migrationVersion: link.resume.migrationVersion,
      payload: {
        id: link.resume.id,
        ownerId: link.resume.ownerId,
        title: link.resume.title,
        theme: link.resume.theme,
        sections: link.resume.sections,
        schemaVersion: link.resume.schemaVersion,
        migrationVersion: link.resume.migrationVersion,
        createdAt: link.resume.createdAt.toISOString(),
        updatedAt: link.resume.updatedAt.toISOString(),
      },
    });

    const template = getTemplate((resume.theme as any)?.templateId ?? 'modern');
    const html = template.renderHtml(resume as any);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }),
);
