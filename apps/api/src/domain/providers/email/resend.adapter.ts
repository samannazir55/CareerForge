import { Resend } from 'resend';
import type { EmailProvider } from './email.provider.js';
import { env } from '../../../config/env.js';
import { ConfigurationError } from '../../../lib/errors.js';

/**
 * Real adapter against the Resend API. If RESEND_API_KEY is not configured,
 * calls fail with a clear configuration error rather than silently
 * "succeeding" — per the no-mock-implementations requirement, the absence of
 * a credential is surfaced honestly, not papered over.
 */
export class ResendEmailProvider implements EmailProvider {
  private client: Resend | null = null;

  private getClient(): Resend {
    if (!env.RESEND_API_KEY) {
      throw new ConfigurationError(
        'RESEND_API_KEY is not set. Email sending is a real integration and ' +
          'requires a real Resend API key — see apps/api/.env.example.',
      );
    }
    if (!this.client) {
      this.client = new Resend(env.RESEND_API_KEY);
    }
    return this.client;
  }

  async sendOtpEmail(params: { to: string; fullName: string | null; code: string; purpose: 'verify' | 'reset' }): Promise<void> {
    const client = this.getClient();
    const greeting = params.fullName ? `Hi ${params.fullName},` : 'Hi,';
    const subject =
      params.purpose === 'verify' ? 'Verify your Corvyx email' : 'Reset your Corvyx password';
    const intro =
      params.purpose === 'verify'
        ? 'Use the code below to verify your email address.'
        : 'Use the code below to reset your password.';

    const { error } = await client.emails.send({
      from: env.EMAIL_FROM,
      to: params.to,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <p>${greeting}</p>
          <p>${intro}</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; text-align: center; padding: 16px 0;">
            ${params.code}
          </p>
          <p>This code expires in ${env.OTP_EXPIRY_MINUTES} minutes. If you didn't request this, you can ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      throw new Error(`Failed to send email via Resend: ${error.message}`);
    }
  }

  async sendWelcomeEmail(params: { to: string; fullName: string | null }): Promise<void> {
    const client = this.getClient();
    const greeting = params.fullName ? `Hi ${params.fullName},` : 'Hi,';

    const { error } = await client.emails.send({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: 'Welcome to Corvyx',
      html: `<div style="font-family: sans-serif;"><p>${greeting}</p><p>Your email is verified — welcome to Corvyx. Let's build your resume.</p></div>`,
    });

    if (error) {
      throw new Error(`Failed to send email via Resend: ${error.message}`);
    }
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
    const client = this.getClient();
    const greeting = params.fullName ? `Hi ${params.fullName},` : 'Hi,';
    const expiryLine = params.expiresAt
      ? `<p style="font-size: 13px; color: #888;">This code expires on ${new Date(params.expiresAt).toLocaleDateString()}.</p>`
      : '';

    const { error } = await client.emails.send({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: `
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
    });

    if (error) {
      throw new Error(`Failed to send email via Resend: ${error.message}`);
    }
  }
}
