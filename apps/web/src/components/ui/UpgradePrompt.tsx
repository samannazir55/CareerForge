import { Link } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { Button } from './Button';
import { cn } from '../../lib/utils';

interface UpgradePromptProps {
  /** Human-readable name of the locked feature, e.g. "Career Coach". */
  feature: string;
  requiredPlan: 'PROFESSIONAL' | 'PREMIUM';
  /** Optional extra context shown under the headline, e.g. usage-limit copy
   * from a 403 the API returned. */
  message?: string;
  onUpgrade?: () => void;
  className?: string;
}

const PLAN_LABEL: Record<UpgradePromptProps['requiredPlan'], string> = {
  PROFESSIONAL: 'Professional',
  PREMIUM: 'Premium',
};

/**
 * Shown in place of a page's real content (or inline, after a 403) when the
 * caller's plan doesn't include a feature. Always links to /settings — the
 * single place a user can actually change plans.
 */
export function UpgradePrompt({ feature, requiredPlan, message, onUpgrade, className }: UpgradePromptProps) {
  return (
    <GlassCard className={cn('border border-amber-400/30 bg-amber-500/[0.04] text-center py-10', className)}>
      <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-amber-500/15 flex items-center justify-center">
        <Lock size={20} className="text-amber-400" />
      </div>
      <h2 className="font-semibold text-lg mb-1.5">This feature requires {PLAN_LABEL[requiredPlan]}</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        {message ?? `${feature} is available on the ${PLAN_LABEL[requiredPlan]} plan and above. Upgrade to unlock it.`}
      </p>
      <Link to="/settings" onClick={onUpgrade}>
        <Button
          size="sm"
          className="mt-5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-500/90 hover:to-orange-500/90 shadow-lg shadow-amber-500/20"
        >
          Upgrade now <ArrowRight size={14} />
        </Button>
      </Link>
    </GlassCard>
  );
}
