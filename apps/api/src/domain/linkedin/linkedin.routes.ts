import { Router } from 'express';
import { requireAuth, requireVerifiedEmail } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { aiProvider } from '../ai/index.js';
import { prisma } from '../../lib/prisma.js';
import { runMigrations } from '@careerforge/schema';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';
import rateLimit from 'express-rate-limit';

export const linkedinRouter = Router();

// Same rationale as aiRouter's / interviewRouter's rate limit — this
// endpoint makes an LLM call, which is more expensive (time and cost)
// than a typical CRUD request.
const linkedinRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many LinkedIn requests. Please wait a moment.' } },
});

/**
 * POST /api/linkedin/optimize
 * Body: { resumeId, targetRole? }
 * Returns: { optimization: LinkedInOptimization }
 */
linkedinRouter.post(
  '/optimize',
  requireAuth,
  requireVerifiedEmail,
  linkedinRateLimit,
  asyncHandler(async (req, res) => {
    const { resumeId, targetRole } = req.body as { resumeId?: string; targetRole?: string };
    if (!resumeId) throw new BadRequestError('resumeId is required.');

    const row = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!row || row.ownerId !== req.user!.id) throw new NotFoundError('Resume not found.');

    const { payload: resume } = runMigrations({
      schemaVersion: row.schemaVersion,
      migrationVersion: row.migrationVersion,
      payload: {
        id: row.id,
        ownerId: row.ownerId,
        title: row.title,
        theme: row.theme,
        sections: row.sections,
        schemaVersion: row.schemaVersion,
        migrationVersion: row.migrationVersion,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    });

    const optimization = await aiProvider.optimizeLinkedIn(resume as any, targetRole?.trim() || undefined);
    res.status(200).json({ optimization });
  }),
);
