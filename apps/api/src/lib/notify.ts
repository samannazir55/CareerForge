import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

// Same cast used by interview.routes.ts and admin/auditLog.ts for every
// hand-built object headed into a Prisma Json column — Prisma's generated
// input types don't structurally accept a plain `unknown`/interface value
// even when the shape is already Json-safe.
const toJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

/**
 * Fire-and-forget notification creation, called from other domain services
 * whenever something happens that the user should be told about (points
 * earned, subscription changes, completed interview sessions, etc).
 *
 * Deliberately swallows its own errors rather than throwing: a notification
 * is a side effect of the real operation (awarding points, recording a
 * webhook, saving an interview session), not part of its contract. A
 * failure to write a Notification row should never roll back or fail the
 * thing that triggered it — callers use `.catch(() => undefined)` at the
 * call site for the same reason, matching the existing pattern used for
 * the points-on-premium-upgrade side effect in subscription.service.ts.
 */
export async function notify(
  userId: string,
  type: string,
  title: string,
  body: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        metadata: metadata !== undefined ? toJson(metadata) : undefined,
      },
    });
  } catch (err) {
    console.error(`[notify] failed to create "${type}" notification for user ${userId}:`, err);
  }
}
