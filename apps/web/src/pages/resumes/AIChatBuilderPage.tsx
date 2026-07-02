import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ArrowLeft, Upload, FileText } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { ResumePreview } from '../../components/preview/ResumePreview';
import { ImportResumeModal } from '../../components/import/ImportResumeModal';
import { SuggestionCapsules } from '../../components/ai/SuggestionCapsules';
import { aiApi, resumeApi } from '../../lib/api';
import { ApiError } from '../../lib/api';
import type { Resume, Section } from '@careerforge/schema';
import { buildDefaultSections, DEFAULT_THEME, CURRENT_SCHEMA_VERSION } from '@careerforge/schema';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: "Hi! I'm your CareerForge AI. Let's build your resume together. What's your full name?",
};

const EMPTY_RESUME: Resume = {
  id: 'preview',
  ownerId: '',
  title: 'Your Name',
  theme: DEFAULT_THEME,
  sections: buildDefaultSections(),
  schemaVersion: CURRENT_SCHEMA_VERSION,
  migrationVersion: CURRENT_SCHEMA_VERSION,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Skeleton shown before the AI has populated any resume content
function EmptyPreviewState() {
  return (
    <div className="flex flex-col items-center gap-8">
      {/* Mini resume skeleton */}
      <div
        className="relative overflow-hidden rounded-lg border border-white/10"
        style={{
          width: 200,
          height: 280,
          background: 'rgba(255,255,255,0.03)',
          boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header block */}
        <div
          style={{
            height: 72,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.35) 0%, rgba(139,92,246,0.2) 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}
          className="flex flex-col justify-center px-4 gap-1.5"
        >
          <div className="h-3 w-24 rounded-sm bg-white/20" />
          <div className="h-2 w-16 rounded-sm bg-white/10" />
        </div>

        {/* Body lines */}
        <div className="p-4 flex flex-col gap-2">
          <div className="h-1.5 w-16 rounded-sm bg-indigo-400/30 mb-1" />
          <div className="h-1.5 w-full rounded-sm bg-white/10" />
          <div className="h-1.5 w-5/6 rounded-sm bg-white/10" />
          <div className="h-1.5 w-4/5 rounded-sm bg-white/8" />

          <div className="h-1.5 w-16 rounded-sm bg-indigo-400/30 mt-2 mb-1" />
          <div className="h-1.5 w-full rounded-sm bg-white/10" />
          <div className="h-1.5 w-3/4 rounded-sm bg-white/10" />
          <div className="h-1.5 w-5/6 rounded-sm bg-white/8" />

          <div className="h-1.5 w-16 rounded-sm bg-indigo-400/30 mt-2 mb-1" />
          <div className="h-1.5 w-full rounded-sm bg-white/10" />
          <div className="h-1.5 w-2/3 rounded-sm bg-white/10" />
        </div>

        {/* Shimmer sweep */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)',
          }}
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.6, ease: 'linear' }}
        />
      </div>

      {/* Label */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <FileText size={14} className="text-indigo-400/60" />
          <span className="text-sm font-medium text-white/40">Your resume takes shape here</span>
        </div>
        <p className="text-xs text-white/20 max-w-[200px] leading-relaxed">
          Answer the questions on the left and watch it fill in live
        </p>
      </div>
    </div>
  );
}

export function AIChatBuilderPage() {
  const { resumeId } = useParams<{ resumeId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [previewResume, setPreviewResume] = useState<Resume>(EMPTY_RESUME);
  const [error, setError] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  // Track whether the AI has pushed any real content yet so we know when
  // to swap from the skeleton state to the live preview.
  const [hasAiContent, setHasAiContent] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  // Load existing resume if resumeId provided
  useEffect(() => {
    if (!resumeId) return;
    resumeApi.get(resumeId).then(({ resume }) => {
      setPreviewResume(resume as unknown as Resume);
      setHasAiContent(true);
    }).catch(() => undefined);
  }, [resumeId]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsSending(true);
    setError(null);

    try {
      const result = await aiApi.chat(
        newMessages.map((m) => ({ role: m.role, content: m.content })),
        resumeId,
      );

      setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);
      setSuggestions(result.suggestions ?? []);

      const resumeUpdate = result.resumeUpdate;
      if (resumeUpdate) {
        setHasAiContent(true);
        setPreviewResume((prev) => ({
          ...prev,
          ...(resumeUpdate.title ? { title: resumeUpdate.title } : {}),
          ...(resumeUpdate.sections ? { sections: resumeUpdate.sections } : {}),
        }));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSending(false);
    }
  }

  function handleImported(extracted: { title?: string; sections?: Section[] }) {
    setHasAiContent(true);
    setPreviewResume((prev) => ({
      ...prev,
      ...(extracted.title ? { title: extracted.title } : {}),
      ...(extracted.sections ? { sections: extracted.sections } : {}),
    }));
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content:
          "I've pulled in your resume — take a look at the preview. Tell me what you'd like to change or add, and we'll refine it together.",
      },
    ]);
  }

  // Template display name from theme
  const templateLabel =
    (previewResume.theme as { templateId?: string })?.templateId === 'classic'
      ? 'Classic'
      : 'Modern';

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-0px)] overflow-hidden">
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
            <Button variant="outline" size="sm" onClick={() => setImportModalOpen(true)} className="shrink-0">
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
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
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

            {error && (
              <p className="text-xs text-destructive text-center">{error}</p>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestion quick-replies */}
          <div className="px-4 pb-2">
            <SuggestionCapsules
              suggestions={suggestions}
              onSelect={(s) => { setSuggestions([]); setInput(s); }}
              disabled={isSending}
            />
          </div>

          {/* Input */}
          <form onSubmit={(e) => { setSuggestions([]); handleSend(e); }} className="p-4 border-t border-border flex gap-2">
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

        {/* ---------------------------------------------------------------- */}
        {/* Right: Live Preview                                               */}
        {/* ---------------------------------------------------------------- */}
        <div
          className="hidden lg:flex flex-1 flex-col overflow-hidden relative"
          style={{
            background: '#0b0b10',
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(139,92,246,0.07) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        >
          {/* Ambient purple glow centred behind the resume */}
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div
              style={{
                width: 560,
                height: 560,
                background:
                  'radial-gradient(circle, rgba(99,102,241,0.13) 0%, transparent 70%)',
                filter: 'blur(48px)',
              }}
            />
          </div>

          {/* Top bar */}
          <div className="relative z-10 flex items-center justify-between px-6 py-3 border-b border-white/5">
            <span className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em]">
              Live Preview
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/25 bg-white/5 border border-white/8 rounded px-2 py-0.5">
                {templateLabel}
              </span>
              <span className="text-[10px] text-white/25 bg-white/5 border border-white/8 rounded px-2 py-0.5">
                A4
              </span>
            </div>
          </div>

          {/* Content area */}
          <div className="relative z-10 flex-1 flex items-center justify-center overflow-auto p-8">
            <AnimatePresence mode="wait">
              {hasAiContent ? (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="flex flex-col items-center"
                >
                  {/* Browser-chrome strip above the resume */}
                  <div
                    className="self-stretch flex items-center gap-1.5 px-3 py-2 rounded-t-lg border border-white/10 border-b-0"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
                    <span className="text-[10px] text-white/25 ml-auto mr-auto truncate">
                      {previewResume.title}
                    </span>
                  </div>

                  <ResumePreview resume={previewResume} scale={0.55} />

                  {/* Footer badge */}
                  <p className="mt-3 text-[10px] text-white/20 tracking-wide">
                    Updates as you chat
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  <EmptyPreviewState />
                </motion.div>
              )}
            </AnimatePresence>
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