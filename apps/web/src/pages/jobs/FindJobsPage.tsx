import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  MapPin,
  Building2,
  ExternalLink,
  Plus,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Loader2,
  Sparkles,
  FileText,
  Link2,
} from 'lucide-react';
import type { JobSearchCountry, JobSearchListing } from '@careerforge/schema';
import { jobSearchApi, aiApi, ApiError } from '../../lib/api';
import { AppShell } from '../../components/layout/AppShell';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { TailorResumeModal } from '../../components/jobs/TailorResumeModal';
import { CoverLetterModal } from '../../components/jobs/CoverLetterModal';
import type { JobTrackerPrefillState } from './JobTrackerPage';

const COUNTRIES: { code: JobSearchCountry; label: string }[] = [
  { code: 'us', label: 'United States' },
  { code: 'gb', label: 'United Kingdom' },
  { code: 'au', label: 'Australia' },
  { code: 'ca', label: 'Canada' },
  { code: 'de', label: 'Germany' },
  { code: 'fr', label: 'France' },
  { code: 'in', label: 'India' },
  { code: 'nl', label: 'Netherlands' },
  { code: 'nz', label: 'New Zealand' },
  { code: 'pl', label: 'Poland' },
  { code: 'ru', label: 'Russia' },
  { code: 'sg', label: 'Singapore' },
  { code: 'za', label: 'South Africa' },
];

const RESULTS_PER_PAGE = 20;

function timeAgoLabel(postedAt: string): string | null {
  if (!postedAt) return null;
  const days = Math.floor((Date.now() - new Date(postedAt).getTime()) / 86_400_000);
  if (Number.isNaN(days)) return null;
  if (days <= 0) return 'Posted today';
  if (days === 1) return 'Posted 1 day ago';
  return `Posted ${days} days ago`;
}

export function FindJobsPage() {
  const navigate = useNavigate();

  const [q, setQ] = useState('');
  const [location, setLocationInput] = useState('');
  const [country, setCountry] = useState<JobSearchCountry>('us');
  const [page, setPage] = useState(1);

  const [results, setResults] = useState<JobSearchListing[] | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [tailorTarget, setTailorTarget] = useState<JobSearchListing | null>(null);
  const [coverLetterTarget, setCoverLetterTarget] = useState<JobSearchListing | null>(null);

  // "Paste Job URL" tab — an alternative to the Adzuna search above for
  // when the person already has a specific listing link. Scraped result is
  // normalised into a JobSearchListing shape so it can reuse JobResultCard
  // (and the same Tailor Resume / Cover Letter / Add to Tracker actions)
  // rather than needing a second, near-identical card component.
  const [activeTab, setActiveTab] = useState<'search' | 'url'>('search');
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedJob, setImportedJob] = useState<JobSearchListing | null>(null);

  async function handleImportJob() {
    const url = importUrl.trim();
    if (!url) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const { job } = await aiApi.scrapeJob(url);
      setImportedJob({
        id: `scraped-${Date.now()}`,
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        url: job.url,
        postedAt: '',
      });
    } catch (err) {
      setImportError(
        err instanceof ApiError ? err.message : "Couldn't fetch that URL — please check the link and try again.",
      );
      setImportedJob(null);
    } finally {
      setIsImporting(false);
    }
  }

  async function runSearch(targetPage: number) {
    if (!q.trim()) {
      setError('Enter a keyword to search — e.g. a job title or skill.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await jobSearchApi.search({
        q: q.trim(),
        location: location.trim() || undefined,
        country,
        page: targetPage,
      });
      setResults(data.results);
      setTotalResults(data.totalResults);
      setPage(data.page);
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not search jobs right now. Please try again.');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    runSearch(1);
  }

  function handleAddToTracker(job: JobSearchListing) {
    const state: JobTrackerPrefillState = {
      prefill: {
        companyName: job.company,
        jobTitle: job.title,
        jobUrl: job.url || undefined,
      },
    };
    navigate('/jobs', { state });
  }

  const totalPages = Math.max(1, Math.ceil(totalResults / RESULTS_PER_PAGE));

  return (
    <AppShell>
      <div className="p-4 sm:p-8 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Search size={22} className="text-indigo-400" />
            Find Jobs
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Search live listings and save the ones you like straight to your Job Tracker.
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
              activeTab === 'search' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Search Adzuna
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
              activeTab === 'url' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Paste Job URL
          </button>
        </div>

        {activeTab === 'search' ? (
          <>
            <GlassCard className="mb-6 !p-4 sm:!p-5">
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1">
                  <Input
                    label="Keyword"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="e.g. Software Engineer"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    label="Location"
                    value={location}
                    onChange={(e) => setLocationInput(e.target.value)}
                    placeholder="e.g. London"
                  />
                </div>
                <div className="w-full sm:w-48">
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Country</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value as JobSearchCountry)}
                    className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" disabled={loading} className="sm:w-auto">
                  {loading ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <Search size={16} className="mr-1.5" />}
                  Search
                </Button>
              </form>
            </GlassCard>

            {error && <p className="text-sm text-destructive mb-4">{error}</p>}

            {!hasSearched && !loading && (
              <GlassCard className="text-center">
                <Briefcase size={28} className="text-indigo-400 mx-auto mb-3" />
                <p className="text-muted-foreground mb-1">Search thousands of live listings.</p>
                <p className="text-sm text-muted-foreground">Try a job title, a skill, or a company name to get started.</p>
              </GlassCard>
            )}

            {loading && (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 size={18} className="animate-spin" /> Searching…
              </div>
            )}

            {!loading && hasSearched && results?.length === 0 && (
              <GlassCard className="text-center">
                <p className="text-muted-foreground mb-1">No results for that search.</p>
                <p className="text-sm text-muted-foreground">Try a broader keyword or a different location.</p>
              </GlassCard>
            )}

            {!loading && results && results.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground mb-3 tabular-nums">
                  {totalResults.toLocaleString()} result{totalResults === 1 ? '' : 's'} · page {page} of {totalPages}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AnimatePresence initial={false}>
                    {results.map((job) => (
                      <JobResultCard
                        key={job.id}
                        job={job}
                        onAdd={() => handleAddToTracker(job)}
                        onTailor={() => setTailorTarget(job)}
                        onCoverLetter={() => setCoverLetterTarget(job)}
                      />
                    ))}
                  </AnimatePresence>
                </div>

                <div className="flex items-center justify-center gap-3 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => runSearch(page - 1)}
                  >
                    <ChevronLeft size={14} className="mr-1" /> Previous
                  </Button>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => runSearch(page + 1)}
                  >
                    Next <ChevronRight size={14} className="ml-1" />
                  </Button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <GlassCard className="mb-6 !p-4 sm:!p-5">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1">
                  <Input
                    label="Job listing URL"
                    value={importUrl}
                    onChange={(e) => { setImportUrl(e.target.value); setImportError(null); }}
                    placeholder="https://linkedin.com/jobs/…"
                  />
                </div>
                <Button onClick={handleImportJob} disabled={isImporting || !importUrl.trim()} className="sm:w-auto">
                  {isImporting ? (
                    <Loader2 size={16} className="animate-spin mr-1.5" />
                  ) : (
                    <Link2 size={16} className="mr-1.5" />
                  )}
                  Import Job
                </Button>
              </div>
            </GlassCard>

            {importError && <p className="text-sm text-destructive mb-4">{importError}</p>}

            {!importedJob && !importError && (
              <GlassCard className="text-center">
                <Link2 size={28} className="text-indigo-400 mx-auto mb-3" />
                <p className="text-muted-foreground mb-1">Paste a link to any job listing.</p>
                <p className="text-sm text-muted-foreground">Works with LinkedIn, Indeed, Greenhouse, Lever, and most company career pages.</p>
              </GlassCard>
            )}

            {importedJob && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <JobResultCard
                  job={importedJob}
                  onAdd={() => handleAddToTracker(importedJob)}
                  onTailor={() => setTailorTarget(importedJob)}
                  onCoverLetter={() => setCoverLetterTarget(importedJob)}
                />
              </div>
            )}
          </>
        )}
      </div>

      <TailorResumeModal
        open={tailorTarget !== null}
        onClose={() => setTailorTarget(null)}
        initialJobDescription={tailorTarget?.description ?? ''}
        jobContext={tailorTarget ? `${tailorTarget.title} at ${tailorTarget.company}` : undefined}
      />
      <CoverLetterModal
        open={coverLetterTarget !== null}
        onClose={() => setCoverLetterTarget(null)}
        initialJobDescription={coverLetterTarget?.description ?? ''}
        jobContext={coverLetterTarget ? `${coverLetterTarget.title} at ${coverLetterTarget.company}` : undefined}
      />
    </AppShell>
  );
}

function JobResultCard({
  job,
  onAdd,
  onTailor,
  onCoverLetter,
}: {
  job: JobSearchListing;
  onAdd: () => void;
  onTailor: () => void;
  onCoverLetter: () => void;
}) {
  const posted = timeAgoLabel(job.postedAt);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="glass-panel rounded-xl p-5 border border-border/50 flex flex-col"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
          <Building2 size={16} className="text-indigo-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm leading-snug">{job.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{job.company}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-muted-foreground">
        {job.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} /> {job.location}
          </span>
        )}
        {job.salary && <span className="text-emerald-400 font-medium">{job.salary}</span>}
        {posted && <span>{posted}</span>}
      </div>

      {job.description && (
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed line-clamp-3">
          {job.description}
          {job.description.length >= 300 ? '…' : ''}
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-border/50 flex flex-col gap-3">
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors self-start"
          >
            <ExternalLink size={13} /> View listing
          </a>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onTailor}>
            <Sparkles size={13} className="mr-1.5" /> Tailor Resume
          </Button>
          <Button size="sm" variant="secondary" onClick={onCoverLetter}>
            <FileText size={13} className="mr-1.5" /> Cover Letter
          </Button>
          <Button size="sm" variant="secondary" onClick={onAdd}>
            <Plus size={13} className="mr-1.5" /> Add to Tracker
          </Button>
        </div>
      </div>
    </motion.div>
  );
}