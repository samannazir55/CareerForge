import { useEffect, useState } from 'react';
import { Users, FileText, Crown, Coins, ShoppingBag, TrendingUp } from 'lucide-react';
import { StatCard, PageHeader } from '../../components/admin/AdminUI';
import { adminApi } from '../../lib/adminApi';
import type { AdminDashboardStats } from '@careerforge/schema';

export function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.getDashboardStats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load stats.'))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
        <PageHeader
          title="Dashboard"
          description="Platform overview at a glance."
        />

        {error && (
          <div className="mb-6 p-4 rounded-2xl border border-destructive/30 bg-destructive/5 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Primary stat grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Users"
            value={isLoading ? '—' : (stats?.totalUsers ?? 0).toLocaleString()}
            sub={isLoading ? undefined : `+${stats?.newUsersLast7Days ?? 0} this week`}
            icon={<Users size={18} />}
            accent="indigo"
            trend="up"
          />
          <StatCard
            label="Total Resumes"
            value={isLoading ? '—' : (stats?.totalResumes ?? 0).toLocaleString()}
            icon={<FileText size={18} />}
            accent="purple"
          />
          <StatCard
            label="Active Subscribers"
            value={isLoading ? '—' : (
              ((stats?.activeSubscriptions.PROFESSIONAL ?? 0) +
              (stats?.activeSubscriptions.PREMIUM ?? 0)).toLocaleString()
            )}
            sub={isLoading ? undefined : `${stats?.activeSubscriptions.PREMIUM ?? 0} Premium`}
            icon={<Crown size={18} />}
            accent="amber"
            trend="up"
          />
          <StatCard
            label="Points in Circulation"
            value={isLoading ? '—' : (stats?.pointsInCirculation ?? 0).toLocaleString()}
            icon={<Coins size={18} />}
            accent="emerald"
          />
        </div>

        {/* Secondary grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard
            label="New Users (30d)"
            value={isLoading ? '—' : stats?.newUsersLast30Days ?? 0}
            icon={<TrendingUp size={18} />}
            accent="cyan"
          />
          <StatCard
            label="Professional Plan"
            value={isLoading ? '—' : stats?.activeSubscriptions.PROFESSIONAL ?? 0}
            sub="Active subscriptions"
            icon={<Crown size={18} />}
            accent="indigo"
          />
          <StatCard
            label="Template Purchases"
            value={isLoading ? '—' : stats?.totalTemplatePurchases ?? 0}
            icon={<ShoppingBag size={18} />}
            accent="rose"
          />
        </div>

        {/* Breakdown cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User tier breakdown */}
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="font-semibold mb-4">Subscription Breakdown</h2>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-6 bg-muted rounded animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'Free', count: (stats?.totalUsers ?? 0) - (stats?.activeSubscriptions.PROFESSIONAL ?? 0) - (stats?.activeSubscriptions.PREMIUM ?? 0), color: 'bg-muted-foreground' },
                  { label: 'Professional', count: stats?.activeSubscriptions.PROFESSIONAL ?? 0, color: 'bg-indigo-500' },
                  { label: 'Premium', count: stats?.activeSubscriptions.PREMIUM ?? 0, color: 'bg-amber-500' },
                ].map(({ label, count, color }) => {
                  const pct = stats?.totalUsers ? Math.round((count / stats.totalUsers) * 100) : 0;
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{count} <span className="text-muted-foreground text-xs">({pct}%)</span></span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { label: 'Manage templates', href: '/admin/templates', description: 'Toggle visibility, set pricing' },
                { label: 'Edit subscription plans', href: '/admin/plans', description: 'Update features and pricing' },
                { label: 'Search users', href: '/admin/users', description: 'Adjust roles and points' },
                { label: 'View audit log', href: '/admin/audit', description: 'All admin actions recorded' },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-accent transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium">{link.label}</p>
                    <p className="text-xs text-muted-foreground">{link.description}</p>
                  </div>
                  <span className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity text-sm">→</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
  );
}
