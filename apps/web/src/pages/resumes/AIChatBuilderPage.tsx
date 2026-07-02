import { useState, useRef, useEffect, useCallback, type FormEvent, type ChangeEvent } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ArrowLeft, Upload } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { ResumePreview } from '../../components/preview/ResumePreview';
import { ImportResumeModal } from '../../components/import/ImportResumeModal';
import { SuggestionCapsules } from '../../components/ai/SuggestionCapsules';
import { aiApi, resumeApi, ApiError } from '../../lib/api';
import type { Resume, Section } from '@careerforge/schema';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: "Hi! I'm your CareerForge AI. Let's build your resume together. What's your full name?",
};

/**
 * AI Chat Resume Builder.
 *
 * Preview fix: the old code kept previewResume as EMPTY_RESUME (id='preview')
 * when entering via /resumes/new/chat. ResumePreview gated on id==='preview'
 * and showed "Start typing" forever. Fix: create a real DB resume immediately
 * on mount when no resumeId exists, then navigate to /resumes/:id/chat so
 * the component re-mounts with a real id. The preview fetches from the API
 * using that id and renders correctly as soon as the AI updates the resume.
 */
export function AIChatBuilderPage() {
  const { resumeId } = useParams<{ resumeId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [previewResume, setPreviewResume] = useState<Resume | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isCreatingResume, setIsCreatingResume] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Ensure we always have a real resumeId with a DB row.
  // /resumes/new/chat → create resume → redirect to /resumes/:id/chat
  // /resumes/:id/chat → load resume into preview state
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (resumeId) {
      resumeApi
        .get(resumeId)
        .then(({ resume }) => setPreviewResume(resume as unknown as Resume))
        .catch(() => undefined);
      return;
    }

    setIsCreatingResume(true);
    resumeApi
      .create({ title: 'My Resume' })
      .then(({ resume }) => {
        navigate(`/resumes/${resume.id}/chat`, { replace: true });
      })
      .catch(() => {
        setIsCreatingResume(false);
        setError('Could not start a new resume. Please try again.');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (searchParams.get('import') === 'true') {
      setImportModalOpen(true);
      searchParams.delete('import');
      setSearchParams(searchParams, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------
  const handleSend = useCallback(
    async (e: FormEvent, overrideText?: string) => {
      e.preventDefault();
      const text = (overrideText ?? input).trim();
      if (!text || isSending) return;

      const userMessage: ChatMessage = { role: 'user', content: text };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInput('');
      setIsSending(true);
      setError(null);
      setSuggestions([]);

      try {
        const result = await aiApi.chat(
          newMessages.map((m) => ({ role: m.role, content: m.content })),
          resumeId,
        );

        setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);
        setSuggestions(result.suggestions ?? []);

        // AI persisted the update to the DB (in ai.routes.ts) before sending
        // this response. Updating previewResume triggers ResumePreview to
        // re-fetch the rendered HTML from the server — it sees the new content.
        const resumeUpdate = result.resumeUpdate;
        if (resumeUpdate && previewResume) {
          setPreviewResume((prev) =>
            prev
              ? {
                  ...prev,
                  ...(resumeUpdate.title ? { title: resumeUpdate.title } : {}),
                  ...(resumeUpdate.sections ? { sections: resumeUpdate.sections } : {}),
                }
              : prev,
          );
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      } finally {
        setIsSending(false);
      }
    },
    [input, isSending, messages, resumeId, previewResume],
  );

  function handleImported(extracted: { title?: string; sections?: Section[] }) {
    setSuggestions([]);
    setPreviewResume((prev) =>
      prev
        ? {
            ...prev,
            ...(extracted.title ? { title: extracted.title } : {}),
            ...(extracted.sections ? { sections: extracted.sections } : {}),
          }
        : prev,
    );
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content:
          "I've pulled in your resume — take a look at the preview. Tell me what you'd like to change or add, and we'll refine it together.",
      },
    ]);
  }

  // ---------------------------------------------------------------------------
  // Show loader while creating the resume row
  // ---------------------------------------------------------------------------
  if (isCreatingResume || (!resumeId && !error)) {
    return (
      <AppShell>
        <div className="flex h-[calc(100vh-64px)] items-center justify-center">
          <div className="text-center space-y-3">
            <div className="flex gap-1 justify-center">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">Setting up your resume…</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-64px)] overflow-hidden">
        {/* Left: Chat Panel */}
        <div className="flex flex-col w-full lg:w-[420px] border-r border-border shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft size={18} />
              </Button>
              <div className="min-w-0">
                <h2 className="font-semibold text-sm">AI Resume Builder</h2>
                <p className="text-xs text-muted-foreground">Chat to build your resume</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportModalOpen(true)}
              className="shrink-0"
            >
              <Upload size={14} className="mr-1.5" />
              Import
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isSending && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {error && <p className="text-xs text-destructive text-center">{error}</p>}
            <div ref={bottomRef} />
          </div>

          {/* Suggestion capsules */}
          <div className="px-4 pb-2">
            <SuggestionCapsules
              suggestions={suggestions}
              onSelect={(s) => {
                setSuggestions([]);
                handleSend({ preventDefault: () => undefined } as FormEvent, s);
              }}
              disabled={isSending}
            />
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { setSuggestions([]); handleSend(e); }}
            className="p-4 border-t border-border flex gap-2"
          >
            <input
              value={input}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
              placeholder="Type your answer…"
              disabled={isSending}
              className="flex-1 h-11 rounded-xl border border-input bg-background px-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
            <Button type="submit" size="icon" disabled={isSending || !input.trim()}>
              <Send size={16} />
            </Button>
          </form>
        </div>

        {/* Right: Live Preview */}
        <div className="hidden lg:flex flex-1 items-center justify-center bg-muted/30 overflow-auto p-8">
          <div className="flex flex-col items-center gap-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Live Preview
            </p>
            {previewResume ? (
              <ResumePreview resume={previewResume} scale={0.55} />
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
                <p className="text-xs">Loading preview…</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ImportResumeModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={handleImported}
      />
    </AppShell>
  );
}
