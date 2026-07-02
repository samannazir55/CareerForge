import { prisma } from '../../lib/prisma.js';

export const adminAuditService = {
  async list(limit = 100) {
    const entries = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
      include: { admin: { select: { email: true } } },
    });

    return entries.map((e) => ({
      id: e.id,
      adminId: e.adminId,
      adminEmail: e.admin.email,
      action: e.action,
      targetType: e.targetType,
      targetId: e.targetId,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString(),
    }));
  },
};
