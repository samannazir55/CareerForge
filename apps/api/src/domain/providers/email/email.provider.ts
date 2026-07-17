/**
 * Email provider abstraction. Every place in the codebase that needs to send
 * an email depends on THIS interface, never on a vendor SDK directly. Adding
 * a second real provider (SES, Postmark) means writing one new adapter file
 * and changing EMAIL_PROVIDER — nothing else in the codebase changes.
 */
export interface EmailProvider {
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
  /**
   * Generic escape hatch for callers that build their own full HTML body
   * (digest emails, reminders) rather than a fixed template baked into the
   * provider itself — used by domain/email/digest.service.ts so adding a
   * new email type there never requires touching this interface or its
   * adapters again.
   */
  sendRawEmail(params: { to: string; subject: string; html: string }): Promise<void>;
}
