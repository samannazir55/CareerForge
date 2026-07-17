import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Eye,
  Users,
  CalendarDays,
  Clock,
  Link2,
  Copy,
  Check,
  ExternalLink,
  TrendingUp,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AppShell } from '../../components/layout/AppShell';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { analyticsApi, sharingApi, ApiError, type ResumeAnalytics } from '../../lib/api';
import { formatRelativeTime } from '../../lib/utils';

/** "203.0.113.42" -> "203.0.xxx.xxx". IPv6 and anything else just gets its
 * back half swapped for "xxxx" — good enough for a privacy-conscious
 * display without pretending to be a real IP-masking library. */
function maskIp(ip: string): string {
  if (ip === 'unknown') return 'Unknown';
  const v4 = ip.split('.');
  if (v4.length === 4) return `${v4[0]}.${v4[1]}.xxx.xxx`;
  const v6 = ip.split(':');
  if (v6.length > 2) return `${v6[0]}:${v6[1]}:xxxx:xxxx`;
  return ip;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  accent: 'indigo' | 'purple' | 'cyan' | 'amber';
}

// Tailwind's build-time scanner needs full, literal class strings to know
// what to keep — `bg-${accent}-500/10` would get purged from the production
// CSS since it can't statically resolve a template literal. This map is
// the fix: every class Tailwind needs to see is written out in full here.
const ACCENT_STYLES: Record<StatCardProps['accent'], { blob: string; icon: string }> = {
  indigo: { blob: 'bg-indigo-500/10 group-hover:bg-indigo-500/20', icon: 'bg-indigo-500/10' },
  purple: { blob: 'bg-purple-500/10 group-hover:bg-purple-500/20', icon: 'bg-purple-500/10' },
  cyan: { blob: 'bg-cyan-500/10 group-hover:bg-cyan-500/20', icon: 'bg-cyan-500/10' },
  amber: { blob: 'bg-amber-500/10 group-hover:bg-amber-500/20', icon: 'bg-amber-500/10' },
};

function StatCard({ icon, label, value, accent }: StatCardProps) {
  const styles = ACCENT_STYLES[accent];
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="glass-panel rounded-2xl p-5 relative overflow-hidden group"
    >
      <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl transition-colors ${styles.blob}`} />
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center mb-3 ${styles.icon}`}>{icon}</div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
        </div>
        <TrendingUp size={14} className="text-muted-foreground/40 mt-1" />
      </div>
    </motion.div>
  );
}

export function ResumeAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState<ResumeAnalytics | null>(null);
  const [shareStatus, setShareStatus] = useState<{ slug: string | null; isEnabled: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [togglingShare, setTogglingShare] = useState(false);

  useEffect(() => {
    if (!id) return;
    analyticsApi
      .getResumeAnalytics(id)
      .then(setAnalytics)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load analytics.'));
    sharingApi.getStatus(id).then(setShareStatus).catch(() => undefined);
  }, [id]);

  const publicUrl = useMemo(() => {
    if (!shareStatus?.slug) return null;
    return `${window.location.origin}${sharingApi.publicUrl(shareStatus.slug)}`;
  }, [shareStatus?.slug]);

  async function handleToggleShare() {
    if (!id || togglingShare) return;
    setTogglingShare(true);
    try {
      if (shareStatus?.isEnabled) {
        await sharingApi.disable(id);
        setShareStatus((s) => (s ? { ...s, isEnabled: false } : s));
      } else {
        const { slug } = await sharingApi.enable(id);
        setShareStatus({ slug, isEnabled: true });
      }
    } catch {
      setError('Could not update the share link. Please try again.');
    } finally {
      setTogglingShare(false);
    }
  }

  function handleCopy() {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const chartData = useMemo(
    () =>
      (analytics?.viewsByDay ?? []).map((d) => ({
        ...d,
        label: new Date(d.date + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      })),
    [analytics?.viewsByDay],
  );

  const maxReferrerCount = Math.max(1, ...(analytics?.topReferrers.map((r) => r.count) ?? [1]));

  return (
    <AppShell>
      <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/resumes/${id}`)} aria-label="Back to editor">
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Resume Analytics</h1>
            <p className="text-muted-foreground mt-1">See who's checking out your resume.</p>
          </div>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {/* Hero stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <StatCard
            icon={<Eye size={16} className="text-indigo-500" />}
            label="Total Views"
            value={analytics ? String(analytics.totalViews) : '—'}
            accent="indigo"
          />
          <StatCard
            icon={<Users size={16} className="text-purple-500" />}
            label="Unique Viewers"
            value={analytics ? String(analytics.uniqueViews) : '—'}
            accent="purple"
          />
          <StatCard
            icon={<CalendarDays size={16} className="text-cyan-500" />}
            label="Views This Week"
            value={analytics ? String(analytics.viewsThisWeek) : '—'}
            accent="cyan"
          />
          <StatCard
            icon={<Clock size={16} className="text-amber-500" />}
            label="Avg. Time Spent"
            value={analytics ? formatDuration(analytics.avgDuration) : '—'}
            accent="amber"
          />
        </div>

        {/* Views over time */}
        <GlassCard>
          <h2 className="text-lg font-bold mb-1">Views Over Time</h2>
          <p className="text-sm text-muted-foreground mb-6">Last 30 days</p>
          <div className="h-64">
            {!analytics ? (
              <div className="h-full rounded-xl bg-muted/50 animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                    formatter={(value: number) => [`${value} view${value === 1 ? '' : 's'}`, '']}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </GlassCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Top referrers */}
          <GlassCard>
            <h2 className="text-lg font-bold mb-5">Top Referrers</h2>
            {!analytics ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 rounded-lg bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : analytics.topReferrers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No views yet.</p>
            ) : (
              <div className="space-y-3">
                {analytics.topReferrers.map((r) => (
                  <div key={r.referrer}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium truncate pr-2">{r.referrer}</span>
                      <span className="text-muted-foreground tabular-nums shrink-0">{r.count}</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                        style={{ width: `${(r.count / maxReferrerCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Share link panel */}
          <GlassCard>
            <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
              <Link2 size={18} /> Share Link
            </h2>
            {!shareStatus ? (
              <div className="h-24 rounded-xl bg-muted/50 animate-pulse" />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
                  <div>
                    <p className="text-sm font-medium">Public link</p>
                    <p className="text-xs text-muted-foreground">
                      {shareStatus.isEnabled ? 'Anyone with the link can view this resume.' : 'Link is currently disabled.'}
                    </p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={shareStatus.isEnabled}
                    onClick={handleToggleShare}
                    disabled={togglingShare}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                      shareStatus.isEnabled ? 'bg-indigo-500' : 'bg-muted-foreground/30'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        shareStatus.isEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {publicUrl && shareStatus.isEnabled ? (
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={publicUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 min-w-0 text-sm bg-muted/50 border border-border rounded-xl px-3 py-2 truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <Button variant="outline" size="icon" onClick={handleCopy} aria-label="Copy link">
                      {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(publicUrl, '_blank', 'noreferrer')}
                      aria-label="Open link"
                    >
                      <ExternalLink size={16} />
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" className="w-full" onClick={handleToggleShare} disabled={togglingShare}>
                    {togglingShare ? 'Enabling…' : 'Enable public link'}
                  </Button>
                )}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Recent views */}
        <GlassCard>
          <h2 className="text-lg font-bold mb-5">Recent Views</h2>
          {!analytics ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : analytics.recentViews.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No one's viewed this resume yet. Share your link to start tracking views.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="font-medium py-2 px-2">IP</th>
                    <th className="font-medium py-2 px-2">Country</th>
                    <th className="font-medium py-2 px-2">Viewed</th>
                    <th className="font-medium py-2 px-2 text-right">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.recentViews.map((v, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-b-0 hover:bg-accent/40 transition-colors">
                      <td className="py-2.5 px-2 font-mono text-xs">{maskIp(v.viewerIp)}</td>
                      <td className="py-2.5 px-2 text-muted-foreground">{v.country ?? 'Unknown'}</td>
                      <td className="py-2.5 px-2 text-muted-foreground">{formatRelativeTime(v.createdAt)}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums">{formatDuration(v.duration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>

        <p className="text-xs text-muted-foreground text-center">
          <Link to={`/resumes/${id}`} className="hover:text-foreground underline underline-offset-2">
            Back to editor
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
