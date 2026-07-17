import cron from 'node-cron';
import { prisma } from './prisma.js';
import { sendWeeklyDigest, sendJobApplicationReminder } from '../domain/email/digest.service.js';

/**
 * Starts the app's background email schedules. Called once from index.ts
 * after the server starts listening — a single process handles both the
 * HTTP server and these cron jobs, so this is a no-op on any additional
 * instance you might scale to unless you gate it (e.g. behind an
 * IS_SCHEDULER_INSTANCE env var) unless you're deliberately running more
 * than one API process against the same database.
 */
export function startScheduler(): void {
  // Weekly digest — every Monday at 8am UTC
  cron.schedule('0 8 * * 1', async () => {
    console.log('[scheduler] running weekly digest job');
    const users = await prisma.user.findMany({
      where: {
        isEmailVerified: true,
        // EmailPreference rows are created lazily (see getOrCreateEmailPreference),
        // so a user who predates this feature and has never opened Settings
        // has no row at all yet — not a row with weeklyDigest: false. Since
        // the column defaults to true, "no row" must be treated the same as
        // "row with weeklyDigest: true", or every pre-existing user would
        // silently never receive a digest until they happened to visit Settings.
        OR: [{ emailPreference: null }, { emailPreference: { weeklyDigest: true } }],
      },
      select: { id: true },
    });
    for (const user of users) {
      await sendWeeklyDigest(user.id).catch((e) => console.error('Digest failed for', user.id, e));
    }
    console.log(`[scheduler] weekly digest sent to ${users.length} user(s)`);
  });

  // Job follow-up reminders — every Wednesday at 9am UTC
  cron.schedule('0 9 * * 3', async () => {
    console.log('[scheduler] running job application reminder job');
    const users = await prisma.user.findMany({
      where: {
        isEmailVerified: true,
        // Same "no row yet" reasoning as the digest query above.
        OR: [{ emailPreference: null }, { emailPreference: { jobApplicationReminders: true } }],
      },
      select: { id: true },
    });
    for (const user of users) {
      await sendJobApplicationReminder(user.id).catch((e) => console.error('Reminder failed for', user.id, e));
    }
    console.log(`[scheduler] job application reminders checked for ${users.length} user(s)`);
  });

  console.log('Scheduler started');
}
