import type { User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { StripePaymentProvider } from './stripe.adapter.js';
import { pointsService } from '../points/points.service.js';
import { env } from '../../config/env.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { notify } from '../../lib/notify.js';
import type { SubscriptionTier } from '@careerforge/schema';

const paymentProvider = new StripePaymentProvider();

export async function createCheckoutSession(
  user: User,
  tier: Exclude<SubscriptionTier, 'FREE'>,
): Promise<{ url: string }> {
  const result = await paymentProvider.createCheckoutSession({
    userId: user.id,
    email: user.email,
    tier,
    successUrl: `${env.FRONTEND_URL}/settings/subscription?success=true`,
    cancelUrl: `${env.FRONTEND_URL}/settings/subscription?canceled=true`,
  });
  return { url: result.url };
}

export async function createBillingPortalSession(user: User): Promise<{ url: string }> {
  const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (!subscription?.stripeCustomerId) {
    throw new NotFoundError('No active subscription found.', 'NO_SUBSCRIPTION');
  }
  return paymentProvider.createBillingPortalSession({
    stripeCustomerId: subscription.stripeCustomerId,
    returnUrl: `${env.FRONTEND_URL}/settings/subscription`,
  });
}

export async function getSubscriptionStatus(userId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return {
    tier: user.subscriptionTier,
    subscription: subscription
      ? {
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
      : null,
  };
}

/**
 * Handles all Stripe webhook events. This is the single entry point for
 * subscription state changes — we never trust client-side subscription state,
 * only webhook events from Stripe reconcile the database.
 */
export async function handleWebhook(payload: Buffer, signature: string): Promise<void> {
  const event = await paymentProvider.handleWebhookEvent(payload, signature);

  if (event.type === 'unknown') return;

  if (event.type === 'subscription.deleted') {
    const subscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: event.stripeSubscriptionId },
    });
    if (!subscription) return;

    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'CANCELED', tier: 'FREE' },
      }),
      prisma.user.update({
        where: { id: subscription.userId },
        data: { subscriptionTier: 'FREE' },
      }),
    ]);
    await notify(subscription.userId, 'subscription_changed', 'Plan updated', 'You are now on FREE', {
      tier: 'FREE',
      status: 'CANCELED',
    });
    return;
  }

  if (event.type === 'subscription.created' || event.type === 'subscription.updated') {
    const sub = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: event.stripeSubscriptionId },
    });

    const tier = event.tier ?? 'PROFESSIONAL';
    const status = event.status ?? 'ACTIVE';

    if (sub) {
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: sub.id },
          data: {
            tier,
            status,
            currentPeriodStart: event.currentPeriodStart,
            currentPeriodEnd: event.currentPeriodEnd,
            cancelAtPeriodEnd: event.cancelAtPeriodEnd ?? false,
          },
        }),
        prisma.user.update({
          where: { id: sub.userId },
          data: { subscriptionTier: tier },
        }),
      ]);
      await notify(sub.userId, 'subscription_changed', 'Plan updated', `You are now on ${tier}`, { tier, status });
    } else {
      // New subscription — find user by Stripe customer ID stored in metadata
      // or by looking up who initiated the checkout session.
      // We look up by stripeCustomerId since Stripe always sends it.
      const existingSub = await prisma.subscription.findFirst({
        where: { stripeCustomerId: event.stripeCustomerId },
      });

      if (!existingSub) {
        throw new BadRequestError(
          'Received subscription webhook for unknown customer. ' +
            'Ensure the checkout session stores userId in client_reference_id.',
        );
      }

      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: existingSub.id },
          data: {
            stripeSubscriptionId: event.stripeSubscriptionId,
            tier,
            status,
            currentPeriodStart: event.currentPeriodStart,
            currentPeriodEnd: event.currentPeriodEnd,
            cancelAtPeriodEnd: event.cancelAtPeriodEnd ?? false,
          },
        }),
        prisma.user.update({
          where: { id: existingSub.userId },
          data: { subscriptionTier: tier },
        }),
      ]);
      await notify(existingSub.userId, 'subscription_changed', 'Plan updated', `You are now on ${tier}`, {
        tier,
        status,
      });
    }

    // Award points for upgrading to premium
    if (tier === 'PREMIUM' && status === 'ACTIVE') {
      const user = await prisma.user.findFirst({ where: { subscription: { stripeCustomerId: event.stripeCustomerId } } });
      if (user) {
        await pointsService.award(user.id, 500, 'ADMIN_GRANT', 'Premium subscription activated').catch(() => undefined);
      }
    }
  }
}
