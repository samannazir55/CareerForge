import { env } from '../../config/env.js';
import { AppError, ConfigurationError } from '../../lib/errors.js';

export interface PageSpeedResult {
  strategy: 'mobile' | 'desktop';
  scores: {
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    seo: number | null;
  };
  coreWebVitals: {
    largestContentfulPaint: string | null;
    cumulativeLayoutShift: string | null;
    totalBlockingTime: string | null;
  };
  fetchedAt: string;
}

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

/**
 * Calls Google's PageSpeed Insights API server-side (keeps the API key off
 * the client) for one strategy at a time. PSI's own rate limit is generous
 * (25k/day on the free tier) but a single run can take 15-30s, so the
 * caller is expected to request mobile/desktop separately rather than
 * block on both.
 */
export async function runPageSpeed(url: string, strategy: 'mobile' | 'desktop'): Promise<PageSpeedResult> {
  if (!env.PAGESPEED_API_KEY) {
    throw new ConfigurationError('PAGESPEED_API_KEY is not configured. Add it in Render -> API service -> Environment.');
  }

  const params = new URLSearchParams({
    url,
    strategy,
    key: env.PAGESPEED_API_KEY,
  });
  ['performance', 'accessibility', 'best-practices', 'seo'].forEach((c) => params.append('category', c));

  const response = await fetch(`${PSI_ENDPOINT}?${params.toString()}`);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new AppError(502, 'PAGESPEED_UPSTREAM_ERROR', `PageSpeed Insights request failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as any;
  const categories = data?.lighthouseResult?.categories ?? {};
  const audits = data?.lighthouseResult?.audits ?? {};

  const toScore = (c: any) => (typeof c?.score === 'number' ? Math.round(c.score * 100) : null);

  return {
    strategy,
    scores: {
      performance: toScore(categories.performance),
      accessibility: toScore(categories.accessibility),
      bestPractices: toScore(categories['best-practices']),
      seo: toScore(categories.seo),
    },
    coreWebVitals: {
      largestContentfulPaint: audits['largest-contentful-paint']?.displayValue ?? null,
      cumulativeLayoutShift: audits['cumulative-layout-shift']?.displayValue ?? null,
      totalBlockingTime: audits['total-blocking-time']?.displayValue ?? null,
    },
    fetchedAt: new Date().toISOString(),
  };
}
