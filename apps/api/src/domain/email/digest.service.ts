import { prisma } from '../../lib/prisma.js';
import { emailProvider } from '../providers/email/index.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
// Applications are only flagged as "stuck" once they've sat in APPLIED for
// at least this long with no update — matches the Wednesday cadence of the
// reminder cron job in lib/scheduler.ts (roughly a week's worth of silence
// before nudging the user).
const STALE_APPLICATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Loads (creating with defaults if missing) the caller's EmailPreference
 * row. Mirrors the "GET creates default if not exists" contract used by
 * the /api/notifications/preferences endpoint — every sender below goes
 * through this rather than assuming the row already exists, since a user
 * who signed up before this feature shipped has no row yet.
 */
async function getOrCreateEmailPreference(userId: string) {
  const existing = await prisma.emailPreference.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.emailPreference.create({ data: { userId } });
}

/**
 * Sends the weekly "Your Corvyx week in review" digest to a single user,
 * summarizing the last 7 days of activity. No-ops (does not send, does not
 * throw) if the user has weeklyDigest turned off — callers (the scheduler)
 * are expected to pre-filter by preference for efficiency, but this check
 * is repeated here so the function is safe to call directly too.
 */
export async function sendWeeklyDigest(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const preference = await getOrCreateEmailPreference(userId);
  if (!preference.weeklyDigest) return;

  const since = new Date(Date.now() - SEVEN_DAYS_MS);

  const [resumeViews, pointsEarned, jobApplications, interviewSessions, unreadNotifications] =
    await Promise.all([
      prisma.resumeView.count({
        where: { resume: { ownerId: userId }, createdAt: { gte: since } },
      }),

      prisma.pointsTransaction.aggregate({
        where: { userId, type: 'EARN', createdAt: { gte: since } },
        _sum: { amount: true },
      }),

      prisma.jobApplication.count({
        where: {
          userId,
          OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }],
        },
      }),

      prisma.conversationSession.count({
        where: { userId, title: { startsWith: 'Interview prep' }, createdAt: { gte: since } },
      }),

      prisma.notification.count({
        where: { userId, isRead: false, createdAt: { gte: since } },
      }),
    ]);

  await emailProvider.sendWeeklyDigestEmail({
    to: user.email,
    fullName: user.fullName,
    resumeViews,
    pointsEarned: pointsEarned._sum.amount ?? 0,
    jobApplications,
    interviewSessions,
    unreadNotifications,
  });
}

/**
 * Fired (fire-and-forget, same pattern as `notify()`) whenever someone
 * views one of a user's shared resumes — see sharing.routes.ts, which
 * already throttles how often this is called per resume so this function
 * itself doesn't need its own cooldown logic.
 */
export async function sendResumeViewAlert(userId: string, resumeTitle: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const preference = await getOrCreateEmailPreference(userId);
  if (!preference.resumeViewAlerts) return;

  await emailProvider.sendResumeViewAlertEmail({
    to: user.email,
    fullName: user.fullName,
    resumeTitle,
  });
}

/**
 * Finds the user's applications stuck in APPLIED for 7+ days with no
 * update and, if any exist, sends a single "don't forget to follow up"
 * email listing all of them.
 */
export async function sendJobApplicationReminder(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const preference = await getOrCreateEmailPreference(userId);
  if (!preference.jobApplicationReminders) return;

  const staleBefore = new Date(Date.now() - STALE_APPLICATION_MS);

  const staleApplications = await prisma.jobApplication.findMany({
    where: { userId, status: 'APPLIED', updatedAt: { lte: staleBefore } },
    orderBy: { updatedAt: 'asc' },
  });

  if (staleApplications.length === 0) return;

  const now = Date.now();
  await emailProvider.sendJobApplicationReminderEmail({
    to: user.email,
    fullName: user.fullName,
    staleApplications: staleApplications.map((a) => ({
      company: a.company,
      role: a.role,
      daysSinceApplied: Math.floor((now - a.updatedAt.getTime()) / (24 * 60 * 60 * 1000)),
    })),
  });
}
