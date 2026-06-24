import { Router } from 'express';
import { requireAuth } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { pointsService } from '../points/points.service.js';

export const dashboardRouter = Router();

/**
 * Single endpoint for the dashboard page — returns all the data needed
 * for the welcome section, stats cards, recent resumes, and subscription
 * status in one request rather than making the frontend fire five separate
 * calls on mount.
 */
dashboardRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const [resumeCount, recentResumes, pointsBalance, subscription] = await Promise.all([
      prisma.resume.count({ where: { ownerId: userId } }),

      prisma.resume.findMany({
        where: { ownerId: userId },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          theme: true,
          updatedAt: true,
          schemaVersion: true,
        },
      }),

      pointsService.getBalance(userId),

      prisma.subscription.findUnique({ where: { userId } }),
    ]);

    res.status(200).json({
      user: {
        fullName: req.user!.fullName,
        email: req.user!.email,
        subscriptionTier: req.user!.subscriptionTier,
        isEmailVerified: req.user!.isEmailVerified,
      },
      stats: {
        resumeCount,
        pointsBalance,
        // ATS score and career health score are computed per-resume — placeholder
        // until a resume is selected and scored via POST /api/ai/ats-score
        atsScore: null as number | null,
        careerHealthScore: null as number | null,
      },
      recentResumes: recentResumes.map((r) => ({
        id: r.id,
        title: r.title,
        templateId: (r.theme as any)?.templateId ?? 'modern',
        updatedAt: r.updatedAt.toISOString(),
        schemaVersion: r.schemaVersion,
      })),
      subscription: subscription
        ? {
            tier: subscription.tier,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
    });
  }),
);
