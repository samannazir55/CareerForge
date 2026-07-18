import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, X, Loader2, AlertCircle, CheckCircle2, Copy, Download, Check } from 'lucide-react';
import type { ResumeSummary } from '@careerforge/schema';
import { resumeApi, aiApi, ApiError } from '../../lib/api';
import { Button } from '../ui/Button';

interface CoverLetterModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-filled into the (editable) job description textarea — the
   * listing's description on Find Jobs, or the application's notes on the
   * Job Tracker. Empty string is fine; the person can always type/paste
   * one in before generating. */
  initialJobDescription: string;
  /** Short "Backend Engineer at Acme Corp" style line shown in the header
   * for context. Optional since not every caller has both fields handy. */
  jobContext?: string;
}

type Stage = 'form' | 'loading' | 'success' | 'error';

const TONES: { value: string; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'enthusiastic', label: 'Enthusiastic' },
  { value: 'formal', label: 'Formal' },
  { value: 'conversational', label: 'Conversational' },
];

/**
 * POST /api/ai/cover-letter has existed on the backend (and in the aiApi
 * client) since the AI domain was built, but had no UI entry point — this
 * is that entry point. Mirrors TailorResumeModal's shape (resume picker +
 * editable job description) since both modals answer "which resume, for
 * which job", but the result here is inline text to read/copy/download
 * rather than a link to a newly created resume.
 */
export function CoverLetterModal({ open, onClose, initialJobDescription, jobContext }: CoverLetterModalProps) {
  const [resumes, setResumes] = useState<ResumeSummary[] | null>(null);
  const [resumesError, setResumesError] = useState<string | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [jobDescription, setJobDescription] = useState(initialJobDescription);
  const [tone, setTone] = useState('professional');
  const [stage, setStage] = useState<Stage>('form');
  const [error, setError] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Re-seed everything each time the modal opens fresh, and fetch the
  // resume list right away — no point waiting for the person to notice
  // the dropdown is empty.
  useEffect(() => {
    if (!open) return;
    setStage('form');
    setError(null);
    setCoverLetter(null);
    setCopied(false);
    setJobDescription(initialJobDescription);
    setTone('professional');
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

  async function handleGenerate() {
    if (!selectedResumeId) {
      setError('Choose a resume to base the letter on.');
      return;
    }
    if (!jobDescription.trim()) {
      setError('Paste in the job description first.');
      return;
    }
    setStage('loading');
    setError(null);
    try {
      const data = await aiApi.generateCoverLetter(selectedResumeId, jobDescription.trim(), tone);
      setCoverLetter(data.coverLetter);
      setStage('success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate a cover letter right now. Please try again.');
      setStage('error');
    }
  }

  async function handleCopy() {
    if (!coverLetter) return;
    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission can be denied — the text is still visible
      // and selectable in the box, so this fails silently.
    }
  }

  function handleDownload() {
    if (!coverLetter) return;
    const blob = new Blob([coverLetter], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cover-letter.txt';
    a.click();
    URL.revokeObjectURL(url);
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
                <FileText size={22} className="text-indigo-500" />
              </div>
              <h3 className="text-xl font-bold mb-1">Generate Cover Letter</h3>
              <p className="text-sm text-muted-foreground">
                {jobContext ?? 'AI writes a cover letter grounded in your actual resume — nothing is fabricated.'}
              </p>
            </div>

            {(stage === 'form' || stage === 'loading') && (
              <div className="space-y-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Resume to base it on</label>
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
                    rows={6}
                    disabled={stage === 'loading'}
                    placeholder="Paste the job description here…"
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    disabled={stage === 'loading'}
                    className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    {TONES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  onClick={handleGenerate}
                  disabled={stage === 'loading' || resumes?.length === 0}
                  className="w-full"
                >
                  {stage === 'loading' ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-1.5" /> Writing your cover letter…
                    </>
                  ) : (
                    <>
                      <FileText size={16} className="mr-1.5" /> Generate with AI
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

            {stage === 'success' && coverLetter && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                  <CheckCircle2 size={16} /> Cover letter ready
                </div>
                <div className="rounded-2xl border border-border/50 bg-background/60 p-4 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                  {coverLetter}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={handleCopy} className="flex-1">
                    {copied ? (
                      <>
                        <Check size={14} className="mr-1.5" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={14} className="mr-1.5" /> Copy text
                      </>
                    )}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleDownload} className="flex-1">
                    <Download size={14} className="mr-1.5" /> Download .txt
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={() => setStage('form')} className="w-full">
                  Generate another
                </Button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}