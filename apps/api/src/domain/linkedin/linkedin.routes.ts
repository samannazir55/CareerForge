import { Router } from 'express';
import { requireAuth, requireVerifiedEmail } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { aiProvider } from '../ai/index.js';
import { prisma } from '../../lib/prisma.js';
import { runMigrations } from '@careerforge/schema';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../lib/errors.js';
import { aiRateLimit } from '../../middleware/rateLimit.js';
import { getLimits, type Tier } from '../../lib/planLimits.js';
import { sanitise } from '../../lib/sanitise.js';

export const linkedinRouter = Router();

/**
 * POST /api/linkedin/optimize
 * Body: { resumeId, targetRole? }
 * Returns: { optimization: LinkedInOptimization }
 */
linkedinRouter.post(
  '/optimize',
  requireAuth,
  requireVerifiedEmail,
  aiRateLimit,
  asyncHandler(async (req, res) => {
    const { resumeId, targetRole } = req.body as { resumeId?: string; targetRole?: string };
    if (!resumeId) throw new BadRequestError('resumeId is required.');

    if (!getLimits(req.user!.subscriptionTier as Tier).linkedinOptimizer) {
      throw new ForbiddenError('LinkedIn Optimizer is a Premium feature.', 'PLAN_LIMIT_REACHED');
    }

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

    const optimization = await aiProvider.optimizeLinkedIn(resume as any, sanitise(targetRole, 200) || undefined);
    res.status(200).json({ optimization });
  }),
);
