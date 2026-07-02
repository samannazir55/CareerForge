import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { BadRequestError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import {
  UpdateTemplateListingRequestSchema,
  UpsertSubscriptionPlanRequestSchema,
  GrantPointsRequestSchema,
  UpdateUserRoleRequestSchema,
} from '@careerforge/schema';
import { adminTemplatesService } from './templates.service.js';
import { adminPlansService } from './plans.service.js';
import { adminUsersService } from './users.service.js';
import { adminDashboardService } from './dashboard.service.js';
import { adminAuditService } from './audit.service.js';

export const adminRouter = Router();

// Every route in this router requires a valid session AND the ADMIN role.
// requireAuth populates req.user; requireAdmin then checks req.user.role.
adminRouter.use(requireAuth, requireAdmin);

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

adminRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const stats = await adminDashboardService.getStats();
    res.status(200).json(stats);
  }),
);

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

adminRouter.get(
  '/templates',
  asyncHandler(async (_req, res) => {
    const templates = await adminTemplatesService.listAll();
    res.status(200).json({ templates });
  }),
);

adminRouter.put(
  '/templates/:id',
  asyncHandler(async (req, res) => {
    const parsed = UpdateTemplateListingRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');
    }

    const listing = await adminTemplatesService.upsertListing(req.user!.id, req.params.id, parsed.data);
    res.status(200).json({ listing });
  }),
);

// ---------------------------------------------------------------------------
// Subscription plans
// ---------------------------------------------------------------------------

adminRouter.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    const plans = await adminPlansService.listAll();
    res.status(200).json({ plans });
  }),
);

adminRouter.post(
  '/plans',
  asyncHandler(async (req, res) => {
    const parsed = UpsertSubscriptionPlanRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');
    }

    const plan = await adminPlansService.create(req.user!.id, parsed.data);
    res.status(201).json({ plan });
  }),
);

adminRouter.put(
  '/plans/:id',
  asyncHandler(async (req, res) => {
    const parsed = UpsertSubscriptionPlanRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');
    }

    const plan = await adminPlansService.update(req.user!.id, req.params.id, parsed.data);
    res.status(200).json({ plan });
  }),
);

adminRouter.delete(
  '/plans/:id',
  asyncHandler(async (req, res) => {
    await adminPlansService.delete(req.user!.id, req.params.id);
    res.status(200).json({ success: true });
  }),
);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const { search, role, tier, page, pageSize } = req.query;
    const result = await adminUsersService.list({
      search: typeof search === 'string' ? search : undefined,
      role: role === 'USER' || role === 'ADMIN' ? role : undefined,
      tier:
        tier === 'FREE' || tier === 'PROFESSIONAL' || tier === 'PREMIUM' ? tier : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    res.status(200).json(result);
  }),
);

adminRouter.post(
  '/users/grant-points',
  asyncHandler(async (req, res) => {
    const parsed = GrantPointsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');
    }

    const newBalance = await adminUsersService.grantPoints(req.user!.id, parsed.data);
    res.status(200).json({ newBalance });
  }),
);

adminRouter.post(
  '/users/role',
  asyncHandler(async (req, res) => {
    const parsed = UpdateUserRoleRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');
    }

    const result = await adminUsersService.updateRole(req.user!.id, parsed.data);
    res.status(200).json(result);
  }),
);

// ---------------------------------------------------------------------------
// Points economy — global transaction ledger
// ---------------------------------------------------------------------------

adminRouter.get(
  '/points/transactions',
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 500) : 100;

    const transactions = await prisma.pointsTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { email: true, fullName: true } },
      },
    });

    res.status(200).json({
      transactions: transactions.map((t) => ({
        id: t.id,
        userId: t.userId,
        userEmail: t.user.email,
        userFullName: t.user.fullName,
        type: t.type,
        amount: t.amount,
        earnReason: t.earnReason ?? null,
        spendReason: t.spendReason ?? null,
        description: t.description ?? null,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  }),
);

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

adminRouter.get(
  '/audit-log',
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const entries = await adminAuditService.list(limit);
    res.status(200).json({ entries });
  }),
);
