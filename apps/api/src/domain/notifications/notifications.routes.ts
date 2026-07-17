import { Router } from 'express';
import { requireAuth } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';
import { UpdateEmailPreferenceRequestSchema } from '@careerforge/schema';
import { getOrCreateEmailPreference } from '../email/digest.service.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/**
 * GET /api/notifications?limit=20&unreadOnly=false
 * Returns the caller's most recent notifications plus a total unread count.
 * unreadCount is a separate aggregate (not `notifications.filter(...).length`)
 * because the list can be capped/filtered by `limit`/`unreadOnly` — the bell
 * badge needs the true total regardless of how many rows were returned.
 */
notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(MAX_LIMIT, Math.round(rawLimit)) : DEFAULT_LIMIT;
    const unreadOnly = req.query.unreadOnly === 'true';

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user!.id, ...(unreadOnly ? { isRead: false } : {}) },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId: req.user!.id, isRead: false },
      }),
    ]);

    res.status(200).json({ notifications, unreadCount });
  }),
);

/**
 * PATCH /api/notifications/:id/read
 * Marks one notification as read. Scoped to the caller via updateMany's
 * where clause (rather than findUnique-then-update) so a notification
 * belonging to another user 404s instead of leaking a "does this id
 * exist at all" signal.
 */
notificationsRouter.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const result = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.id },
      data: { isRead: true },
    });
    if (result.count === 0) throw new NotFoundError('Notification not found.');
    res.status(200).json({ message: 'Notification marked as read.' });
  }),
);

/**
 * PATCH /api/notifications/read-all
 * Marks every unread notification for the caller as read.
 */
notificationsRouter.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });
    res.status(200).json({ message: 'All notifications marked as read.' });
  }),
);

/**
 * GET /api/notifications/preferences
 * Returns the caller's EmailPreference, creating one with schema defaults
 * on first access (see getOrCreateEmailPreference in digest.service.ts).
 */
notificationsRouter.get(
  '/preferences',
  asyncHandler(async (req, res) => {
    const preference = await getOrCreateEmailPreference(req.user!.id);
    res.status(200).json({ preference });
  }),
);

/**
 * PATCH /api/notifications/preferences
 * Body: Partial<{ weeklyDigest, resumeViewAlerts, jobApplicationReminders,
 * interviewReminders, marketingEmails }>
 * Upserts rather than update-only, so a user whose row hasn't been lazily
 * created yet (e.g. flipping a toggle as their very first preferences
 * interaction) doesn't 404 against a row that doesn't exist yet.
 */
notificationsRouter.patch(
  '/preferences',
  asyncHandler(async (req, res) => {
    const parsed = UpdateEmailPreferenceRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');

    const preference = await prisma.emailPreference.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, ...parsed.data },
      update: parsed.data,
    });

    res.status(200).json({ preference });
  }),
);

/**
 * DELETE /api/notifications/:id
 */
notificationsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await prisma.notification.deleteMany({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (result.count === 0) throw new NotFoundError('Notification not found.');
    res.status(204).send();
  }),
);
