import { SubscriptionTierSchema, type SubscriptionTier } from './user.js';

/**
 * The ONE definition of what each subscription tier is entitled to.
 *
 * This lives in @careerforge/schema (not apps/api) deliberately, following
 * the same "single source of truth shared by API + web" pattern already
 * used for pricing (see plansRouter / plansApi.list, backed by the
 * subscription_plans table): pricing/name/marketing copy is DB-driven and
 * admin-editable, but the actual feature *gates* — what a tier can and
 * can't do — are a code-level contract the API enforces and the web app
 * merely displays. Before this existed, feature availability had already
 * drifted once between two independently-hardcoded frontend price tables
 * (see the comment above PLAN_STYLES in SettingsPage.tsx); duplicating a
 * second, separate copy of *feature* limits between apps/api and apps/web
 * would reintroduce exactly that bug for every checkbox in the comparison
 * table. Import this from both sides instead.
 */
export type Tier = SubscriptionTier;

export interface PlanLimits {
  maxResumes: number;
  maxTemplates: number;
  docxExport: boolean;
  fullATS: boolean;
  aiMessagesPerDay: number;
  coverLettersPerMonth: number;
  tailoringPerMonth: number;
  maxJobTracker: number;
  shareableLinks: boolean;
  publicPortfolio: boolean;
  interviewSessionsPerMonth: number;
  linkedinOptimizer: boolean;
  careerCoach: boolean;
  findJobs: boolean;
  pointsOnSignup: number;
  pointsPerMonth: number;
}

export const PLAN_LIMITS: Record<Tier, PlanLimits> = {
  FREE: {
    maxResumes: 3,
    maxTemplates: 2,
    docxExport: false,
    fullATS: false,
    aiMessagesPerDay: 5,
    coverLettersPerMonth: 0,
    tailoringPerMonth: 0,
    maxJobTracker: 3,
    shareableLinks: false,
    publicPortfolio: false,
    interviewSessionsPerMonth: 0,
    linkedinOptimizer: false,
    careerCoach: false,
    findJobs: false,
    pointsOnSignup: 50,
    pointsPerMonth: 0,
  },
  PROFESSIONAL: {
    maxResumes: 10,
    maxTemplates: Infinity,
    docxExport: true,
    fullATS: true,
    aiMessagesPerDay: 50,
    coverLettersPerMonth: 3,
    tailoringPerMonth: 5,
    maxJobTracker: Infinity,
    shareableLinks: true,
    publicPortfolio: true,
    interviewSessionsPerMonth: 5,
    linkedinOptimizer: false,
    careerCoach: false,
    findJobs: true,
    pointsOnSignup: 200,
    pointsPerMonth: 100,
  },
  PREMIUM: {
    maxResumes: Infinity,
    maxTemplates: Infinity,
    docxExport: true,
    fullATS: true,
    aiMessagesPerDay: Infinity,
    coverLettersPerMonth: Infinity,
    tailoringPerMonth: Infinity,
    maxJobTracker: Infinity,
    shareableLinks: true,
    publicPortfolio: true,
    interviewSessionsPerMonth: Infinity,
    linkedinOptimizer: true,
    careerCoach: true,
    findJobs: true,
    pointsOnSignup: 500,
    pointsPerMonth: 250,
  },
};

/** The only two template ids a FREE-tier user may use, per the pricing
 * page ("2 templates (Modern + Classic only)"). Paid tiers aren't
 * restricted to this list — see maxTemplates: Infinity above. */
export const FREE_TIER_TEMPLATE_IDS: readonly string[] = ['modern', 'classic'];

export function getLimits(tier: Tier): PlanLimits {
  return PLAN_LIMITS[tier];
}

/** True when a tier can use a boolean/finite-count feature at all — for
 * numeric limits this only tells you whether the allowance is non-zero,
 * NOT whether the user has hit it; callers enforcing a monthly/daily cap
 * still need to compare actual usage against the limit themselves. */
export function canUseFeature(tier: Tier, feature: keyof PlanLimits): boolean {
  const val = PLAN_LIMITS[tier][feature];
  return val === true || val === Infinity || (typeof val === 'number' && val > 0);
}

export function isValidTier(value: string): value is Tier {
  return SubscriptionTierSchema.safeParse(value).success;
}
