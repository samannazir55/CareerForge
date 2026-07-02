import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '@prisma/client';

/**
 * Records an admin mutation to the append-only audit log. Called from
 * every admin service method that changes data — points grants, plan
 * edits, template toggles, role changes. There are deliberately no
 * update/delete methods for this model; the log is a historical record,
 * not application state.
 */
export async function recordAuditLog(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action,
      targetType,
      targetId,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
    },
  });
}