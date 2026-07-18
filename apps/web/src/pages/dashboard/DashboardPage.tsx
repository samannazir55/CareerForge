import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText,
  Plus,
  Coins,
  Crown,
  Trophy,
  History,
  ArrowRight,
  Target,
  Globe2,
  X,
} from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { dashboardApi, pointsApi, paymentsApi, plansApi, type PublicPlan, ApiError } from '../../lib/api';
import { ProfileCompletionRing } from '../../components/profile/ProfileCompletionRing';
import { useProfileStore } from '../../store/profile.store';
import { fetchProfile, fetchOwnPublicProfileSettings } from '../../lib/profileApi';
import { useAuth } from '../../context/AuthContext';
import { OnboardingModal } from '../../components/onboarding/OnboardingModal';

const PORTFOLIO_NUDGE_DISMISSED_KEY = 'corvyx:portfolio-nudge-dismissed';

interface DashboardData {
  user: { fullName: string | null; email: string; subscriptionTier: string };
  stats: { resumeCount: number; pointsBalance: number; atsScore: number | null };
  recentResumes: Array<{ id: string; title: string; updatedAt: string }>;
  subscription: { tier: string; status: string; currentPeriodEnd: string | null } | null;
}

interface PointsTransaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  createdAt: string;
}

// Shows " ($X/mo)" once the real price has loaded, otherwise nothing —
// omitting the price while loading (or if this tier isn't configured) is
// deliberate: a hardcoded fallback here is exactly the bug this replaces
// (this button previously read "Upgrade to Pro ($12/mo)" unconditionally,
// independently of SettingsPage.tsx's own "$9", and the two drifted apart).
function formatPlanPrice(plans: PublicPlan[] | null, tierKey: string): string {
  const plan = plans?.find((p) => p.tierKey === tierKey);
  return plan ? ` ($${plan.priceMonthlyUsd}/mo)` : '';
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPortfolioNudge, setShowPortfolioNudge] = useState(false);

  const navigate = useNavigate();
  const { profile, setProfile } = useProfileStore();
  const { user } = useAuth();
  const showOnboarding = user && !user.hasCompletedOnboarding;

  useEffect(() => {
    if (!profile) {
      fetchProfile().then(setProfile).catch(() => undefined);
    }
  }, [profile, setProfile]);

  useEffect(() => {
    dashboardApi.get().then(setData).catch((err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to load dashboard.');
    });
    pointsApi.get().then((d) => setTransactions(d.transactions)).catch(() => undefined);
    plansApi.list().then((d) => setPlans(d.plans)).catch(() => undefined);

    if (localStorage.getItem(PORTFOLIO_NUDGE_DISMISSED_KEY) !== 'true') {
      fetchOwnPublicProfileSettings()
        .then((settings) => setShowPortfolioNudge(!settings.isPublic || !settings.publicSlug))
        .catch(() => undefined);
    }
  }, []);

  function dismissPortfolioNudge() {
    setShowPortfolioNudge(false);
    localStorage.setItem(PORTFOLIO_NUDGE_DISMISSED_KEY, 'true');
  }

  function handleCreateResume() {
    // Goes to the AI chat builder rather than creating a blank resume and
    // dropping the user straight into the manual editor. This button is the
    // dashboard's most prominent call to action — sending it anywhere other
    // than the AI flow means the app's core value proposition (an AI doing
    // most of the work) has no obvious entry point at all, which is exactly
    // what made it feel hard to find. The manual editor is still one click
    // away from there ("start from scratch") for anyone who prefers it.
    navigate('/resumes/new/chat');
  }

  async function handleUpgrade(tier: 'PROFESSIONAL' | 'PREMIUM') {
    setIsUpgrading(tier);
    try {
      const { url } = await paymentsApi.createCheckout(tier);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start checkout.');
      setIsUpgrading(null);
    }
  }

  const isFree = data?.user.subscriptionTier === 'FREE';

  return (
    <AppShell>
      {showOnboarding && <OnboardingModal />}
      <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome back{data?.user.fullName ? `, ${data.user.fullName.split(' ')[0]}` : ''} 👋
            </h1>
            <p className="text-muted-foreground mt-1">Here's your career overview.</p>
          </div>
          <Button onClick={handleCreateResume} className="w-full sm:w-auto">
            <Plus size={16} className="mr-1.5" />
            New Resume
          </Button>
        </div>

        {error && <p className="text-destructive">{error}</p>}

        {showPortfolioNudge && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-2xl p-4 sm:p-5 flex items-center gap-4 relative"
          >
            <div className="h-10 w-10 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
              <Globe2 size={18} className="text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                🌐 Share your career portfolio — Create your public profile page and share one link with recruiters.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate('/profile')} className="shrink-0">
              Set up now <ArrowRight size={14} className="ml-1.5" />
            </Button>
            <button
              onClick={dismissPortfolioNudge}
              aria-label="Dismiss"
              className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X size={15} />
            </button>
          </motion.div>
        )}

        {/* Points + Subscription + Profile glow cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Points card */}
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }} className="glass-panel rounded-3xl p-6 relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-colors" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium mb-4">
                <Coins size={20} />
                <span>Available Points</span>
              </div>
              <div className="text-5xl font-bold mb-2 tabular-nums">{data?.stats.pointsBalance ?? '—'}</div>
              <p className="text-sm text-muted-foreground mb-6">
                Use points to unlock premium templates.
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate('/marketplace')}>
                Browse Store
              </Button>
            </div>
          </motion.div>

          {/* Subscription card */}
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }} className="glass-panel rounded-3xl p-6 relative overflow-hidden group md:col-span-2">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-colors" />
            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between h-full">
              <div>
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium mb-2">
                  <Crown size={20} />
                  <span>Current Plan</span>
                </div>
                <div className="text-3xl font-bold capitalize mb-2">
                  {data?.user.subscriptionTier?.toLowerCase() ?? '—'} Plan
                </div>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {isFree
                    ? 'Upgrade to Professional or Premium to get monthly points and exclusive features.'
                    : data?.subscription?.currentPeriodEnd
                    ? `Renews ${new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}.`
                    : "You're enjoying premium features and monthly point drops."}
                </p>
              </div>

              {isFree && (
                <div className="flex flex-col gap-3 w-full md:w-auto shrink-0">
                  <Button
                    className="bg-indigo-600 hover:bg-indigo-700 text-white border-0"
                    onClick={() => handleUpgrade('PROFESSIONAL')}
                    disabled={isUpgrading !== null}
                  >
                    {isUpgrading === 'PROFESSIONAL'
                      ? 'Redirecting…'
                      : `Upgrade to Pro${formatPlanPrice(plans, 'PROFESSIONAL')}`}
                  </Button>
                  <Button
                    className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 hover:opacity-90"
                    onClick={() => handleUpgrade('PREMIUM')}
                    disabled={isUpgrading !== null}
                  >
                    {isUpgrading === 'PREMIUM'
                      ? 'Redirecting…'
                      : `Upgrade to Premium${formatPlanPrice(plans, 'PREMIUM')}`}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Profile + ATS row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {profile && (
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ duration: 0.15 }}
              className="glass-panel rounded-3xl p-6 relative overflow-hidden group cursor-pointer"
              onClick={() => navigate('/profile')}
            >
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-colors" />
              <div className="relative z-10 flex items-center gap-5">
                <ProfileCompletionRing score={profile.completeness.score} size={72} strokeWidth={6} />
                <div>
                  <p className="text-sm font-semibold">Career Profile</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {profile.completeness.score >= 80 ? 'Looking great' : 'Needs attention'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }} className="glass-panel rounded-3xl p-6 relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition-colors" />
            <div className="relative z-10 flex items-center gap-5">
              <div className="h-[72px] w-[72px] rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0">
                <Target size={28} className="text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {data?.stats.atsScore != null ? `${data.stats.atsScore}%` : '—'}
                </p>
                <p className="text-sm font-semibold">ATS Score</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data?.stats.atsScore == null ? 'Open a resume to score' : 'Latest resume analysis'}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: achievements + recent resumes */}
          <div className="lg:col-span-2 space-y-8">
            {/* Achievements */}
            <GlassCard>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Trophy size={20} className="text-yellow-500" /> Achievements & Rewards
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-muted/50 border border-border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-sm">Profile Completion</span>
                    <span className="text-xs font-bold text-emerald-500">+50 pts</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${profile?.completeness.score ?? 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {profile?.completeness.score ?? 0}% complete
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-muted/50 border border-border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-sm">Resumes Created</span>
                    <span className="text-xs font-bold text-orange-500">
                      {data?.stats.resumeCount ?? 0} total
                    </span>
                  </div>
                  <div className="flex gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div
                        key={n}
                        className={`h-2 flex-1 rounded-full ${
                          (data?.stats.resumeCount ?? 0) >= n ? 'bg-orange-500' : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {(data?.stats.resumeCount ?? 0) === 0
                      ? 'Create your first resume to start'
                      : 'Keep building to unlock more templates'}
                  </span>
                </div>
              </div>
            </GlassCard>

            {/* Recent Resumes */}
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <FileText size={16} /> Recent Resumes
                </h2>
                <Link to="/resumes" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                  View all <ArrowRight size={14} />
                </Link>
              </div>

              {!data ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 rounded-xl bg-muted/50 animate-pulse" />
                  ))}
                </div>
              ) : data.recentResumes.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No resumes yet. Create your first one.</p>
                  <Button variant="secondary" onClick={handleCreateResume}>
                    <Plus size={14} className="mr-1.5" /> Create resume
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.recentResumes.map((resume) => (
                    <Link
                      key={resume.id}
                      to={`/resumes/${resume.id}`}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-accent transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText size={16} className="text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{resume.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Updated {new Date(resume.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity text-sm">
                        Edit →
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

          {/* Right: transaction history */}
          <div>
            <GlassCard className="h-full">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <History size={20} /> History
              </h2>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No point activity yet.
                </p>
              ) : (
                <div className="space-y-1 -mx-2">
                  {transactions.slice(0, 8).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <div className="font-medium text-sm">{tx.description ?? tx.type}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div
                        className={`font-bold text-sm tabular-nums ${
                          tx.amount > 0 ? 'text-emerald-500' : 'text-foreground'
                        }`}
                      >
                        {tx.amount > 0 ? '+' : ''}
                        {tx.amount}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
