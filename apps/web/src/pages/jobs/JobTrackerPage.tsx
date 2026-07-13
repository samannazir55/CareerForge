import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  X,
  Building2,
  ExternalLink,
  Trash2,
  ChevronDown,
  ChevronUp,
  Briefcase,
} from 'lucide-react';
import type { JobApplication, JobApplicationStatus } from '@careerforge/schema';
import { jobsApi, ApiError } from '../../lib/api';
import { AppShell } from '../../components/layout/AppShell';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { cn } from '../../lib/utils';

// ---------------------------------------------------------------------------
// Status <-> column mapping
//
// The board has 4 primary columns (wishlist / applied / interview / offer)
// plus a collapsed "rejected" section, but the underlying Prisma enum has 7
// values. PHONE_SCREEN folds into the Applied column (still pre-interview)
// and WITHDRAWN folds into the Rejected section (both are "out of the
// running", just for different reasons) so every application always has a
// home on the board and nothing is silently dropped.
// ---------------------------------------------------------------------------

type ColumnId = 'wishlist' | 'applied' | 'interview' | 'offer';

const STATUS_META: Record<JobApplicationStatus, { label: string; column: ColumnId | 'rejected'; dot: string }> = {
  SAVED: { label: 'Saved', column: 'wishlist', dot: 'bg-slate-400' },
  APPLIED: { label: 'Applied', column: 'applied', dot: 'bg-indigo-400' },
  PHONE_SCREEN: { label: 'Phone Screen', column: 'applied', dot: 'bg-indigo-300' },
  INTERVIEW: { label: 'Interview', column: 'interview', dot: 'bg-amber-400' },
  OFFER: { label: 'Offer', column: 'offer', dot: 'bg-emerald-400' },
  REJECTED: { label: 'Rejected', column: 'rejected', dot: 'bg-rose-400' },
  WITHDRAWN: { label: 'Withdrawn', column: 'rejected', dot: 'bg-rose-300' },
};

const STATUS_OPTIONS = Object.entries(STATUS_META) as [JobApplicationStatus, (typeof STATUS_META)[JobApplicationStatus]][];

const COLUMNS: { id: ColumnId; label: string; accent: string; glow: string }[] = [
  { id: 'wishlist', label: 'Wishlist', accent: 'text-slate-400', glow: 'bg-slate-400/10' },
  { id: 'applied', label: 'Applied', accent: 'text-indigo-400', glow: 'bg-indigo-500/10' },
  { id: 'interview', label: 'Interview', accent: 'text-amber-400', glow: 'bg-amber-500/10' },
  { id: 'offer', label: 'Offer', accent: 'text-emerald-400', glow: 'bg-emerald-500/10' },
];

function daysSinceLabel(appliedAt: string | null | undefined): string {
  if (!appliedAt) return 'Not applied yet';
  const days = Math.floor((Date.now() - new Date(appliedAt).getTime()) / 86_400_000);
  if (days <= 0) return 'Applied today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

/** yyyy-mm-dd for an <input type="date">, from an ISO datetime (or ''). */
function toDateInputValue(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}

export function JobTrackerPage() {
  const [jobs, setJobs] = useState<JobApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectedOpen, setRejectedOpen] = useState(false);
  // null = closed, 'new' = create form, JobApplication = editing that job
  const [panelTarget, setPanelTarget] = useState<JobApplication | 'new' | null>(null);

  useEffect(() => {
    jobsApi
      .list()
      .then((data) => setJobs(data.jobs))
      .catch(() => setError('Could not load your job applications.'));
  }, []);

  const byColumn = useMemo(() => {
    const grouped: Record<ColumnId, JobApplication[]> = { wishlist: [], applied: [], interview: [], offer: [] };
    const rejected: JobApplication[] = [];
    for (const job of jobs ?? []) {
      const meta = STATUS_META[job.status as JobApplicationStatus];
      if (meta.column === 'rejected') rejected.push(job);
      else grouped[meta.column].push(job);
    }
    return { grouped, rejected };
  }, [jobs]);

  function upsertJob(job: JobApplication) {
    setJobs((prev) => {
      if (!prev) return [job];
      const exists = prev.some((j) => j.id === job.id);
      return exists ? prev.map((j) => (j.id === job.id ? job : j)) : [job, ...prev];
    });
  }

  async function handleDelete(id: string) {
    setJobs((prev) => prev?.filter((j) => j.id !== id) ?? null);
    setPanelTarget(null);
    try {
      await jobsApi.remove(id);
    } catch {
      setError('Could not delete that application.');
    }
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-8 max-w-6xl mx-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Briefcase size={22} className="text-indigo-400" />
              Job Tracker
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Every application, one board. Update status from the detail panel to move a card.
            </p>
          </div>
          <Button onClick={() => setPanelTarget('new')} size="sm">
            <Plus size={14} className="mr-1.5" /> Add Job
          </Button>
        </div>

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

        {jobs === null && <p className="text-muted-foreground">Loading…</p>}

        {jobs?.length === 0 && (
          <GlassCard className="text-center">
            <p className="text-muted-foreground mb-2">No job applications yet.</p>
            <p className="text-sm text-muted-foreground mb-4">Add the first one you're tracking to get started.</p>
            <Button onClick={() => setPanelTarget('new')} className="mx-auto">
              <Plus size={14} className="mr-1.5" /> Add Job
            </Button>
          </GlassCard>
        )}

        {jobs !== null && jobs.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {COLUMNS.map((col) => (
                <div key={col.id} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-1">
                    <span className={cn('text-xs font-semibold uppercase tracking-wider', col.accent)}>
                      {col.label}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">{byColumn.grouped[col.id].length}</span>
                  </div>
                  <div className={cn('flex flex-col gap-3 min-h-[80px] rounded-2xl p-2 -m-2', byColumn.grouped[col.id].length === 0 && col.glow)}>
                    <AnimatePresence initial={false}>
                      {byColumn.grouped[col.id].map((job) => (
                        <JobCard key={job.id} job={job} onClick={() => setPanelTarget(job)} />
                      ))}
                    </AnimatePresence>
                    {byColumn.grouped[col.id].length === 0 && (
                      <div className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                        Nothing here
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {byColumn.rejected.length > 0 && (
              <div className="mt-6">
                <button
                  onClick={() => setRejectedOpen((o) => !o)}
                  className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-400 hover:text-rose-300 transition-colors px-1"
                >
                  {rejectedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Rejected &amp; Withdrawn
                  <span className="text-muted-foreground normal-case font-normal tabular-nums">({byColumn.rejected.length})</span>
                </button>
                <AnimatePresence initial={false}>
                  {rejectedOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                        {byColumn.rejected.map((job) => (
                          <JobCard key={job.id} job={job} onClick={() => setPanelTarget(job)} muted />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>

      <JobPanel
        target={panelTarget}
        onClose={() => setPanelTarget(null)}
        onSaved={upsertJob}
        onDelete={handleDelete}
        onError={setError}
      />
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// JobCard
// ---------------------------------------------------------------------------

function JobCard({ job, onClick, muted = false }: { job: JobApplication; onClick: () => void; muted?: boolean }) {
  const meta = STATUS_META[job.status as JobApplicationStatus];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={cn(
        'glass-panel rounded-xl p-4 cursor-pointer border border-border/50 hover:border-indigo-500/40 transition-colors',
        muted && 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
            <Building2 size={14} className="text-indigo-400" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{job.companyName}</p>
            <p className="text-xs text-muted-foreground truncate">{job.jobTitle}</p>
          </div>
        </div>
        <span className={cn('h-2 w-2 rounded-full shrink-0 mt-1.5', meta.dot)} title={meta.label} />
      </div>
      <p className="text-xs text-muted-foreground mt-3">{daysSinceLabel(job.appliedAt)}</p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// JobPanel — slide-over for both "add job" and "edit job", matching this
// app's glass/indigo aesthetic (kept local rather than the WP-styled admin
// SlideOver, which is a different visual language from the rest of the app).
// ---------------------------------------------------------------------------

interface JobFormState {
  companyName: string;
  jobTitle: string;
  jobUrl: string;
  status: JobApplicationStatus;
  notes: string;
  appliedAt: string; // yyyy-mm-dd, or ''
}

function emptyForm(): JobFormState {
  return { companyName: '', jobTitle: '', jobUrl: '', status: 'SAVED', notes: '', appliedAt: '' };
}

function formFromJob(job: JobApplication): JobFormState {
  return {
    companyName: job.companyName,
    jobTitle: job.jobTitle,
    jobUrl: job.jobUrl ?? '',
    status: job.status as JobApplicationStatus,
    notes: job.notes ?? '',
    appliedAt: toDateInputValue(job.appliedAt),
  };
}

function JobPanel({
  target,
  onClose,
  onSaved,
  onDelete,
  onError,
}: {
  target: JobApplication | 'new' | null;
  onClose: () => void;
  onSaved: (job: JobApplication) => void;
  onDelete: (id: string) => void;
  onError: (message: string) => void;
}) {
  const isOpen = target !== null;
  const isEditing = typeof target === 'object' && target !== null;
  const [form, setForm] = useState<JobFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset the form whenever a different job (or "new") is opened.
  useEffect(() => {
    if (target === 'new') setForm(emptyForm());
    else if (target) setForm(formFromJob(target));
    setFormError(null);
  }, [target]);

  // Editing an existing job: changing status alone should save + move the
  // card immediately, without requiring the person to hit "Save changes".
  async function handleStatusChange(nextStatus: JobApplicationStatus) {
    setForm((f) => ({ ...f, status: nextStatus }));
    if (!isEditing || typeof target !== 'object' || !target) return;
    try {
      const { job } = await jobsApi.update(target.id, { status: nextStatus });
      onSaved(job);
    } catch {
      onError('Could not update the status.');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.companyName.trim() || !form.jobTitle.trim()) {
      setFormError('Company name and job title are required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (isEditing && typeof target === 'object' && target) {
        const { job } = await jobsApi.update(target.id, {
          companyName: form.companyName.trim(),
          jobTitle: form.jobTitle.trim(),
          jobUrl: form.jobUrl.trim() || null,
          status: form.status,
          notes: form.notes.trim() || null,
          appliedAt: form.appliedAt ? new Date(form.appliedAt).toISOString() : null,
        });
        onSaved(job);
      } else {
        const { job } = await jobsApi.create({
          companyName: form.companyName.trim(),
          jobTitle: form.jobTitle.trim(),
          jobUrl: form.jobUrl.trim() || undefined,
          status: form.status,
          notes: form.notes.trim() || undefined,
          appliedAt: form.appliedAt ? new Date(form.appliedAt).toISOString() : undefined,
        });
        onSaved(job);
      }
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save this application.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[440px] glass-panel border-l border-border shadow-2xl z-50 flex flex-col"
          >
            <div className="flex items-start justify-between p-6 border-b border-border shrink-0">
              <div>
                <h2 className="text-lg font-bold">{isEditing ? 'Edit Application' : 'Add Job'}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {isEditing ? 'Update any field — status changes save instantly.' : 'Company and job title are required.'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-accent transition-colors shrink-0 ml-4"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <Input
                  label="Company name"
                  required
                  value={form.companyName}
                  onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                  placeholder="Acme Corp"
                />
                <Input
                  label="Job title"
                  required
                  value={form.jobTitle}
                  onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
                  placeholder="Backend Engineer"
                />
                <Input
                  label="Job URL"
                  type="url"
                  value={form.jobUrl}
                  onChange={(e) => setForm((f) => ({ ...f, jobUrl: e.target.value }))}
                  placeholder="https://…"
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => handleStatusChange(e.target.value as JobApplicationStatus)}
                    className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {STATUS_OPTIONS.map(([value, meta]) => (
                      <option key={value} value={value}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Applied on"
                  type="date"
                  value={form.appliedAt}
                  onChange={(e) => setForm((f) => ({ ...f, appliedAt: e.target.value }))}
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={4}
                    placeholder="Referral, interview prep, recruiter contact…"
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                {isEditing && typeof target === 'object' && target?.jobUrl && (
                  <a
                    href={target.jobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    <ExternalLink size={14} /> Open listing
                  </a>
                )}

                {formError && <p className="text-sm text-destructive">{formError}</p>}
              </div>

              <div className="shrink-0 border-t border-border p-4 flex items-center justify-between gap-2">
                {isEditing && typeof target === 'object' && target ? (
                  <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(target.id)}>
                    <Trash2 size={14} className="mr-1.5" /> Delete
                  </Button>
                ) : (
                  <span />
                )}
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add Job'}
                </Button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
