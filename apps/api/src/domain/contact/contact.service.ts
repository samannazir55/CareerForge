import type { ContactSubmissionType, User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { emailProvider } from '../providers/email/index.js';
import { env } from '../../config/env.js';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Fire-and-forget admin notification for a new Contact Us submission.
 * Deliberately swallows its own errors, same reasoning as lib/notify.ts —
 * the submission is already safely stored in contact_submissions by the
 * time this runs, so a failed email must never surface as a failure of
 * the submit action itself. The person can always be reached via the
 * stored row (and their account email) even if this notification is lost.
 */
export async function notifyAdminOfSubmission(
  submission: { id: string; type: ContactSubmissionType; subject: string; message: string; screenshotUrl: string | null },
  submitter: Pick<User, 'email' | 'fullName'>,
): Promise<void> {
  try {
    const typeLabel = submission.type === 'BUG_REPORT' ? 'Bug report' : 'Suggestion';
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1e1e2e;">
        <h2 style="margin: 0 0 4px;">${typeLabel}: ${escapeHtml(submission.subject)}</h2>
        <p style="margin: 0 0 20px; font-size: 13px; color: #666;">
          From ${escapeHtml(submitter.fullName ?? 'Unknown')} &lt;${escapeHtml(submitter.email)}&gt;
        </p>
        <p style="white-space: pre-wrap; line-height: 1.5;">${escapeHtml(submission.message)}</p>
        ${
          submission.screenshotUrl
            ? `<p style="margin-top: 20px;"><a href="${submission.screenshotUrl}">View attached screenshot</a></p>`
            : ''
        }
        <p style="margin-top: 28px; font-size: 12px; color: #888;">Submission ID: ${submission.id}</p>
      </div>
    `;
    await emailProvider.sendRawEmail({
      to: env.CONTACT_INBOX_EMAIL,
      subject: `[Corvyx ${typeLabel}] ${submission.subject}`,
      html,
    });
  } catch (err) {
    console.error(`[contact] failed to send admin notification for submission ${submission.id}:`, err);
  }
}

export async function listSubmissionsForUser(userId: string) {
  return prisma.contactSubmission.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}
