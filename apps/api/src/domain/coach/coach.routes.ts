import { Router } from 'express';
import { requireAuth, requireVerifiedEmail } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { aiProvider, type ChatMessage, type CareerCoachContext } from '../ai/index.js';
import { prisma } from '../../lib/prisma.js';
import { runMigrations } from '@careerforge/schema';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../lib/errors.js';
import { aiRateLimit } from '../../middleware/rateLimit.js';
import { getLimits, type Tier } from '../../lib/planLimits.js';
import { sanitise } from '../../lib/sanitise.js';

export const coachRouter = Router();

/**
 * POST /api/coach/chat
 * Body: { messages: ChatMessage[], context: CareerCoachContext }
 * Returns: { reply, suggestions?, actionItems? }
 */
coachRouter.post(
  '/chat',
  requireAuth,
  requireVerifiedEmail,
  aiRateLimit,
  asyncHandler(async (req, res) => {
    if (!getLimits(req.user!.subscriptionTier as Tier).careerCoach) {
      throw new ForbiddenError('Career Coach is a Premium feature.', 'PLAN_LIMIT_REACHED');
    }

    const { messages: rawMessages, context: rawContext } = req.body as {
      messages?: ChatMessage[];
      context?: CareerCoachContext;
    };
    if (!rawMessages?.length) throw new BadRequestError('messages is required.');
    if (!rawMessages.every((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')) {
      throw new BadRequestError('Each message needs a role of "user" or "assistant" and string content.');
    }
    const messages = rawMessages.map((m) => ({ role: m.role, content: sanitise(m.content, 8_000) }));
    const context: CareerCoachContext = {
      ...(rawContext?.currentRole && { currentRole: sanitise(rawContext.currentRole, 200) }),
      ...(rawContext?.targetRole && { targetRole: sanitise(rawContext.targetRole, 200) }),
      ...(rawContext?.yearsExperience !== undefined && { yearsExperience: rawContext.yearsExperience }),
    };

    const result = await aiProvider.coachChat(messages, context);
    res.status(200).json(result);
  }),
);

/**
 * POST /api/coach/analyse
 * Body: { resumeId, targetRole }
 * Returns: { analysis: CareerGrowthAnalysis }
 */
coachRouter.post(
  '/analyse',
  requireAuth,
  requireVerifiedEmail,
  aiRateLimit,
  asyncHandler(async (req, res) => {
    if (!getLimits(req.user!.subscriptionTier as Tier).careerCoach) {
      throw new ForbiddenError('Career Coach is a Premium feature.', 'PLAN_LIMIT_REACHED');
    }

    const { resumeId, targetRole: rawTargetRole } = req.body as { resumeId?: string; targetRole?: string };
    if (!resumeId) throw new BadRequestError('resumeId is required.');
    if (!rawTargetRole?.trim()) throw new BadRequestError('targetRole is required.');
    const targetRole = sanitise(rawTargetRole, 200);

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

    const analysis = await aiProvider.analyseCareerGrowth(resume as any, targetRole);
    res.status(200).json({ analysis });
  }),
);
