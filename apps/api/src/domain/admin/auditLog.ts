import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '@prisma/client';

const toJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

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
      metadata: metadata !== undefined ? toJson(metadata) : undefined,
    },
  });
}
