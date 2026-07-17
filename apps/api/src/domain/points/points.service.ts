import { prisma } from '../../lib/prisma.js';
import type { PointsEarnReason, PointsSpendReason } from '@prisma/client';
import { notify } from '../../lib/notify.js';

/**
 * Points ledger service. The user's balance is ALWAYS derived from summing
 * the transaction rows — it is never stored as a standalone column (though
 * User.pointsBalance is kept in sync as a denormalized cache for fast reads).
 * The transaction log is the source of truth; the cached balance is
 * reconciled on every write here.
 */

export const pointsService = {
  async getBalance(userId: string): Promise<number> {
    const result = await prisma.pointsTransaction.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  },

  async getTransactions(userId: string, limit = 50) {
    return prisma.pointsTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  async award(
    userId: string,
    amount: number,
    reason: PointsEarnReason,
    description?: string,
  ): Promise<void> {
    await prisma.$transaction([
      prisma.pointsTransaction.create({
        data: { userId, type: 'EARN', amount, earnReason: reason, description },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { pointsBalance: { increment: amount } },
      }),
    ]);

    // notify() already swallows its own errors (see lib/notify.ts) — a
    // failed notification write must never undo or fail a points award
    // that already committed above.
    await notify(
      userId,
      'points_earned',
      `You earned ${amount} points`,
      description ? `For: ${description}` : `Reason: ${reason.toLowerCase().replace(/_/g, ' ')}`,
      { amount, reason },
    );
  },

  async spend(
    userId: string,
    amount: number,
    reason: PointsSpendReason,
    description?: string,
  ): Promise<void> {
    const balance = await this.getBalance(userId);
    if (balance < amount) {
      const { BadRequestError } = await import('../../lib/errors.js');
      throw new BadRequestError(
        `Insufficient points. Required: ${amount}, available: ${balance}.`,
        'INSUFFICIENT_POINTS',
      );
    }

    await prisma.$transaction([
      prisma.pointsTransaction.create({
        data: { userId, type: 'SPEND', amount: -amount, spendReason: reason, description },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { pointsBalance: { decrement: amount } },
      }),
    ]);
  },

  async purchaseTemplate(userId: string, templateId: string, cost: number): Promise<void> {
    const existing = await prisma.templatePurchase.findUnique({
      where: { userId_templateId: { userId, templateId } },
    });
    if (existing) return; // already owned

    await prisma.$transaction(async (tx) => {
      const balance = await tx.pointsTransaction.aggregate({
        where: { userId },
        _sum: { amount: true },
      });
      const available = balance._sum.amount ?? 0;

      if (available < cost) {
        const { BadRequestError } = await import('../../lib/errors.js');
        throw new BadRequestError(
          `Insufficient points. Required: ${cost}, available: ${available}.`,
          'INSUFFICIENT_POINTS',
        );
      }

      await tx.pointsTransaction.create({
        data: {
          userId,
          type: 'SPEND',
          amount: -cost,
          spendReason: 'TEMPLATE_PURCHASE',
          description: `Template purchase: ${templateId}`,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { pointsBalance: { decrement: cost } },
      });
      await tx.templatePurchase.create({ data: { userId, templateId } });
    });
  },
};
