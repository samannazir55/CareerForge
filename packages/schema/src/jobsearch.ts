import { z } from 'zod';

// Wire shape returned by GET /api/job-search. Deliberately provider-agnostic —
// this is what Adzuna's response gets normalised into (see
// apps/api/src/domain/jobsearch/jobsearch.routes.ts) so the frontend, and any
// future additional job-search provider, only ever has to deal with one shape.
export const JobSearchListingSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  description: z.string(),
  url: z.string(),
  salary: z.string().optional(),
  postedAt: z.string(),
});
export type JobSearchListing = z.infer<typeof JobSearchListingSchema>;

export const JobSearchResponseSchema = z.object({
  results: z.array(JobSearchListingSchema),
  totalResults: z.number(),
  page: z.number(),
});
export type JobSearchResponse = z.infer<typeof JobSearchResponseSchema>;

// Country codes Adzuna's /v1/api/jobs/{country}/search endpoint supports.
export const JobSearchCountrySchema = z.enum([
  'us',
  'gb',
  'au',
  'ca',
  'de',
  'fr',
  'in',
  'nl',
  'nz',
  'pl',
  'ru',
  'sg',
  'za',
]);
export type JobSearchCountry = z.infer<typeof JobSearchCountrySchema>;

export const JobSearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'q is required.'),
  location: z.string().trim().optional(),
  country: JobSearchCountrySchema.optional().default('gb'),
  page: z.coerce.number().int().min(1).optional().default(1),
});
export type JobSearchQuery = z.infer<typeof JobSearchQuerySchema>;
