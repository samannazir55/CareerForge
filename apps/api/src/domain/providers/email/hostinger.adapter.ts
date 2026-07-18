import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailProvider } from './email.provider.js';
import { env } from '../../../config/env.js';
import { ConfigurationError } from '../../../lib/errors.js';

/**
 * Real adapter that sends every transactional/proactive email through a
 * Hostinger (Titan) mailbox over SMTP, rather than a dedicated transactional
 * API like Resend. Corvyx already pays for the mailbox, so this reuses it
 * instead of paying for a second email vendor.
 *
 * Get the four SMTP_* values from your email app's manual setup screen (or
 * hPanel → Emails → Manage → Connect Apps & Devices):
 *   SMTP_HOST      smtp.hostinger.com for plain Hostinger Email,
 *                  smtp.titan.email if your mailbox is on Titan instead —
 *                  check which one hPanel shows for your mailbox
 *   SMTP_PORT      465 (TLS/SSL) is standard; 587 (STARTTLS) also works
 *   SMTP_USER      the full mailbox address, e.g. connect@corvyx.app
 *   SMTP_PASSWORD  that mailbox's password
 *
 * If these aren't configured, calls fail with a clear configuration error
 * rather than silently "succeeding" — same no-mock-implementations
 * reasoning the Resend adapter followed.
 *
 * Worth knowing: Titan/Hostinger mailboxes carry sending limits (roughly
 * 500/hour, ~1000/day per mailbox on most business plans) intended for
 * normal business mail, not bulk transactional volume. Fine at Corvyx's
 * current scale; if the weekly digest list or OTP volume grows enough to
 * approach that ceiling, that's the point to reconsider a dedicated
 * provider (or a higher Hostinger email tier) — this adapter doesn't do
 * any of its own rate limiting or queuing.
 */
export class HostingerEmailProvider implements EmailProvider {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
      throw new ConfigurationError(
        'SMTP_HOST, SMTP_USER, and SMTP_PASSWORD must all be set. Email sending is a ' +
          'real integration and requires real Hostinger/Titan mailbox credentials — see ' +
          'apps/api/.env.example.',
      );
    }
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        // Port 465 is implicit TLS; anything else (587, etc.) negotiates
        // TLS via STARTTLS instead — nodemailer needs to be told which.
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      });
    }
    return this.transporter;
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    const transporter = this.getTransporter();
    try {
      await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, html });
    } catch (err) {
      throw new Error(
        `Failed to send email via Hostinger SMTP: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async sendOtpEmail(params: { to: string; fullName: string | null; code: string; purpose: 'verify' | 'reset' }): Promise<void> {
    const greeting = params.fullName ? `Hi ${params.fullName},` : 'Hi,';
    const subject =
      params.purpose === 'verify' ? 'Verify your Corvyx email' : 'Reset your Corvyx password';
    const intro =
      params.purpose === 'verify'
        ? 'Use the code below to verify your email address.'
        : 'Use the code below to reset your password.';

    await this.send(
      params.to,
      subject,
      `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <p>${greeting}</p>
          <p>${intro}</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; text-align: center; padding: 16px 0;">
            ${params.code}
          </p>
          <p>This code expires in ${env.OTP_EXPIRY_MINUTES} minutes. If you didn't request this, you can ignore this email.</p>
        </div>
      `,
    );
  }

  async sendWelcomeEmail(params: { to: string; fullName: string | null }): Promise<void> {
    const greeting = params.fullName ? `Hi ${params.fullName},` : 'Hi,';

    await this.send(
      params.to,
      'Welcome to Corvyx',
      `<div style="font-family: sans-serif;"><p>${greeting}</p><p>Your email is verified — welcome to Corvyx. Let's build your resume.</p></div>`,
    );
  }

  async sendPromoCodeEmail(params: {
    to: string;
    fullName: string | null;
    subject: string;
    message: string;
    code: string;
    pointsValue: number;
    expiresAt: string | null;
  }): Promise<void> {
    const greeting = params.fullName ? `Hi ${params.fullName},` : 'Hi,';
    const expiryLine = params.expiresAt
      ? `<p style="font-size: 13px; color: #888;">This code expires on ${new Date(params.expiresAt).toLocaleDateString()}.</p>`
      : '';

    await this.send(
      params.to,
      params.subject,
      `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <p>${greeting}</p>
          <p>${params.message}</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="display: inline-block; font-size: 24px; font-weight: bold; letter-spacing: 3px; padding: 12px 24px; border: 2px dashed #6366f1; border-radius: 12px;">
              ${params.code}
            </span>
          </div>
          <p style="text-align: center; color: #555;">Redeem this code in your dashboard for <strong>${params.pointsValue} points</strong>.</p>
          ${expiryLine}
        </div>
      `,
    );
  }

  async sendWeeklyDigestEmail(params: {
    to: string;
    fullName: string | null;
    resumeViews: number;
    pointsEarned: number;
    jobApplications: number;
    interviewSessions: number;
    unreadNotifications: number;
  }): Promise<void> {
    const greeting = params.fullName ? `Hi ${params.fullName},` : 'Hi,';
    const dashboardUrl = `${env.FRONTEND_URL}/dashboard`;

    const stat = (label: string, value: number) => `
      <tr>
        <td style="padding: 10px 0; color: #555; font-size: 14px;">${label}</td>
        <td style="padding: 10px 0; text-align: right; font-weight: 700; font-size: 16px;">${value}</td>
      </tr>`;

    await this.send(
      params.to,
      'Your Corvyx week in review',
      `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <p>${greeting}</p>
          <p>Here's what happened on Corvyx over the past 7 days:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tbody>
              ${stat('Resume views', params.resumeViews)}
              ${stat('Points earned', params.pointsEarned)}
              ${stat('Job applications added/updated', params.jobApplications)}
              ${stat('Interview sessions completed', params.interviewSessions)}
              ${stat('Unread notifications', params.unreadNotifications)}
            </tbody>
          </table>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; background: #6366f1; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600;">Open your dashboard</a>
          </div>
          <p style="font-size: 12px; color: #888;">You're receiving this because weekly digest emails are turned on in your Corvyx email preferences. You can turn them off any time from Settings.</p>
        </div>
      `,
    );
  }

  async sendResumeViewAlertEmail(params: {
    to: string;
    fullName: string | null;
    resumeTitle: string;
  }): Promise<void> {
    const greeting = params.fullName ? `Hi ${params.fullName},` : 'Hi,';

    await this.send(
      params.to,
      'Someone just viewed your resume',
      `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <p>${greeting}</p>
          <p>Someone just viewed <strong>${params.resumeTitle}</strong>.</p>
          <p style="font-size: 12px; color: #888;">You're receiving this because resume view alerts are turned on in your Corvyx email preferences. You can turn them off any time from Settings.</p>
        </div>
      `,
    );
  }

  async sendJobApplicationReminderEmail(params: {
    to: string;
    fullName: string | null;
    staleApplications: Array<{ company: string; role: string; daysSinceApplied: number }>;
  }): Promise<void> {
    const greeting = params.fullName ? `Hi ${params.fullName},` : 'Hi,';
    const count = params.staleApplications.length;
    const jobsUrl = `${env.FRONTEND_URL}/jobs`;

    const rows = params.staleApplications
      .map(
        (a) => `
      <li style="padding: 6px 0; font-size: 14px;">
        <strong>${a.role}</strong> at ${a.company} — applied ${a.daysSinceApplied} days ago
      </li>`,
      )
      .join('');

    await this.send(
      params.to,
      `Don't forget to follow up on ${count} application${count === 1 ? '' : 's'}`,
      `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <p>${greeting}</p>
          <p>${count} application${count === 1 ? ' has' : 's have'} been sitting in "Applied" for a week or more with no update. A quick follow-up email can go a long way.</p>
          <ul style="padding-left: 18px; margin: 16px 0;">${rows}</ul>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${jobsUrl}" style="display: inline-block; background: #6366f1; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600;">View your applications</a>
          </div>
          <p style="font-size: 12px; color: #888;">You're receiving this because job application reminders are turned on in your Corvyx email preferences. You can turn them off any time from Settings.</p>
        </div>
      `,
    );
  }
}
