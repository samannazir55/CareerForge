import { prisma } from '../../lib/prisma.js';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';
import { pointsService } from '../points/points.service.js';
import { recordAuditLog } from './auditLog.js';
import type { GrantPointsRequest, UpdateUserRoleRequest } from '@careerforge/schema';

interface ListUsersParams {
  search?: string;
  role?: 'USER' | 'ADMIN';
  tier?: 'FREE' | 'PROFESSIONAL' | 'PREMIUM';
  page?: number;
  pageSize?: number;
}

export const adminUsersService = {
  async list(params: ListUsersParams) {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 25, 100);

    const where = {
      ...(params.search && {
        OR: [
          { email: { contains: params.search, mode: 'insensitive' as const } },
          { fullName: { contains: params.search, mode: 'insensitive' as const } },
        ],
      }),
      ...(params.role && { role: params.role }),
      ...(params.tier && { subscriptionTier: params.tier }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { resumes: true } } },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        subscriptionTier: u.subscriptionTier,
        pointsBalance: u.pointsBalance,
        isEmailVerified: u.isEmailVerified,
        resumeCount: u._count.resumes,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  },

  async grantPoints(adminId: string, input: GrantPointsRequest) {
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) throw new NotFoundError('User not found.');

    if (input.amount === 0) {
      throw new BadRequestError('Amount must be non-zero.');
    }

    if (input.amount > 0) {
      await pointsService.award(input.userId, input.amount, 'ADMIN_GRANT', input.reason);
    } else {
      const balance = await pointsService.getBalance(input.userId);
      const deduction = Math.abs(input.amount);
      if (balance < deduction) {
        throw new BadRequestError(
          `Cannot deduct ${deduction} points — user only has ${balance}.`,
          'INSUFFICIENT_POINTS',
        );
      }
      // FEATURE_UNLOCK is the closest existing spend reason for an
      // admin-initiated deduction; the audit log + description carry the
      // real reason for anyone reviewing the ledger.
      await pointsService.spend(input.userId, deduction, 'FEATURE_UNLOCK', `Admin adjustment: ${input.reason}`);
    }

    await recordAuditLog(adminId, 'POINTS_GRANT', 'User', input.userId, {
      amount: input.amount,
      reason: input.reason,
    });

    return pointsService.getBalance(input.userId);
  },

  async updateRole(adminId: string, input: UpdateUserRoleRequest) {
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) throw new NotFoundError('User not found.');

    if (user.id === adminId && input.role === 'USER') {
      throw new BadRequestError('You cannot demote yourself.', 'CANNOT_SELF_DEMOTE');
    }

    const updated = await prisma.user.update({
      where: { id: input.userId },
      data: { role: input.role },
    });

    await recordAuditLog(adminId, 'ROLE_CHANGE', 'User', input.userId, {
      from: user.role,
      to: input.role,
    });

    return { id: updated.id, role: updated.role };
  },
};
