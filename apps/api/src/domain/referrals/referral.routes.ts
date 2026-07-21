import { Router } from 'express';
import { requireAuth } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { getReferralStats } from './referral.service.js';

export const referralsRouter = Router();

referralsRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const stats = await getReferralStats(req.user!.id);
    res.status(200).json(stats);
  }),
);
