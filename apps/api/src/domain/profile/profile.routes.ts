import { Router } from 'express';
import { requireAuth, requireVerifiedEmail } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { BadRequestError } from '../../lib/errors.js';
import { UpsertProfileFactRequestSchema, ProfileFactCategorySchema } from '@careerforge/schema';
import {
  getProfile,
  upsertFact,
  deleteFact,
  getFactsByCategory,
} from './profile.service.js';

export const profileRouter = Router();

// All profile endpoints require a verified session.
profileRouter.use(requireAuth, requireVerifiedEmail);

/**
 * GET /api/profile
 * Returns the full career profile with all facts and completeness breakdown.
 */
profileRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const profile = await getProfile(req.user!.id);
    res.status(200).json(profile);
  }),
);

/**
 * GET /api/profile/facts?category=EXPERIENCE
 * Returns facts for a single category. Useful for targeted AI reads.
 */
profileRouter.get(
  '/facts',
  asyncHandler(async (req, res) => {
    const { category } = req.query;
    if (!category || typeof category !== 'string') {
      throw new BadRequestError('category query param is required.');
    }

    const parsed = ProfileFactCategorySchema.safeParse(category);
    if (!parsed.success) {
      throw new BadRequestError(`Invalid category: ${category}`);
    }

    const facts = await getFactsByCategory(req.user!.id, parsed.data);
    res.status(200).json({ facts });
  }),
);

/**
 * PUT /api/profile/facts/:key
 * Upsert a single fact by its namespaced key.
 * Body: { category, key, value, confidenceScore?, source? }
 */
profileRouter.put(
  '/facts/:key',
  asyncHandler(async (req, res) => {
    // The key comes from the URL — merge it into the body before validation
    // so callers don't have to repeat it.
    const rawBody = { ...req.body, key: req.params.key };
    const parsed = UpsertProfileFactRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');
    }

    const fact = await upsertFact(req.user!.id, parsed.data);
    res.status(200).json({ fact });
  }),
);

/**
 * DELETE /api/profile/facts/:key
 * Remove a fact. Safe to call multiple times.
 */
profileRouter.delete(
  '/facts/:key',
  asyncHandler(async (req, res) => {
    const key = decodeURIComponent(req.params.key);
    await deleteFact(req.user!.id, key);
    res.status(200).json({ success: true });
  }),
);