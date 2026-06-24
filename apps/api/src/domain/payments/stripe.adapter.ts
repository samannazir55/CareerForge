import Stripe from 'stripe';
import type { PaymentProvider, WebhookEvent, SubscriptionState, CheckoutSessionResult } from './payment.provider.js';
import type { SubscriptionTier } from '@careerforge/schema';
import { env } from '../../config/env.js';
import { ConfigurationError, BadRequestError } from '../../lib/errors.js';

const TIER_PRICE_MAP: Record<Exclude<SubscriptionTier, 'FREE'>, string> = {
  PROFESSIONAL: env.STRIPE_PRICE_PROFESSIONAL,
  PREMIUM: env.STRIPE_PRICE_PREMIUM,
};

function getStripeClient(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new ConfigurationError(
      'STRIPE_SECRET_KEY is not set. Stripe integration requires a real API key. ' +
        'See apps/api/.env.example for setup instructions.',
    );
  }
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' as any });
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionState['status'] {
  switch (status) {
    case 'active': return 'ACTIVE';
    case 'past_due': return 'PAST_DUE';
    case 'canceled': return 'CANCELED';
    case 'trialing': return 'TRIALING';
    default: return 'CANCELED';
  }
}

function mapPriceToTier(priceId: string): Exclude<SubscriptionTier, 'FREE'> {
  if (priceId === env.STRIPE_PRICE_PREMIUM) return 'PREMIUM';
  if (priceId === env.STRIPE_PRICE_PROFESSIONAL) return 'PROFESSIONAL';
  return 'PROFESSIONAL';
}

export class StripePaymentProvider implements PaymentProvider {
  async createCheckoutSession(params: {
    userId: string;
    email: string;
    tier: Exclude<SubscriptionTier, 'FREE'>;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSessionResult> {
    const stripe = getStripeClient();
    const priceId = TIER_PRICE_MAP[params.tier];
    if (!priceId) {
      throw new ConfigurationError(`No Stripe price ID configured for tier: ${params.tier}`);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: params.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.userId,
      metadata: { userId: params.userId, tier: params.tier },
    });

    if (!session.url) throw new BadRequestError('Stripe did not return a checkout URL.');
    return { url: session.url, sessionId: session.id };
  }

  async createBillingPortalSession(params: {
    stripeCustomerId: string;
    returnUrl: string;
  }): Promise<{ url: string }> {
    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: params.stripeCustomerId,
      return_url: params.returnUrl,
    });
    return { url: session.url };
  }

  async handleWebhookEvent(payload: Buffer, signature: string): Promise<WebhookEvent> {
    const stripe = getStripeClient();
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new ConfigurationError('STRIPE_WEBHOOK_SECRET is not set.');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      throw new BadRequestError('Invalid Stripe webhook signature.', 'INVALID_WEBHOOK_SIGNATURE');
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price.id ?? '';
        return {
          type: event.type === 'customer.subscription.created' ? 'subscription.created' : 'subscription.updated',
          stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
          stripeSubscriptionId: sub.id,
          tier: mapPriceToTier(priceId),
          status: mapStripeStatus(sub.status),
          currentPeriodStart: new Date((sub as any).current_period_start * 1000),
          currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        };
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        return {
          type: 'subscription.deleted',
          stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
          stripeSubscriptionId: sub.id,
          status: 'CANCELED',
        };
      }
      default:
        return { type: 'unknown' };
    }
  }

  async getSubscriptionState(stripeSubscriptionId: string): Promise<SubscriptionState> {
    const stripe = getStripeClient();
    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const priceId = sub.items.data[0]?.price.id ?? '';
    return {
      tier: mapPriceToTier(priceId),
      status: mapStripeStatus(sub.status),
      stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      stripeSubscriptionId: sub.id,
      currentPeriodStart: new Date((sub as any).current_period_start * 1000),
      currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    };
  }
}
