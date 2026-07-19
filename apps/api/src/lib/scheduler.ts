import cron from 'node-cron';
import { prisma } from './prisma.js';
import { sendWeeklyDigest, sendJobApplicationReminder } from '../domain/email/digest.service.js';

/**
 * Registers the cron jobs behind Corvyx's proactive-email features. Called
 * once from index.ts after the server starts listening.
 *
 * Both jobs pre-filter users by `isEmailVerified` (no point emailing an
 * address nobody's confirmed owning) and by the relevant EmailPreference
 * flag, then hand off one user at a time to the digest service — which
 * re-checks the same preference itself, so this pre-filter is purely an
 * optimization (skip the query fan-out for users who opted out), not the
 * only place consent is enforced.
 *
 * Each per-user send is wrapped so one user's failure (bad address,
 * mailbox outage, whatever) can't abort the batch for everyone else.
 */
export function startScheduler(): void {
  // Weekly digest — every Monday at 8am UTC
  cron.schedule('0 8 * * 1', async () => {
    const users = await prisma.user.findMany({
      where: { isEmailVerified: true, emailPreference: { weeklyDigest: true } },
      select: { id: true },
    });
    for (const user of users) {
      await sendWeeklyDigest(user.id).catch((e) => console.error('Digest failed for', user.id, e));
    }
  });

  // Job follow-up reminders — every Wednesday at 9am UTC
  cron.schedule('0 9 * * 3', async () => {
    const users = await prisma.user.findMany({
      where: { isEmailVerified: true, emailPreference: { jobApplicationReminders: true } },
      select: { id: true },
    });
    for (const user of users) {
      await sendJobApplicationReminder(user.id).catch((e) =>
        console.error(`[scheduler] job-application-reminder error (user ${user.id}):`, e),
      );
    }
  });

  console.log('Scheduler started');
}
