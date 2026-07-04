import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ArrowLeft, Upload, CheckCircle2 } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { ResumePreview } from '../../components/preview/ResumePreview';
import { ImportResumeModal } from '../../components/import/ImportResumeModal';
import { SuggestionCapsules } from '../../components/ai/SuggestionCapsules';
import { aiApi, resumeApi } from '../../lib/api';
import { ApiError } from '../../lib/api';
import type { Resume, Section } from '@careerforge/schema';
import { DEFAULT_THEME, CURRENT_SCHEMA_VERSION, mergeResumeSections } from '@careerforge/schema';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: "Hi! I'm your CareerForge AI. Let's build your resume together. What's your full name?",
};

// ---------------------------------------------------------------------------
// Sample resume — shown in the preview pane from the moment the page loads so
// users immediately see what a finished resume looks like in the selected
// template.  As the AI collects real data it replaces sections one by one;
// sample sections for types not yet covered stay visible so the preview is
// never an empty white box.
// ---------------------------------------------------------------------------
const SAMPLE_RESUME: Resume = {
  id: 'preview',
  ownerId: '',
  title: 'Alex Morgan',
  theme: DEFAULT_THEME,
  schemaVersion: CURRENT_SCHEMA_VERSION,
  migrationVersion: CURRENT_SCHEMA_VERSION,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  sections: [
    {
      id: 'sample-summary',
      type: 'summary',
      title: 'Summary',
      order: 0,
      fields: [{ key: 'text', label: 'Summary', kind: 'richtext', required: true }],
      entries: [
        {
          id: 'sample-summary-entry',
          values: {
            // contact / personal info — read by getPersonalInfo() in templates
            jobTitle: 'Senior Software Engineer',
            email: 'alex.morgan@email.com',
            phone: '+1 (555) 234-5678',
            location: 'San Francisco, CA',
            linkedin: 'linkedin.com/in/alexmorgan',
            website: 'alexmorgan.dev',
            // summary text
            text: 'Full-stack engineer with 7+ years building scalable web products at high-growth companies. Passionate about clean architecture, developer experience, and shipping software that users love.',
          },
        },
      ],
    },
    {
      id: 'sample-experience',
      type: 'experience',
      title: 'Experience',
      order: 1,
      fields: [
        { key: 'title',       label: 'Job Title',    kind: 'text',     required: true  },
        { key: 'company',     label: 'Company',      kind: 'text',     required: true  },
        { key: 'location',    label: 'Location',     kind: 'text',     required: false },
        { key: 'startDate',   label: 'Start Date',   kind: 'date',     required: false },
        { key: 'endDate',     label: 'End Date',     kind: 'date',     required: false },
        { key: 'description', label: 'Description',  kind: 'richtext', required: false },
      ],
      entries: [
        {
          id: 'sample-exp-1',
          values: {
            title: 'Senior Software Engineer',
            company: 'Stripe',
            location: 'San Francisco, CA',
            startDate: '2021-06',
            endDate: '',
            description:
              'Led development of the next-generation payments dashboard serving 2M+ merchants.\nReduced API latency by 40% through query optimisation and caching strategies.\nMentored a team of 4 engineers and introduced a design-system component library.',
          },
        },
        {
          id: 'sample-exp-2',
          values: {
            title: 'Software Engineer',
            company: 'Accenture',
            location: 'New York, NY',
            startDate: '2018-08',
            endDate: '2021-05',
            description:
              'Built microservices architecture for a Fortune 500 retail client.\nDelivered a real-time inventory sync system handling 50k events per second.\nCollaborated closely with product and design to ship 3 major feature releases per quarter.',
          },
        },
      ],
    },
    {
      id: 'sample-education',
      type: 'education',
      title: 'Education',
      order: 2,
      fields: [
        { key: 'degree',    label: 'Degree',     kind: 'text', required: true  },
        { key: 'school',    label: 'School',     kind: 'text', required: true  },
        { key: 'startDate', label: 'Start Date', kind: 'date', required: false },
        { key: 'endDate',   label: 'End Date',   kind: 'date', required: false },
      ],
      entries: [
        {
          id: 'sample-edu-1',
          values: {
            degree: 'B.S. Computer Science',
            school: 'Carnegie Mellon University',
            startDate: '2014-09',
            endDate: '2018-05',
          },
        },
      ],
    },
    {
      id: 'sample-skills',
      type: 'skills',
      title: 'Skills',
      order: 3,
      fields: [{ key: 'name', label: 'Skill', kind: 'text', required: true }],
      entries: [
        { id: 'sample-skill-1', values: { name: 'TypeScript / JavaScript' } },
        { id: 'sample-skill-2', values: { name: 'React & Next.js' } },
        { id: 'sample-skill-3', values: { name: 'Node.js' } },
        { id: 'sample-skill-4', values: { name: 'PostgreSQL' } },
        { id: 'sample-skill-5', values: { name: 'AWS' } },
        { id: 'sample-skill-6', values: { name: 'System Design' } },
      ],
    },
  ],
};

export function AIChatBuilderPage() {
  const { resumeId } = useParams<{ resumeId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  // Start with the sample so the preview is never empty
  const [previewResume, setPreviewResume] = useState<Resume>(SAMPLE_RESUME);
  const [error, setError] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
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
        setPreviewResume((prev) => {
          const next = { ...prev };

          // Update the title (user's real name) if provided
          if (resumeUpdate.title) next.title = resumeUpdate.title;

          // Merge sections: only replace a sample section once the AI has
          // actual entries for that section type. This keeps the sample
          // content visible for sections the user hasn't covered yet, so
          // the preview always looks like a complete resume. Uses the same
          // by-type merge policy the API applies when persisting to a saved
          // resume (see mergeResumeSections) — one canonical definition of
          // "how does a RESUME_UPDATE combine with what's already there"
          // instead of two independently-maintained copies.
          next.sections = mergeResumeSections(prev.sections, resumeUpdate.sections);

          return next;
        });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSending(false);
    }
  }

  function handleImported(extracted: { title?: string; sections?: Section[] }) {
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

  // ---------------------------------------------------------------------
  // "Continue to editor" — the chat has no natural end state (the AI just
  // keeps asking follow-up questions), so without an explicit exit here
  // there was no way to leave /resumes/new/chat: no save, no manual-edit
  // screen, no download, no template switch. This persists whatever is
  // currently in the live preview (title/theme/sections — real AI-filled
  // content merged with any untouched sample sections) and routes into the
  // full resume editor, where all of that becomes editable.
  // ---------------------------------------------------------------------
  async function handleFinish() {
    if (isFinishing) return;
    setIsFinishing(true);
    setError(null);
    try {
      let targetId = resumeId;
      if (!targetId) {
        const { resume } = await resumeApi.create({
          title: previewResume.title?.trim() || 'Untitled Resume',
        });
        targetId = resume.id;
      }
      await resumeApi.update(targetId, {
        title: previewResume.title,
        theme: previewResume.theme,
        sections: previewResume.sections,
      });
      navigate(`/resumes/${targetId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your resume. Please try again.');
      setIsFinishing(false);
    }
  }

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
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setImportModalOpen(true)}>
                <Upload size={14} className="mr-1.5" />
                Import
              </Button>
              <Button size="sm" onClick={handleFinish} disabled={isFinishing}>
                <CheckCircle2 size={14} className="mr-1.5" />
                {isFinishing ? 'Saving…' : 'Continue to Editor'}
              </Button>
            </div>
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
          {/* Ambient glow */}
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div
              style={{
                width: 560,
                height: 560,
                background: 'radial-gradient(circle, rgba(99,102,241,0.13) 0%, transparent 70%)',
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

          {/* Preview — always visible, starts as sample, fills in live */}
          <div className="relative z-10 flex-1 flex items-center justify-center overflow-auto p-8">
            <motion.div
              className="flex flex-col items-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              {/* Browser-chrome strip */}
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

              <p className="mt-3 text-[10px] text-white/20 tracking-wide">
                Updates as you chat · Sample data shown until you add yours
              </p>
            </motion.div>
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