import { Router } from 'express';
import { requireAuth } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';

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

// The only fields a client may toggle via PATCH — deliberately excludes
// id/userId/updatedAt so a client can't smuggle those through the same
// "partial update" body.
const EMAIL_PREFERENCE_FIELDS = [
  'weeklyDigest',
  'resumeViewAlerts',
  'jobApplicationReminders',
  'interviewReminders',
  'marketingEmails',
] as const;
type EmailPreferenceField = (typeof EMAIL_PREFERENCE_FIELDS)[number];

/**
 * GET /api/notifications/preferences
 * Returns the caller's EmailPreference row, creating one with column
 * defaults on first read — mirrors how a Subscription/CareerProfile row
 * doesn't exist until something triggers its creation, rather than
 * backfilling every user up front.
 */
notificationsRouter.get(
  '/preferences',
  asyncHandler(async (req, res) => {
    const preference = await prisma.emailPreference.upsert({
      where: { userId: req.user!.id },
      update: {},
      create: { userId: req.user!.id },
    });
    res.status(200).json({ preference });
  }),
);

/**
 * PATCH /api/notifications/preferences
 * Body: any subset of the boolean EmailPreference fields. Unknown keys are
 * rejected outright (rather than silently ignored) so a typo in the
 * frontend fails loudly instead of quietly no-op'ing.
 */
notificationsRouter.patch(
  '/preferences',
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const keys = Object.keys(body);

    if (keys.length === 0) {
      throw new BadRequestError('At least one preference field is required.');
    }

    const data: Partial<Record<EmailPreferenceField, boolean>> = {};
    for (const key of keys) {
      if (!EMAIL_PREFERENCE_FIELDS.includes(key as EmailPreferenceField)) {
        throw new BadRequestError(`Unknown preference field: ${key}`);
      }
      const value = body[key];
      if (typeof value !== 'boolean') {
        throw new BadRequestError(`Preference field "${key}" must be a boolean.`);
      }
      data[key as EmailPreferenceField] = value;
    }

    const preference = await prisma.emailPreference.upsert({
      where: { userId: req.user!.id },
      update: data,
      create: { userId: req.user!.id, ...data },
    });

    res.status(200).json({ preference });
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
