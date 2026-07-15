import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { BadGatewayError, ConfigurationError } from '../../lib/errors.js';
import { JobSearchQuerySchema, type JobSearchListing, type JobSearchResponse } from '@careerforge/schema';
import { env } from '../../config/env.js';

export const jobSearchRouter = Router();

/**
 * GET /api/job-search?q=software+engineer&location=london&country=gb&page=1
 *
 * Proxies to Adzuna so the browser never sees ADZUNA_APP_ID/APP_KEY (they'd
 * otherwise be visible in every request the frontend made). This also gives
 * us a stable, provider-agnostic response shape (JobSearchResponse) — if we
 * ever add or swap job-search providers, only this file changes, not the
 * frontend or the shared schema types.
 *
 * No auth required: search is a public feature, same as the marketing site.
 * Saving a result to the tracker is a separate, authenticated call
 * (POST /api/jobs, see domain/jobtracker) made from the client afterwards.
 */
jobSearchRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q, location, country, page } = JobSearchQuerySchema.parse(req.query);

    if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) {
      throw new ConfigurationError(
        'Job search is not configured. Set ADZUNA_APP_ID and ADZUNA_APP_KEY (free at developer.adzuna.com) in the API service environment.',
      );
    }

    const params = new URLSearchParams({
      app_id: env.ADZUNA_APP_ID,
      app_key: env.ADZUNA_APP_KEY,
      what: q,
      results_per_page: '20',
      'content-type': 'application/json',
    });
    if (location) params.set('where', location);

    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${params.toString()}`;

    let upstream: Response;
    try {
      upstream = await fetch(url);
    } catch {
      throw new BadGatewayError('Could not reach the job search provider. Please try again shortly.');
    }

    if (!upstream.ok) {
      // Adzuna returns 401 for a bad app_id/app_key pair and 400 for a
      // malformed query — surface both as a single "provider" error rather
      // than leaking upstream error bodies straight through.
      throw new BadGatewayError(
        `Job search provider returned an error (${upstream.status}). Double-check ADZUNA_APP_ID / ADZUNA_APP_KEY.`,
      );
    }

    const data = (await upstream.json()) as AdzunaSearchResponse;

    const results: JobSearchListing[] = (data.results ?? []).map((job) => ({
      id: String(job.id),
      title: job.title ?? 'Untitled role',
      company: job.company?.display_name ?? 'Unknown company',
      location: job.location?.display_name ?? '',
      description: (job.description ?? '').slice(0, 300),
      url: job.redirect_url ?? '',
      salary: formatSalary(job.salary_min, job.salary_max),
      postedAt: job.created ?? '',
    }));

    const body: JobSearchResponse = {
      results,
      totalResults: data.count ?? results.length,
      page,
    };

    res.status(200).json(body);
  }),
);

// ---------------------------------------------------------------------------
// Adzuna's raw response shape (only the fields we use — Adzuna returns much
// more than this, e.g. category, contract_type, latitude/longitude).
// ---------------------------------------------------------------------------
interface AdzunaSearchResponse {
  results?: Array<{
    id?: string | number;
    title?: string;
    company?: { display_name?: string };
    location?: { display_name?: string };
    description?: string;
    redirect_url?: string;
    salary_min?: number;
    salary_max?: number;
    created?: string;
  }>;
  count?: number;
}

function formatSalary(min?: number, max?: number): string | undefined {
  if (!min && !max) return undefined;
  const fmt = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
  if (min && max && min !== max) return `${fmt(min)} - ${fmt(max)}`;
  return fmt(min ?? max ?? 0);
}
