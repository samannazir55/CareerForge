import { prisma } from '../../lib/prisma.js';
import { emailProvider } from '../providers/email/index.js';
import type { EmailPreference as PrismaEmailPreference } from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;
const DIGEST_WINDOW_MS = 7 * DAY_MS;
const STALE_APPLICATION_MS = 7 * DAY_MS;

/**
 * Loads a user's EmailPreference row, creating one with the schema's
 * defaults on first access. Lazy rather than a signup-time insert so
 * users who existed before this feature shipped still get a sane row the
 * first time anything (this service, the settings page, the scheduler)
 * needs one — no backfill migration required.
 */
export async function getOrCreateEmailPreference(userId: string): Promise<PrismaEmailPreference> {
  const existing = await prisma.emailPreference.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.emailPreference.create({ data: { userId } });
}

function emailLayout(title: string, bodyHtml: string, footerNote?: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1e1e2e;">
      <h2 style="margin: 0 0 16px;">${title}</h2>
      ${bodyHtml}
      <p style="margin-top: 28px; font-size: 12px; color: #888;">
        ${footerNote ?? 'You can turn these emails off anytime from Settings → Email Preferences.'}
      </p>
    </div>
  `;
}

function statRow(label: string, value: string | number): string {
  return `
    <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee;">
      <span style="color: #555;">${label}</span>
      <span style="font-weight: 600;">${value}</span>
    </div>
  `;
}

/**
 * Collects the past 7 days of activity for a user and emails them a
 * summary. Only sends if the user has weeklyDigest enabled — checked here
 * (not just by the scheduler's query) so this function stays safe to call
 * directly (e.g. from a manual admin trigger or a retry) without
 * re-deriving that filter at every call site.
 */
export async function sendWeeklyDigest(userId: string): Promise<void> {
  const [user, preference] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    getOrCreateEmailPreference(userId),
  ]);
  if (!user || !preference.weeklyDigest) return;

  const since = new Date(Date.now() - DIGEST_WINDOW_MS);

  const [resumeViews, pointsEarned, applicationsAdded, applicationsUpdated, interviewSessions, unreadNotifications] =
    await Promise.all([
      prisma.resumeView.count({ where: { resume: { ownerId: userId }, createdAt: { gte: since } } }),
      prisma.pointsTransaction.aggregate({
        where: { userId, type: 'EARN', createdAt: { gte: since } },
        _sum: { amount: true },
      }),
      prisma.jobApplication.count({ where: { userId, createdAt: { gte: since } } }),
      prisma.jobApplication.count({ where: { userId, updatedAt: { gte: since }, createdAt: { lt: since } } }),
      // Interview practice sessions are saved as ConversationSession rows
      // titled "Interview prep — <resume title>" by interview.routes.ts —
      // there's no dedicated InterviewSession model, so that title prefix
      // is the signal used to count them here.
      prisma.conversationSession.count({
        where: { userId, createdAt: { gte: since }, title: { startsWith: 'Interview prep' } },
      }),
      prisma.notification.count({ where: { userId, isRead: false, createdAt: { gte: since } } }),
    ]);

  const pointsEarnedTotal = pointsEarned._sum.amount ?? 0;
  const hasAnyActivity =
    resumeViews > 0 ||
    pointsEarnedTotal > 0 ||
    applicationsAdded > 0 ||
    applicationsUpdated > 0 ||
    interviewSessions > 0;

  const body = `
    <p>Hi ${user.fullName ?? 'there'}, here's what happened on Corvyx this past week:</p>
    <div style="margin: 20px 0;">
      ${statRow('Resume views', resumeViews)}
      ${statRow('Points earned', `+${pointsEarnedTotal}`)}
      ${statRow('Job applications added', applicationsAdded)}
      ${statRow('Job applications updated', applicationsUpdated)}
      ${statRow('Interview sessions completed', interviewSessions)}
      ${statRow('Unread notifications', unreadNotifications)}
    </div>
    ${
      hasAnyActivity
        ? '<p>Keep the momentum going — log back in to see the details.</p>'
        : '<p>Quiet week! Jump back in and polish your resume or track a new application.</p>'
    }
  `;

  await emailProvider.sendRawEmail({
    to: user.email,
    subject: 'Your Corvyx week in review',
    html: emailLayout('Your Corvyx week in review', body),
  });
}

/**
 * Fired (fire-and-forget, same pattern as notify()) whenever someone views
 * a shared resume, right alongside the in-dashboard notification —
 * see sharing.routes.ts.
 */
export async function sendResumeViewAlert(userId: string, resumeTitle: string): Promise<void> {
  const [user, preference] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    getOrCreateEmailPreference(userId),
  ]);
  if (!user || !preference.resumeViewAlerts) return;

  const body = `<p>Someone just viewed <strong>${resumeTitle}</strong>. Log in to see your full view analytics.</p>`;

  await emailProvider.sendRawEmail({
    to: user.email,
    subject: 'Someone just viewed your resume',
    html: emailLayout('👀 New resume view', body),
  });
}

/**
 * Finds applications stuck in APPLIED with no update for 7+ days and
 * nudges the user to follow up. Only sends when there's actually
 * something stale — an empty reminder email would just be noise.
 */
export async function sendJobApplicationReminder(userId: string): Promise<void> {
  const [user, preference] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    getOrCreateEmailPreference(userId),
  ]);
  if (!user || !preference.jobApplicationReminders) return;

  const staleBefore = new Date(Date.now() - STALE_APPLICATION_MS);
  const staleApplications = await prisma.jobApplication.findMany({
    where: { userId, status: 'APPLIED', updatedAt: { lte: staleBefore } },
    orderBy: { updatedAt: 'asc' },
    take: 10,
  });

  if (staleApplications.length === 0) return;

  const list = staleApplications
    .map((app) => `<li>${app.role} at ${app.company} <span style="color: #888;">(applied ${app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : new Date(app.createdAt).toLocaleDateString()})</span></li>`)
    .join('');

  const body = `
    <p>You have <strong>${staleApplications.length}</strong> application${staleApplications.length === 1 ? '' : 's'} that
    ${staleApplications.length === 1 ? "hasn't" : "haven't"} been updated in over a week. A quick follow-up can go a long way:</p>
    <ul style="padding-left: 20px; color: #333;">${list}</ul>
  `;

  await emailProvider.sendRawEmail({
    to: user.email,
    subject: `Don't forget to follow up on ${staleApplications.length} application${staleApplications.length === 1 ? '' : 's'}`,
    html: emailLayout('📋 Time to follow up', body),
  });
}
