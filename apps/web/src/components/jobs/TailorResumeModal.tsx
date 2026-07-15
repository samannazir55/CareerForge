import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Loader2, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import type { ResumeSummary } from '@careerforge/schema';
import { resumeApi, aiApi, ApiError } from '../../lib/api';
import { Button } from '../ui/Button';

interface TailorResumeModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-filled into the (editable) job description textarea — the
   * listing's description on Find Jobs, or the application's notes on the
   * Job Tracker. Empty string is fine; the person can always type/paste
   * one in before tailoring. */
  initialJobDescription: string;
  /** Short "Backend Engineer at Acme Corp" style line shown in the header
   * for context. Optional since not every caller has both fields handy. */
  jobContext?: string;
}

type Stage = 'form' | 'loading' | 'success' | 'error';

/**
 * Closes the "find it → track it → tailor for it" loop: pick which of the
 * user's resumes to adapt, confirm/edit the job description, and hand both
 * to POST /api/ai/tailor-resume. That endpoint never overwrites the
 * original resume — it always returns a new resume id — so this modal's
 * success state is a link to the new copy, not a mutation of anything the
 * person already had open.
 */
export function TailorResumeModal({ open, onClose, initialJobDescription, jobContext }: TailorResumeModalProps) {
  const [resumes, setResumes] = useState<ResumeSummary[] | null>(null);
  const [resumesError, setResumesError] = useState<string | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [jobDescription, setJobDescription] = useState(initialJobDescription);
  const [stage, setStage] = useState<Stage>('form');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ resumeId: string; matchScore: number; suggestions: string[] } | null>(null);

  // Re-seed everything each time the modal opens fresh, and fetch the
  // resume list right away — no point waiting for the person to notice
  // the dropdown is empty.
  useEffect(() => {
    if (!open) return;
    setStage('form');
    setError(null);
    setResult(null);
    setJobDescription(initialJobDescription);
    setResumes(null);
    setResumesError(null);
    resumeApi
      .list()
      .then((data) => {
        setResumes(data.resumes);
        setSelectedResumeId((prev) => prev || data.resumes[0]?.id || '');
      })
      .catch(() => setResumesError('Could not load your resumes.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleTailor() {
    if (!selectedResumeId) {
      setError('Choose a resume to tailor.');
      return;
    }
    if (!jobDescription.trim()) {
      setError('Paste in the job description first.');
      return;
    }
    setStage('loading');
    setError(null);
    try {
      const data = await aiApi.tailorResume(selectedResumeId, jobDescription.trim());
      setResult(data);
      setStage('success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not tailor this resume right now. Please try again.');
      setStage('error');
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={stage === 'loading' ? undefined : onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg glass-panel rounded-3xl overflow-hidden shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
          >
            {stage !== 'loading' && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 h-8 w-8 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            )}

            <div className="text-center mb-6">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 flex items-center justify-center mx-auto mb-4">
                <Sparkles size={22} className="text-indigo-500" />
              </div>
              <h3 className="text-xl font-bold mb-1">Tailor Resume for this Job</h3>
              <p className="text-sm text-muted-foreground">
                {jobContext ?? 'AI rewrites your summary and experience bullets to match this role — as a new resume, your original stays untouched.'}
              </p>
            </div>

            {(stage === 'form' || stage === 'loading') && (
              <div className="space-y-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Resume to tailor</label>
                  {resumesError && <p className="text-sm text-destructive">{resumesError}</p>}
                  {resumes?.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      You don't have any resumes yet.{' '}
                      <Link to="/resumes" className="text-indigo-400 hover:text-indigo-300 underline">
                        Create one first
                      </Link>
                      .
                    </p>
                  )}
                  {resumes && resumes.length > 0 && (
                    <select
                      value={selectedResumeId}
                      onChange={(e) => setSelectedResumeId(e.target.value)}
                      disabled={stage === 'loading'}
                      className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      {resumes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title}
                        </option>
                      ))}
                    </select>
                  )}
                  {resumes === null && !resumesError && <p className="text-sm text-muted-foreground">Loading your resumes…</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Job description</label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    rows={7}
                    disabled={stage === 'loading'}
                    placeholder="Paste the job description here…"
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  onClick={handleTailor}
                  disabled={stage === 'loading' || resumes?.length === 0}
                  className="w-full"
                >
                  {stage === 'loading' ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-1.5" /> Tailoring your resume…
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} className="mr-1.5" /> Tailor with AI
                    </>
                  )}
                </Button>
              </div>
            )}

            {stage === 'error' && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
                <AlertCircle size={24} className="mx-auto mb-3 text-destructive" />
                <p className="text-sm text-destructive mb-4">{error}</p>
                <Button variant="outline" size="sm" onClick={() => setStage('form')}>
                  Try again
                </Button>
              </div>
            )}

            {stage === 'success' && result && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
                <CheckCircle2 size={28} className="mx-auto mb-3 text-emerald-400" />
                <p className="font-semibold mb-1">Tailored resume created!</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Match score: <span className="font-medium text-foreground">{result.matchScore}%</span>
                </p>
                {result.suggestions.length > 0 && (
                  <ul className="text-left text-sm text-muted-foreground space-y-1.5 mb-5 list-disc list-inside">
                    {result.suggestions.slice(0, 4).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
                <Link to={`/resumes/${result.resumeId}`}>
                  <Button size="sm" className="w-full">
                    View tailored resume <ArrowRight size={14} className="ml-1.5" />
                  </Button>
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
