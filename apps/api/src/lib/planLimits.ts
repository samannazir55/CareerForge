// The actual PLAN_LIMITS table lives in @careerforge/schema so both the API
// (enforcement) and the web app (the Settings comparison table) read the
// exact same numbers — see the doc comment on PLAN_LIMITS there for why.
// This file just re-exports it under the path the rest of apps/api expects.
export {
  PLAN_LIMITS,
  FREE_TIER_TEMPLATE_IDS,
  getLimits,
  canUseFeature,
  isValidTier,
  type Tier,
  type PlanLimits,
} from '@careerforge/schema';
