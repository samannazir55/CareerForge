import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Plus, Zap, Award } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { dashboardApi, resumeApi, ApiError } from '../../lib/api';
import { ProfileCompletionRing } from '../../components/profile/ProfileCompletionRing';
import { useProfileStore } from '../../store/profile.store';
import { fetchProfile } from '../../lib/profileApi';

interface DashboardData {
  user: { fullName: string | null; email: string; subscriptionTier: string };
  stats: { resumeCount: number; pointsBalance: number; atsScore: number | null };
  recentResumes: Array<{ id: string; title: string; updatedAt: string }>;
  subscription: { tier: string; status: string; currentPeriodEnd: string | null } | null;
}

function StatCard({ label, value, icon, sub }: { label: string; value: string | number; icon: string; sub?: string }) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <GlassCard className="flex items-start gap-4">
        <div className="text-2xl">{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </GlassCard>
    </motion.div>
  );
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile hook initialization and side effects
  const navigate = useNavigate();
  const { profile, setProfile } = useProfileStore();

  useEffect(() => {
    if (!profile) {
      fetchProfile().then(setProfile).catch(() => undefined);
    }
  }, [profile, setProfile]);

  useEffect(() => {
    dashboardApi.get().then(setData).catch((err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to load dashboard.');
    });
  }, []);

  async function handleCreateResume() {
    setIsCreating(true);
    try {
      const { resume } = await resumeApi.create({ title: 'My Resume' });
      window.location.href = `/resumes/${resume.id}`;
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <AppShell>
      <div className="p-6 sm:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">
              Welcome back{data?.user.fullName ? `, ${data.user.fullName.split(' ')[0]}` : ''} 👋
            </h1>
            <p className="text-muted-foreground mt-1">Here's your career overview.</p>
          </div>
          <Button onClick={handleCreateResume} disabled={isCreating}>
            <Plus size={16} className="mr-1.5" />
            {isCreating ? 'Creating…' : 'New Resume'}
          </Button>
        </div>

        {error && <p className="text-destructive mb-6">{error}</p>}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Resumes" value={data?.stats.resumeCount ?? '—'} icon="📄" />
          
          {profile && (
            <div
              className="glass-panel rounded-3xl p-6 relative overflow-hidden group cursor-pointer"
              onClick={() => navigate('/app/profile')}
            >
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-colors" />
              <div className="relative z-10 flex flex-col items-center text-center">
                <ProfileCompletionRing score={profile.completeness.score} size={72} strokeWidth={6} />
                <p className="text-sm font-semibold mt-3">Career Profile</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {profile.completeness.score >= 80 ? 'Looking great' : 'Needs attention'}
                </p>
              </div>
            </div>
          )}

          <StatCard label="Points Balance" value={data?.stats.pointsBalance ?? '—'} icon="⭐" sub="Earn by using CareerForge" />
          <StatCard
            label="ATS Score"
            value={data?.stats.atsScore != null ? `${data.stats.atsScore}%` : '—'}
            icon="🎯"
            sub={data?.stats.atsScore == null ? 'Open a resume to score' : undefined}
          />
          <StatCard
            label="Plan"
            value={data?.user.subscriptionTier ?? '—'}
            icon="💎"
            sub={data?.subscription?.currentPeriodEnd
              ? `Renews ${new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}`
              : undefined}
          />
        </div>

        {/* Recent Resumes */}
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText size={16} /> Recent Resumes
            </h2>
            <Link to="/resumes" className="text-sm text-muted-foreground hover:text-foreground">
              View all →
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
              <Button variant="secondary" onClick={handleCreateResume} disabled={isCreating}>
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

        {/* Upgrade prompt for free users */}
        {data?.user.subscriptionTier === 'FREE' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <GlassCard className="mt-4 bg-gradient-ai border-primary/20">
              <div className="flex items-center gap-4">
                <div className="text-3xl">🚀</div>
                <div className="flex-1">
                  <p className="font-semibold">Unlock Premium Templates & AI Features</p>
                  <p className="text-sm text-muted-foreground">
                    Get unlimited downloads, advanced ATS optimization, and all premium templates.
                  </p>
                </div>
                <Link to="/settings">
                  <Button size="sm">Upgrade</Button>
                </Link>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </div>
    </AppShell>
  );
}