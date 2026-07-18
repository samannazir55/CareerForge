import { Router } from 'express';
import { requireAuth, requireVerifiedEmail } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { BadRequestError, ForbiddenError } from '../../lib/errors.js';
import { verifyAccessToken } from '../../lib/jwt.js';
import { getLimits, type Tier } from '../../lib/planLimits.js';
import {
  UpsertProfileFactRequestSchema,
  ProfileFactCategorySchema,
  UpdatePublicProfileSettingsRequestSchema,
} from '@careerforge/schema';
import {
  getProfile,
  upsertFact,
  deleteFact,
  getFactsByCategory,
  getPublicProfileBySlug,
  getPublicProfileSettings,
  updatePublicProfileSettings,
} from './profile.service.js';

export const profileRouter = Router();

/**
 * GET /api/profile/public/:slug
 * No auth required — public portfolio lookup, also (re)used by the
 * settings page as an advisory slug-availability check (see the tradeoff
 * note on getPublicProfileBySlug in profile.service.ts). Registered
 * before the `profileRouter.use(requireAuth, ...)` guard below so it
 * stays reachable without a session.
 *
 * If an Authorization header happens to be present (e.g. the owner is
 * logged in and hits "Preview my profile"), it's parsed on a best-effort
 * basis — an invalid/expired/absent token is treated the same as no
 * token at all, never as an error, since this route must stay fully
 * accessible to anonymous visitors. A valid token matching the profile's
 * own owner lets them preview the page before setting isPublic on.
 */
profileRouter.get(
  '/public/:slug',
  asyncHandler(async (req, res) => {
    let viewerUserId: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        viewerUserId = verifyAccessToken(authHeader.slice('Bearer '.length)).sub;
      } catch {
        // Not a valid session — fall through and treat as anonymous.
      }
    }

    const profile = await getPublicProfileBySlug(req.params.slug, viewerUserId);
    res.status(200).json({ profile });
  }),
);

// Everything below requires a verified session.
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

/**
 * GET /api/profile/public-settings
 * Returns the caller's own public-portfolio settings (see the note on
 * getPublicProfileSettings in profile.service.ts).
 */
profileRouter.get(
  '/public-settings',
  asyncHandler(async (req, res) => {
    const profile = await getPublicProfileSettings(req.user!.id);
    res.status(200).json({ profile });
  }),
);

/**
 * PATCH /api/profile/public-settings
 * Body: { publicSlug?, isPublic?, headline?, bio?, location?, website?,
 *         linkedinUrl?, githubUrl?, twitterUrl? }
 * Validates slug is URL-safe/unique/3-30 chars (see updatePublicProfileSettings).
 */
profileRouter.patch(
  '/public-settings',
  asyncHandler(async (req, res) => {
    const parsed = UpdatePublicProfileSettingsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');
    }

    if (parsed.data.isPublic && !getLimits(req.user!.subscriptionTier as Tier).publicPortfolio) {
      throw new ForbiddenError(
        'The public portfolio page requires a Professional or Premium plan.',
        'PLAN_LIMIT_REACHED',
      );
    }

    const profile = await updatePublicProfileSettings(req.user!.id, parsed.data);
    res.status(200).json({ profile });
  }),
);