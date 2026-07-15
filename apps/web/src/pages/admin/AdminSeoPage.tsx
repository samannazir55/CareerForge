import { useState } from 'react';
import { Search, RefreshCw, Smartphone, Monitor, ExternalLink } from 'lucide-react';
import { PageHeader, StatCard } from '../../components/admin/AdminUI';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { adminApi, type PageSpeedResult } from '../../lib/adminApi';
import { cn } from '../../lib/utils';

function scoreAccent(score: number | null): 'emerald' | 'amber' | 'rose' | 'gray' {
  if (score === null) return 'gray';
  if (score >= 90) return 'emerald';
  if (score >= 50) return 'amber';
  return 'rose';
}

const SCORE_LABELS: { key: keyof PageSpeedResult['scores']; label: string }[] = [
  { key: 'performance', label: 'Performance' },
  { key: 'seo', label: 'SEO' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'bestPractices', label: 'Best Practices' },
];

export function AdminSeoPage() {
  const [url, setUrl] = useState('https://corvyx.app');
  const [strategy, setStrategy] = useState<'mobile' | 'desktop'>('mobile');
  const [result, setResult] = useState<PageSpeedResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsApiKey, setNeedsApiKey] = useState(false);

  function run() {
    setIsLoading(true);
    setError(null);
    setNeedsApiKey(false);
    adminApi
      .getPageSpeed(url, strategy)
      .then(setResult)
      .catch((e) => {
        const message = e instanceof Error ? e.message : 'PageSpeed request failed.';
        if (message.includes('PAGESPEED_API_KEY')) setNeedsApiKey(true);
        setError(message);
      })
      .finally(() => setIsLoading(false));
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="SEO"
        description="Live Lighthouse scores from Google's PageSpeed Insights API — performance, SEO, accessibility, and Core Web Vitals for any URL on your site."
        action={
          <Button variant="outline" onClick={run} disabled={isLoading}>
            <RefreshCw size={14} className={cn('mr-1.5', isLoading && 'animate-spin')} />
            {isLoading ? 'Running…' : 'Run test'}
          </Button>
        }
      />

      <div className="glass-panel rounded-2xl p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <Input label="URL to test" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://corvyx.app" />
        </div>
        <div className="flex gap-1.5 p-1 rounded-xl bg-muted w-fit">
          <button
            onClick={() => setStrategy('mobile')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              strategy === 'mobile' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Smartphone size={14} /> Mobile
          </button>
          <button
            onClick={() => setStrategy('desktop')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              strategy === 'desktop' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Monitor size={14} /> Desktop
          </button>
        </div>
      </div>

      {needsApiKey && (
        <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm">
          <p className="font-medium text-amber-600 dark:text-amber-400">PageSpeed API key not set</p>
          <p className="text-muted-foreground mt-1">
            Add <code className="text-xs bg-muted px-1 py-0.5 rounded">PAGESPEED_API_KEY</code> in Render → your API
            service → Environment. Get a free key from{' '}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-500 hover:underline inline-flex items-center gap-1"
            >
              Google Cloud Console <ExternalLink size={11} />
            </a>{' '}
            — enable "PageSpeed Insights API" first, then create an API key.
          </p>
        </div>
      )}

      {error && !needsApiKey && (
        <div className="mb-6 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive">{error}</div>
      )}

      {!result && !isLoading && !error && (
        <div className="glass-panel rounded-2xl p-12 text-center">
          <Search size={32} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Run a test to see live scores for this URL.</p>
          <p className="text-xs text-muted-foreground mt-1">A single run typically takes 15-30 seconds.</p>
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {SCORE_LABELS.map(({ key, label }) => (
              <StatCard
                key={key}
                label={label}
                value={result.scores[key] ?? '—'}
                sub="out of 100"
                icon={<Search size={16} />}
                accent={scoreAccent(result.scores[key])}
              />
            ))}
          </div>

          <div className="glass-panel rounded-2xl p-5">
            <p className="text-sm font-semibold mb-3">Core Web Vitals</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Largest Contentful Paint</p>
                <p className="font-mono mt-0.5">{result.coreWebVitals.largestContentfulPaint ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Cumulative Layout Shift</p>
                <p className="font-mono mt-0.5">{result.coreWebVitals.cumulativeLayoutShift ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Total Blocking Time</p>
                <p className="font-mono mt-0.5">{result.coreWebVitals.totalBlockingTime ?? '—'}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Last run {new Date(result.fetchedAt).toLocaleString()} · {result.strategy}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
