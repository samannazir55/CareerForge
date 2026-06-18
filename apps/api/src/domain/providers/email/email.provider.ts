/**
 * Email provider abstraction. Every place in the codebase that needs to send
 * an email depends on THIS interface, never on a vendor SDK directly. Adding
 * a second real provider (SES, Postmark) means writing one new adapter file
 * and changing EMAIL_PROVIDER — nothing else in the codebase changes.
 */
export interface EmailProvider {
  sendOtpEmail(params: { to: string; fullName: string | null; code: string; purpose: 'verify' | 'reset' }): Promise<void>;
  sendWelcomeEmail(params: { to: string; fullName: string | null }): Promise<void>;
}
