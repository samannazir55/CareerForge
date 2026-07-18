import type { UsageKind } from '@prisma/client';
import { prisma } from './prisma.js';
import { ForbiddenError } from './errors.js';
import { getLimits, type Tier, type PlanLimits } from './planLimits.js';

/** Midnight UTC today — the start of the "per day" window for aiMessagesPerDay. */
function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** The 1st of the current month, midnight UTC — the start of the "per
 * month" window for coverLettersPerMonth / tailoringPerMonth / the
 * interview-session count. Calendar-month, not rolling-30-days, to match
 * how the pricing page phrases these limits ("3/month"). */
function startOfMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

const FEATURE_NAME: Record<UsageKind, string> = {
  AI_CHAT_MESSAGE: 'AI chat messages',
  COVER_LETTER: 'Cover letter generation',
  RESUME_TAILORING: 'Resume tailoring',
};

const LIMIT_FIELD: Record<UsageKind, keyof PlanLimits> = {
  AI_CHAT_MESSAGE: 'aiMessagesPerDay',
  COVER_LETTER: 'coverLettersPerMonth',
  RESUME_TAILORING: 'tailoringPerMonth',
};

const WINDOW_START: Record<UsageKind, () => Date> = {
  AI_CHAT_MESSAGE: startOfTodayUtc,
  COVER_LETTER: startOfMonthUtc,
  RESUME_TAILORING: startOfMonthUtc,
};

const WINDOW_LABEL: Record<UsageKind, string> = {
  AI_CHAT_MESSAGE: 'day',
  COVER_LETTER: 'month',
  RESUME_TAILORING: 'month',
};

/**
 * Throws ForbiddenError if the user has already used up their plan's
 * allowance for `kind` in the current window. Does NOT record usage itself
 * — call logUsage() only after the gated action actually succeeds, so a
 * failed AI call (upstream error, validation failure, etc) never eats into
 * someone's daily/monthly quota.
 */
export async function assertWithinUsageLimit(userId: string, tier: Tier, kind: UsageKind): Promise<void> {
  const limit = getLimits(tier)[LIMIT_FIELD[kind]] as number;
  if (limit === Infinity) return;
  if (limit <= 0) {
    throw new ForbiddenError(
      `${FEATURE_NAME[kind]} requires a Professional or Premium plan.`,
      'PLAN_LIMIT_REACHED',
    );
  }

  const count = await prisma.usageLog.count({
    where: { userId, kind, createdAt: { gte: WINDOW_START[kind]() } },
  });
  if (count >= limit) {
    throw new ForbiddenError(
      `You've used all ${limit} ${FEATURE_NAME[kind].toLowerCase()} for this ${WINDOW_LABEL[kind]} on your ${tier} plan. Upgrade for more.`,
      'PLAN_LIMIT_REACHED',
    );
  }
}

export async function logUsage(userId: string, kind: UsageKind): Promise<void> {
  await prisma.usageLog.create({ data: { userId, kind } });
}

/**
 * Interview sessions aren't metered through UsageLog — a completed session
 * already produces exactly one ConversationSession row (see
 * interview.routes.ts POST /session), so counting those directly avoids a
 * second ledger that could drift from the real session history.
 */
export async function assertWithinInterviewSessionLimit(userId: string, tier: Tier): Promise<void> {
  const limit = getLimits(tier).interviewSessionsPerMonth;
  if (limit === Infinity) return;
  if (limit <= 0) {
    throw new ForbiddenError('Interview prep requires a Professional or Premium plan.', 'PLAN_LIMIT_REACHED');
  }

  const count = await prisma.conversationSession.count({
    where: { userId, title: { startsWith: 'Interview prep' }, createdAt: { gte: startOfMonthUtc() } },
  });
  if (count >= limit) {
    throw new ForbiddenError(
      `You've used all ${limit} interview prep sessions for this month on your ${tier} plan. Upgrade for more.`,
      'PLAN_LIMIT_REACHED',
    );
  }
}
