import { Router } from 'express';
import { requireAuth, requireVerifiedEmail } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { aiProvider, type ChatMessage, type CareerCoachContext } from '../ai/index.js';
import { prisma } from '../../lib/prisma.js';
import { runMigrations } from '@careerforge/schema';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../lib/errors.js';
import rateLimit from 'express-rate-limit';
import { getLimits, type Tier } from '../../lib/planLimits.js';

export const coachRouter = Router();

// Same rationale as aiRouter's / interviewRouter's / linkedinRouter's rate
// limit — these endpoints make LLM calls, which are more expensive (time
// and cost) than a typical CRUD request.
const coachRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many coach requests. Please wait a moment.' } },
});

/**
 * POST /api/coach/chat
 * Body: { messages: ChatMessage[], context: CareerCoachContext }
 * Returns: { reply, suggestions?, actionItems? }
 */
coachRouter.post(
  '/chat',
  requireAuth,
  requireVerifiedEmail,
  coachRateLimit,
  asyncHandler(async (req, res) => {
    if (!getLimits(req.user!.subscriptionTier as Tier).careerCoach) {
      throw new ForbiddenError('Career Coach is a Premium feature.', 'PLAN_LIMIT_REACHED');
    }

    const { messages, context } = req.body as { messages?: ChatMessage[]; context?: CareerCoachContext };
    if (!messages?.length) throw new BadRequestError('messages is required.');
    if (!messages.every((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')) {
      throw new BadRequestError('Each message needs a role of "user" or "assistant" and string content.');
    }

    const result = await aiProvider.coachChat(messages, context ?? {});
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
  coachRateLimit,
  asyncHandler(async (req, res) => {
    if (!getLimits(req.user!.subscriptionTier as Tier).careerCoach) {
      throw new ForbiddenError('Career Coach is a Premium feature.', 'PLAN_LIMIT_REACHED');
    }

    const { resumeId, targetRole } = req.body as { resumeId?: string; targetRole?: string };
    if (!resumeId) throw new BadRequestError('resumeId is required.');
    if (!targetRole?.trim()) throw new BadRequestError('targetRole is required.');

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

    const analysis = await aiProvider.analyseCareerGrowth(resume as any, targetRole.trim());
    res.status(200).json({ analysis });
  }),
);
