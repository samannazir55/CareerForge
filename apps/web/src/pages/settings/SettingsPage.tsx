import { useEffect, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { paymentsApi, pointsApi } from '../../lib/api';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface PointsTransaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  createdAt: string;
}

export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [balance, setBalance] = useState(0);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    pointsApi.get().then((d) => {
      setBalance(d.balance);
      setTransactions(d.transactions);
    }).catch(() => undefined);

    // Handle returning from Stripe
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

  const isPro = user?.subscriptionTier === 'PROFESSIONAL';
  const isPremium = user?.subscriptionTier === 'PREMIUM';
  const isFree = user?.subscriptionTier === 'FREE';

  const PLANS = [
    {
      id: 'FREE' as const,
      name: 'Free',
      price: '$0',
      features: ['2 free templates', 'PDF & DOCX export', '3 resumes', 'Basic ATS scoring'],
      current: isFree,
    },
    {
      id: 'PROFESSIONAL' as const,
      name: 'Professional',
      price: '$9/mo',
      features: ['All free features', '5 premium templates', 'Unlimited resumes', 'Advanced ATS scoring', 'AI job matching'],
      current: isPro,
      highlight: true,
    },
    {
      id: 'PREMIUM' as const,
      name: 'Premium',
      price: '$19/mo',
      features: ['Everything in Pro', 'All premium templates', 'AI cover letters', 'Priority AI features', 'Career coach (coming soon)'],
      current: isPremium,
    },
  ];

  return (
    <AppShell>
      <div className="p-6 sm:p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Settings</h1>
        <p className="text-muted-foreground mb-8">Manage your account and subscription.</p>

        {info && (
          <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm">
            {info}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Account */}
        <GlassCard className="mb-6">
          <h2 className="font-semibold mb-4">Account</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Name</span>
              <span className="text-sm font-medium">{user?.fullName ?? '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Email verified</span>
              <span className={`text-sm font-medium ${user?.isEmailVerified ? 'text-green-600' : 'text-amber-600'}`}>
                {user?.isEmailVerified ? 'Verified ✓' : 'Not verified'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Points balance</span>
              <span className="text-sm font-medium">⭐ {balance} points</span>
            </div>
          </div>
        </GlassCard>

        {/* Subscription Plans */}
        <h2 className="font-semibold mb-4">Subscription</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {PLANS.map((plan) => (
            <GlassCard
              key={plan.id}
              className={`flex flex-col ${plan.highlight ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}
            >
              {plan.highlight && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full w-fit mb-3">
                  Most Popular
                </span>
              )}
              <h3 className="font-semibold">{plan.name}</h3>
              <p className="text-2xl font-bold mt-1 mb-4">{plan.price}</p>
              <ul className="space-y-1.5 flex-1 mb-4">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span> {f}
                  </li>
                ))}
              </ul>
              {plan.current ? (
                <Button variant="secondary" size="sm" disabled>Current plan</Button>
              ) : plan.id === 'FREE' ? (
                <Button variant="outline" size="sm" disabled>Downgrade</Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleUpgrade(plan.id as 'PROFESSIONAL' | 'PREMIUM')}
                  disabled={loadingCheckout !== null}
                >
                  {loadingCheckout === plan.id ? 'Redirecting…' : `Upgrade to ${plan.name}`}
                </Button>
              )}
            </GlassCard>
          ))}
        </div>

        {/* Billing portal for paying customers */}
        {(isPro || isPremium) && (
          <GlassCard className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Billing</h3>
                <p className="text-sm text-muted-foreground">Manage payment methods, invoices, and cancel subscription.</p>
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
            <h2 className="font-semibold mb-4">Points History</h2>
            <div className="space-y-2">
              {transactions.slice(0, 10).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{tx.description ?? tx.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-destructive'}`}>
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
