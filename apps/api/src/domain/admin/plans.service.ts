import { prisma } from '../../lib/prisma.js';
import { NotFoundError, ConflictError } from '../../lib/errors.js';
import { recordAuditLog } from './auditLog.js';
import type { UpsertSubscriptionPlanRequest } from '@careerforge/schema';

function serializePlan(plan: {
  id: string;
  tierKey: string;
  name: string;
  priceMonthlyUsd: { toNumber: () => number };
  description: string | null;
  features: unknown;
  pointsGrantedMonthly: number;
  stripePriceId: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: plan.id,
    tierKey: plan.tierKey,
    name: plan.name,
    priceMonthlyUsd: plan.priceMonthlyUsd.toNumber(),
    description: plan.description,
    features: Array.isArray(plan.features) ? (plan.features as string[]) : [],
    pointsGrantedMonthly: plan.pointsGrantedMonthly,
    stripePriceId: plan.stripePriceId,
    isActive: plan.isActive,
    displayOrder: plan.displayOrder,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

export const adminPlansService = {
  async listAll() {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { displayOrder: 'asc' },
    });
    return plans.map(serializePlan);
  },

  async create(adminId: string, input: UpsertSubscriptionPlanRequest) {
    const existing = await prisma.subscriptionPlan.findUnique({ where: { tierKey: input.tierKey } });
    if (existing) {
      throw new ConflictError(`A plan with tierKey "${input.tierKey}" already exists.`, 'TIER_KEY_TAKEN');
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        tierKey: input.tierKey,
        name: input.name,
        priceMonthlyUsd: input.priceMonthlyUsd,
        description: input.description,
        features: input.features,
        pointsGrantedMonthly: input.pointsGrantedMonthly,
        stripePriceId: input.stripePriceId,
        isActive: input.isActive,
        displayOrder: input.displayOrder,
      },
    });

    await recordAuditLog(adminId, 'PLAN_CREATE', 'SubscriptionPlan', plan.id, { tierKey: input.tierKey });
    return serializePlan(plan);
  },

  async update(adminId: string, planId: string, input: UpsertSubscriptionPlanRequest) {
    const existing = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!existing) throw new NotFoundError('Subscription plan not found.');

    // tierKey changes would break the bridge to User.subscriptionTier and
    // Stripe webhook matching — block it rather than silently allow drift.
    if (input.tierKey !== existing.tierKey) {
      throw new ConflictError('tierKey cannot be changed after creation.', 'TIER_KEY_IMMUTABLE');
    }

    const plan = await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: {
        name: input.name,
        priceMonthlyUsd: input.priceMonthlyUsd,
        description: input.description,
        features: input.features,
        pointsGrantedMonthly: input.pointsGrantedMonthly,
        stripePriceId: input.stripePriceId,
        isActive: input.isActive,
        displayOrder: input.displayOrder,
      },
    });

    await recordAuditLog(adminId, 'PLAN_UPDATE', 'SubscriptionPlan', plan.id, { changes: input });
    return serializePlan(plan);
  },

  async delete(adminId: string, planId: string) {
    const existing = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!existing) throw new NotFoundError('Subscription plan not found.');

    if (['FREE', 'PROFESSIONAL', 'PREMIUM'].includes(existing.tierKey)) {
      throw new ConflictError(
        'Cannot delete a core tier that the application depends on. Deactivate it instead.',
        'CORE_TIER_PROTECTED',
      );
    }

    await prisma.subscriptionPlan.delete({ where: { id: planId } });
    await recordAuditLog(adminId, 'PLAN_DELETE', 'SubscriptionPlan', planId, { tierKey: existing.tierKey });
  },
};
