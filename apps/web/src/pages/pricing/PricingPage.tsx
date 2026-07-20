import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { SEO } from '../../components/seo/SEO';
import { plansApi, ApiError, type PublicPlan } from '../../lib/api';
import { getLimits, type Tier } from '@careerforge/schema';
import { SocialLinks } from '../../components/social/SocialLinks';

// Presentational only — pricing, names, and feature lists come live from
// plansApi (the same subscription_plans table admins edit and SettingsPage
// reads), never hardcoded here. See the comment on plansRouter for why:
// two independently-typed-in price tables drifted apart once before.
const PLAN_STYLES = [
  { id: 'FREE' as const, icon: '✦', accent: 'from-slate-500/10 to-slate-600/10', border: 'border-white/10', ring: '', highlight: false },
  { id: 'PROFESSIONAL' as const, icon: '⚡', accent: 'from-indigo-500/10 to-purple-600/10', border: 'border-indigo-400/40', ring: 'ring-1 ring-indigo-400/20', highlight: true },
  { id: 'PREMIUM' as const, icon: '💎', accent: 'from-purple-500/10 to-pink-600/10', border: 'border-purple-400/30', ring: '', highlight: false },
];

export function PricingPage() {
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    plansApi
      .list()
      .then((d) => setPlans(d.plans))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Could not load current pricing. Please try again shortly.');
        setPlans([]);
      });
  }, []);

  return (
    <div className="welcome-page min-h-screen w-full overflow-x-hidden">
      <SEO
        title="Pricing"
        description="Corvyx pricing — a free plan plus Professional and Premium tiers covering resume building, ATS checking, interview prep, job tracking, LinkedIn optimization and AI career coaching."
        canonical="/pricing"
      />

      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-black/30 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="font-semibold text-lg tracking-tight">
            <span className="text-gradient">Corvyx</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/about">
              <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                About
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                Log in
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="bg-white text-black hover:bg-white/90">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-16 pb-24">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight neon-glow-text mb-4">Pricing</h1>
          <p className="text-white/60 max-w-xl mx-auto">
            Start free. Upgrade when you need the full ATS analysis, job tracking, LinkedIn optimization, or
            AI career coaching.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-400 mb-8 text-center">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          {PLAN_STYLES.map((style) => {
            const live = plans?.find((p) => p.tierKey === style.id);
            const limits = getLimits(style.id as Tier);
            return (
              <div
                key={style.id}
                className={`relative rounded-2xl border p-6 flex flex-col bg-gradient-to-br ${style.accent} ${style.border} ${style.ring}`}
              >
                {style.highlight && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-0.5 rounded-full font-semibold tracking-wide uppercase">
                    Most Popular
                  </span>
                )}
                <div className="text-2xl mb-2">{style.icon}</div>

                {plans === null ? (
                  <div className="h-5 w-24 rounded bg-white/10 animate-pulse mb-1" />
                ) : (
                  <h2 className="font-semibold text-lg mb-1">{live?.name ?? style.id}</h2>
                )}

                <div className="flex items-baseline gap-1 mb-5">
                  {plans === null ? (
                    <div className="h-8 w-16 rounded bg-white/10 animate-pulse" />
                  ) : live ? (
                    <>
                      <span className="text-3xl font-bold text-white">
                        {live.priceMonthlyUsd === 0 ? '$0' : `$${live.priceMonthlyUsd}`}
                      </span>
                      <span className="text-sm text-white/50">{live.priceMonthlyUsd === 0 ? 'forever' : '/month'}</span>
                    </>
                  ) : (
                    <span className="text-sm text-white/50">Contact us for pricing</span>
                  )}
                </div>

                <ul className="space-y-2 flex-1 mb-6">
                  {(live?.features ?? []).map((f) => (
                    <li key={f} className="text-sm text-white/60 flex items-start gap-2">
                      <span className="text-emerald-400 mt-0.5 shrink-0">✓</span> {f}
                    </li>
                  ))}
                  {live && (
                    <li className="text-xs text-yellow-400/90 flex items-start gap-2 pt-2 mt-2 border-t border-white/10">
                      <span className="mt-0.5 shrink-0">⭐</span>
                      {limits.pointsOnSignup} points on signup
                      {limits.pointsPerMonth > 0 && ` + ${limits.pointsPerMonth}/month`}
                    </li>
                  )}
                </ul>

                <Link to="/register">
                  <Button
                    size="sm"
                    className={style.highlight ? 'bg-white text-black hover:bg-white/90 w-full' : 'w-full'}
                    variant={style.highlight ? 'primary' : 'outline'}
                  >
                    {style.id === 'FREE' ? 'Start free' : 'Get started'}
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <p className="text-white/40 text-xs mb-4">
            Prices and features are live and may change. Full plan comparison available after you{' '}
            <Link to="/register" className="underline hover:text-white/70">
              create an account
            </Link>
            .
          </p>
          <Link to="/register">
            <Button size="lg" className="bg-white text-black hover:bg-white/90 group">
              Start building free
              <ArrowRight size={16} className="ml-1.5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
        </div>
      </main>

      <footer className="border-t border-white/5 px-6 py-8 text-center text-xs text-white/30">
        <SocialLinks className="mb-4" />
        © {new Date().getFullYear()} Corvyx. Built for people building careers.
      </footer>
    </div>
  );
}
