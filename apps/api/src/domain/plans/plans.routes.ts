import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';

export const plansRouter = Router();

/**
 * Public list of active subscription plans and their real pricing.
 *
 * This exists because pricing was previously hardcoded independently in
 * two different frontend pages (SettingsPage.tsx: $9/$19, DashboardPage.tsx:
 * $12/mo/$29/mo) with no shared source of truth at all — there was no
 * endpoint exposing plan data, so each page's author just typed in whatever
 * price they had in mind at the time, and the two drifted apart. Both pages
 * now fetch from here instead, so there's exactly one place price changes
 * need to be made (adminPlansService, which already writes to this same
 * table) for both surfaces to update together.
 *
 * Deliberately NOT behind requireAuth: this is exactly the data a public
 * marketing /pricing page (and search/AI crawlers reading it) needs to
 * show a logged-out visitor before they've created an account — gating it
 * behind a token would make a public pricing page impossible. The
 * response is already a narrow, non-sensitive subset of the row (see
 * serialization below): no stripePriceId, no id/createdAt/updatedAt,
 * nothing that isn't meant to be public.
 */
plansRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
    res.json({
      plans: plans.map((p) => ({
        tierKey: p.tierKey,
        name: p.name,
        priceMonthlyUsd: p.priceMonthlyUsd.toNumber(),
        description: p.description,
        features: Array.isArray(p.features) ? (p.features as string[]) : [],
      })),
    });
  }),
);
