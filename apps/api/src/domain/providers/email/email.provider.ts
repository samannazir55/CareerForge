/**
 * Email provider abstraction. Every place in the codebase that needs to send
 * an email depends on THIS interface, never on a vendor SDK directly. Adding
 * a second real provider (SES, Postmark) means writing one new adapter file
 * and changing EMAIL_PROVIDER — nothing else in the codebase changes.
 */
export interface EmailProvider {
  /** Low-level escape hatch for one-off admin notifications (e.g. Contact Us
   * submissions) that don't warrant a dedicated typed method. */
  sendRawEmail(params: { to: string; subject: string; html: string }): Promise<void>;

  sendOtpEmail(params: { to: string; fullName: string | null; code: string; purpose: 'verify' | 'reset' }): Promise<void>;
  sendWelcomeEmail(params: { to: string; fullName: string | null }): Promise<void>;
  sendPromoCodeEmail(params: {
    to: string;
    fullName: string | null;
    subject: string;
    message: string;
    code: string;
    pointsValue: number;
    expiresAt: string | null;
  }): Promise<void>;

  /** Weekly "Your Corvyx week in review" activity summary. */
  sendWeeklyDigestEmail(params: {
    to: string;
    fullName: string | null;
    resumeViews: number;
    pointsEarned: number;
    jobApplications: number;
    interviewSessions: number;
    unreadNotifications: number;
  }): Promise<void>;

  /** Sent (throttled by the caller) when someone views one of the user's
   * shared resumes. */
  sendResumeViewAlertEmail(params: {
    to: string;
    fullName: string | null;
    resumeTitle: string;
  }): Promise<void>;

  /** Sent when one or more job applications have sat in "applied" with no
   * update for 7+ days. */
  sendJobApplicationReminderEmail(params: {
    to: string;
    fullName: string | null;
    staleApplications: Array<{ company: string; role: string; daysSinceApplied: number }>;
  }): Promise<void>;
}
