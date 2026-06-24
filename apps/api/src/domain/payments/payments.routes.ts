import { Router } from 'express';
import express from 'express';
import { requireAuth, requireVerifiedEmail } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { BadRequestError } from '../../lib/errors.js';
import * as subscriptionService from './subscription.service.js';

export const paymentsRouter = Router();

paymentsRouter.post(
  '/checkout',
  requireAuth,
  requireVerifiedEmail,
  asyncHandler(async (req, res) => {
    const { tier } = req.body as { tier?: string };
    if (tier !== 'PROFESSIONAL' && tier !== 'PREMIUM') {
      throw new BadRequestError('tier must be PROFESSIONAL or PREMIUM.', 'INVALID_TIER');
    }
    const result = await subscriptionService.createCheckoutSession(req.user!, tier);
    res.status(200).json(result);
  }),
);

paymentsRouter.post(
  '/portal',
  requireAuth,
  requireVerifiedEmail,
  asyncHandler(async (req, res) => {
    const result = await subscriptionService.createBillingPortalSession(req.user!);
    res.status(200).json(result);
  }),
);

paymentsRouter.get(
  '/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const status = await subscriptionService.getSubscriptionStatus(req.user!.id);
    res.status(200).json(status);
  }),
);

/**
 * Stripe webhook endpoint. Must receive the raw body (not JSON-parsed)
 * so Stripe's signature verification can work. Mounted separately in
 * app.ts before the express.json() middleware with express.raw().
 */
paymentsRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
      throw new BadRequestError('Missing stripe-signature header.', 'MISSING_SIGNATURE');
    }
    await subscriptionService.handleWebhook(req.body as Buffer, signature);
    res.status(200).json({ received: true });
  }),
);
