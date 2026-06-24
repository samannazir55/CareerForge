import type { SubscriptionTier } from '@careerforge/schema';

/**
 * Payment provider abstraction. All Stripe-specific logic lives in
 * stripe.adapter.ts — nothing outside that file ever imports the Stripe SDK.
 * Swapping payment providers means writing one new adapter file and changing
 * PAYMENT_PROVIDER in env — zero changes to the service or route layers.
 */

export interface CheckoutSessionResult {
  url: string;
  sessionId: string;
}

export interface SubscriptionState {
  tier: SubscriptionTier;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export interface PaymentProvider {
  createCheckoutSession(params: {
    userId: string;
    email: string;
    tier: Exclude<SubscriptionTier, 'FREE'>;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSessionResult>;

  createBillingPortalSession(params: {
    stripeCustomerId: string;
    returnUrl: string;
  }): Promise<{ url: string }>;

  handleWebhookEvent(payload: Buffer, signature: string): Promise<WebhookEvent>;

  getSubscriptionState(stripeSubscriptionId: string): Promise<SubscriptionState>;
}

export type WebhookEventType =
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.deleted'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'unknown';

export interface WebhookEvent {
  type: WebhookEventType;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  tier?: Exclude<SubscriptionTier, 'FREE'>;
  status?: SubscriptionState['status'];
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}
