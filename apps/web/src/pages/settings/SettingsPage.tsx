import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, CreditCard, Zap, CheckCircle2, Star, Gift } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { paymentsApi, pointsApi, plansApi, type PublicPlan } from '../../lib/api';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface PointsTransaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  createdAt: string;
}

// Presentational only — pricing, names, and feature lists now come from
// plansApi (the same subscription_plans table admins edit), not from a
// second hardcoded guess living independently in this file. This file
// previously had its own $9/$19 while DashboardPage.tsx separately had its
// own $12/$29 for the same two tiers — nothing kept them in sync because
// there was no shared source at all until plansApi existed.
const PLAN_STYLES = [
  { id: 'FREE' as const, icon: '✦', accent: 'from-slate-500/20 to-slate-600/20', border: 'border-white/10', ring: '', highlight: false },
  { id: 'PROFESSIONAL' as const, icon: '⚡', accent: 'from-indigo-500/20 to-purple-600/20', border: 'border-indigo-400/40', ring: 'ring-1 ring-indigo-400/20', highlight: true },
  { id: 'PREMIUM' as const, icon: '💎', accent: 'from-purple-500/20 to-pink-600/20', border: 'border-purple-400/30', ring: '', highlight: false },
];

export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [balance, setBalance] = useState(0);
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);

  async function handleRedeem() {
    if (!redeemCode.trim()) return;
    setIsRedeeming(true);
    setRedeemError(null);
    setRedeemSuccess(null);
    try {
      const { pointsAwarded, newBalance } = await pointsApi.redeem(redeemCode.trim());
      setBalance(newBalance);
      setRedeemSuccess(`+${pointsAwarded} points added to your balance!`);
      setRedeemCode('');
      pointsApi.get().then((d) => setTransactions(d.transactions)).catch(() => undefined);
    } catch (e) {
      setRedeemError(e instanceof ApiError ? e.message : 'Failed to redeem code.');
    } finally {
      setIsRedeeming(false);
    }
  }

  useEffect(() => {
    pointsApi.get().then((d) => {
      setBalance(d.balance);
      setTransactions(d.transactions);
    }).catch(() => undefined);

    plansApi.list().then((d) => setPlans(d.plans)).catch(() => undefined);

    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setInfo('Subscription activated! Welcome to your new plan.');
      refreshUser();
    }
    if (params.get('canceled') === 'true') {
      setInfo('Checkout was canceled — no charge was made.');
    }
  }, [refreshUser]);

  async function handleUpgrade(tier: 'PROFESSIONAL' | 'PREMIUM') {
    setLoadingCheckout(tier);
    setError(null);
    try {
      const { url } = await paymentsApi.createCheckout(tier);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start checkout.');
      setLoadingCheckout(null);
    }
  }

  async function handleManageBilling() {
    setLoadingPortal(true);
    setError(null);
    try {
      const { url } = await paymentsApi.createPortal();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to open billing portal.');
      setLoadingPortal(false);
    }
  }

  const currentTier = user?.subscriptionTier ?? 'FREE';
  const isPro = currentTier === 'PROFESSIONAL';
  const isPremium = currentTier === 'PREMIUM';

  return (
    <AppShell>
      <div className="relative p-6 sm:p-8 max-w-4xl mx-auto">
        {/* Ambient glow orbs */}
        <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 rounded-full bg-indigo-500/5 blur-3xl" />
        <div className="pointer-events-none absolute bottom-20 left-0 h-48 w-48 rounded-full bg-purple-500/5 blur-3xl" />

        {/* Page header */}
        <div className="flex items-start gap-4 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center shrink-0">
            <Zap size={20} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Settings</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Manage your account and subscription.</p>
          </div>
        </div>

        {/* Feedback banners */}
        {info && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2"
          >
            <CheckCircle2 size={16} /> {info}
          </motion.div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Account card */}
        <GlassCard className="mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
              <User size={15} className="text-indigo-400" />
            </div>
            <h2 className="font-semibold">Account</h2>
          </div>
          <div className="space-y-3 divide-y divide-border">
            {[
              { label: 'Email', value: user?.email },
              { label: 'Name', value: user?.fullName ?? '—' },
              {
                label: 'Email verified',
                value: user?.isEmailVerified ? 'Verified ✓' : 'Pending',
                valueClass: user?.isEmailVerified ? 'text-emerald-400' : 'text-amber-400',
              },
              {
                label: 'Points balance',
                value: `⭐ ${balance} pts`,
                valueClass: 'text-yellow-400 font-semibold',
              },
              { label: 'Current plan', value: currentTier, valueClass: 'capitalize' },
            ].map(({ label, value, valueClass }) => (
              <div key={label} className="flex justify-between items-center py-2.5 first:pt-0">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className={`text-sm font-medium ${valueClass ?? ''}`}>{value}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Redeem a promo code */}
        <GlassCard className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Gift size={15} className="text-amber-400" />
            </div>
            <div>
              <h2 className="font-semibold">Redeem a code</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Got a promo code from us? Enter it here for bonus points.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={redeemCode}
              onChange={(e) => { setRedeemCode(e.target.value.toUpperCase()); setRedeemError(null); setRedeemSuccess(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRedeem(); }}
              placeholder="e.g. NEWYEAR2027"
              className="flex-1 h-10 rounded-xl border border-input bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button onClick={handleRedeem} disabled={isRedeeming || !redeemCode.trim()}>
              {isRedeeming ? 'Redeeming…' : 'Redeem'}
            </Button>
          </div>
          {redeemError && <p className="text-sm text-destructive mt-3">{redeemError}</p>}
          {redeemSuccess && <p className="text-sm text-emerald-400 mt-3">{redeemSuccess}</p>}
        </GlassCard>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
            <CreditCard size={15} className="text-purple-400" />
          </div>
          <h2 className="font-semibold">Subscription</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {PLAN_STYLES.map((style, i) => {
            const isCurrent = currentTier === style.id;
            const live = plans?.find((p) => p.tierKey === style.id);
            return (
              <motion.div
                key={style.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`relative rounded-2xl border p-5 flex flex-col bg-gradient-to-br ${style.accent} ${style.border} ${style.ring} ${isCurrent ? 'opacity-100' : ''}`}
              >
                {style.highlight && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-0.5 rounded-full font-semibold tracking-wide uppercase">
                    Most Popular
                  </span>
                )}
                {isCurrent && (
                  <span className="absolute top-3 right-3 text-[10px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full">
                    Current
                  </span>
                )}
                <div className="text-2xl mb-2">{style.icon}</div>
                {plans === null ? (
                  <div className="h-4 w-20 rounded bg-white/10 animate-pulse mb-0.5" />
                ) : (
                  <h3 className="font-semibold mb-0.5">{live?.name ?? style.id}</h3>
                )}
                <div className="flex items-baseline gap-0.5 mb-4">
                  {plans === null ? (
                    <div className="h-7 w-14 rounded bg-white/10 animate-pulse" />
                  ) : live ? (
                    <>
                      <span className="text-2xl font-bold">
                        {live.priceMonthlyUsd === 0 ? '$0' : `$${live.priceMonthlyUsd}`}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {live.priceMonthlyUsd === 0 ? 'forever' : '/month'}
                      </span>
                    </>
                  ) : (
                    // Fetch failed or this tier isn't configured — honest
                    // rather than falling back to a stale guess, which is
                    // exactly the bug this replaces.
                    <span className="text-sm text-muted-foreground">Contact us for pricing</span>
                  )}
                </div>
                <ul className="space-y-1.5 flex-1 mb-5">
                  {(live?.features ?? []).map((f) => (
                    <li key={f} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-emerald-400 mt-0.5 shrink-0">✓</span> {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button variant="secondary" size="sm" disabled>Current plan</Button>
                ) : style.id === 'FREE' ? (
                  <Button variant="outline" size="sm" disabled>Downgrade</Button>
                ) : (
                  <Button
                    size="sm"
                    className={style.id === 'PROFESSIONAL'
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-500/90 hover:to-purple-600/90 shadow-lg shadow-indigo-500/20'
                      : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-500/90 hover:to-pink-600/90 shadow-lg shadow-purple-500/20'}
                    onClick={() => handleUpgrade(style.id as 'PROFESSIONAL' | 'PREMIUM')}
                    disabled={loadingCheckout !== null}
                  >
                    {loadingCheckout === style.id ? 'Redirecting…' : `Upgrade to ${live?.name ?? style.id}`}
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center mb-6">
          By subscribing you agree to our{' '}
          <Link to="/terms" className="text-indigo-500 hover:underline">Terms</Link>,{' '}
          <Link to="/privacy" className="text-indigo-500 hover:underline">Privacy Policy</Link>, and{' '}
          <Link to="/refund-policy" className="text-indigo-500 hover:underline">Refund Policy</Link>.
        </p>

        {/* Billing portal */}
        {(isPro || isPremium) && (
          <GlassCard className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Billing</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Manage payment methods, invoices, and cancel your subscription.</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleManageBilling} disabled={loadingPortal}>
                {loadingPortal ? 'Opening…' : 'Manage billing'}
              </Button>
            </div>
          </GlassCard>
        )}

        {/* Points history */}
        {transactions.length > 0 && (
          <GlassCard>
            <div className="flex items-center gap-3 mb-4">
              <Star size={15} className="text-yellow-400" />
              <h2 className="font-semibold">Points History</h2>
            </div>
            <div className="space-y-0 divide-y divide-border">
              {transactions.slice(0, 10).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium">{tx.description ?? tx.type}</p>
                    <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-sm font-bold ${tx.amount > 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
    </AppShell>
  );
}
