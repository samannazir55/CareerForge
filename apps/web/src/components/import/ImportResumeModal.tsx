import { useCallback, useRef, useState, type DragEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, X, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { useResumeFileParser } from '../../hooks/useResumeFileParser';
import { aiApi, ApiError } from '../../lib/api';
import type { Section } from '@careerforge/schema';

interface ImportResumeModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with whatever the AI managed to extract. Either field may be
   * absent if extraction was partial — the caller decides how to merge it
   * into the working resume. */
  onImported: (extracted: { title?: string; sections?: Section[] }) => void;
}

type Stage = 'idle' | 'extracting' | 'analyzing' | 'error';

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.txt';

/**
 * The previously-missing piece of the resume import flow. The backend
 * /api/ai/import endpoint and the underlying AI provider method already
 * existed and worked — there was simply no UI in the app that produced
 * a `rawText` string from a file and called it. This modal is that UI:
 * drag-and-drop or browse, extract text from PDF/DOCX/TXT client-side
 * (useResumeFileParser), then hand the text to the existing endpoint.
 */
export function ImportResumeModal({ open, onClose, onImported }: ImportResumeModalProps) {
  const { status: parseStatus, error: parseError, parseFile, reset: resetParser } = useResumeFileParser();
  const [stage, setStage] = useState<Stage>('idle');
  const [apiError, setApiError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    setStage('idle');
    setApiError(null);
    setFileName(null);
    resetParser();
    onClose();
  }, [onClose, resetParser]);

  const handleFile = useCallback(
    async (file: File) => {
      setFileName(file.name);
      setApiError(null);
      setStage('extracting');

      const text = await parseFile(file);
      if (!text) {
        setStage('error');
        return;
      }

      setStage('analyzing');
      try {
        const { extracted } = await aiApi.importResume(text);
        onImported(extracted);
        handleClose();
      } catch (err) {
        setApiError(err instanceof ApiError ? err.message : 'Could not analyze this resume. Please try again.');
        setStage('error');
      }
    },
    [parseFile, onImported, handleClose],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const isBusy = stage === 'extracting' || stage === 'analyzing';
  const displayError = parseError ?? apiError;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={isBusy ? undefined : handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md glass-panel rounded-3xl overflow-hidden shadow-2xl p-8"
          >
            {!isBusy && (
              <button
                onClick={handleClose}
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
              <h3 className="text-xl font-bold mb-1">Import your resume</h3>
              <p className="text-sm text-muted-foreground">
                Upload a PDF, DOCX, or TXT file — AI extracts your experience, education, and skills automatically.
              </p>
            </div>

            {stage === 'idle' && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/30'
                }`}
              >
                <Upload size={28} className="mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">Drop your resume here</p>
                <p className="text-xs text-muted-foreground">or click to browse — PDF, DOCX, or TXT</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
              </div>
            )}

            {isBusy && (
              <div className="rounded-2xl border border-border p-8 text-center">
                <Loader2 size={28} className="mx-auto mb-3 text-primary animate-spin" />
                <p className="text-sm font-medium mb-1">
                  {stage === 'extracting' ? 'Reading your file…' : 'AI is analyzing your resume…'}
                </p>
                {fileName && (
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 mt-2">
                    <FileText size={12} /> {fileName}
                  </p>
                )}
              </div>
            )}

            {stage === 'error' && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
                <AlertCircle size={24} className="mx-auto mb-3 text-destructive" />
                <p className="text-sm text-destructive mb-4">{displayError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStage('idle');
                    setApiError(null);
                    setFileName(null);
                    resetParser();
                  }}
                >
                  Try a different file
                </Button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
