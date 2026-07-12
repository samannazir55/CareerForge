import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ArrowLeft, Upload, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { ResumePreview } from '../../components/preview/ResumePreview';
import { ImportResumeModal } from '../../components/import/ImportResumeModal';
import { SuggestionCapsules } from '../../components/ai/SuggestionCapsules';
import { aiApi, resumeApi, templatesApi } from '../../lib/api';
import { ApiError } from '../../lib/api';
import type { Resume, Section, PublicTemplateListItem } from '@careerforge/schema';
import { DEFAULT_THEME, CURRENT_SCHEMA_VERSION, mergeResumeSections, ensureCanonicalSectionFields, ensureSummaryEntry, inferNameFieldsFromTitle } from '@careerforge/schema';

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
//
// IMPORTANT: every id below is a real (hardcoded, static) UUID, not a
// readable placeholder string like 'sample-summary'. SectionSchema and
// EntrySchema both require `id: z.string().uuid()` — and because this
// design deliberately lets un-replaced sample sections flow straight into
// the real save payload (that's the whole point: the preview never looks
// empty), a non-UUID placeholder id here would make PATCH /resumes/:id
// reject the entire request the moment a user tries to save/continue while
// even one section type hasn't been covered by the conversation yet. That
// was happening silently for exactly that reason before these were UUIDs.
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
  chatMessages: [],
  sections: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      type: 'summary',
      title: 'Summary',
      order: 0,
      fields: [{ key: 'text', label: 'Summary', kind: 'richtext', required: true }],
      entries: [
        {
          id: '00000000-0000-4000-8000-000000000002',
          values: {
            // contact / personal info — read by getPersonalInfo() in templates
            firstName: 'Alex',
            lastName: 'Morgan',
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
      id: '00000000-0000-4000-8000-000000000003',
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
          id: '00000000-0000-4000-8000-000000000004',
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
          id: '00000000-0000-4000-8000-000000000005',
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
      id: '00000000-0000-4000-8000-000000000006',
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
          id: '00000000-0000-4000-8000-000000000007',
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
      id: '00000000-0000-4000-8000-000000000008',
      type: 'skills',
      title: 'Skills',
      order: 3,
      fields: [{ key: 'name', label: 'Skill', kind: 'text', required: true }],
      entries: [
        { id: '00000000-0000-4000-8000-000000000009', values: { name: 'TypeScript / JavaScript' } },
        { id: '00000000-0000-4000-8000-00000000000a', values: { name: 'React & Next.js' } },
        { id: '00000000-0000-4000-8000-00000000000b', values: { name: 'Node.js' } },
        { id: '00000000-0000-4000-8000-00000000000c', values: { name: 'PostgreSQL' } },
        { id: '00000000-0000-4000-8000-00000000000d', values: { name: 'AWS' } },
        { id: '00000000-0000-4000-8000-00000000000e', values: { name: 'System Design' } },
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
  // Remembers a resume created by handleFinish when starting from a brand
  // new chat (no resumeId in the URL). Without this, retrying "Continue to
  // Editor" after the update() call fails would call resumeApi.create()
  // again on every attempt — resumeId itself comes from the URL and never
  // changes mid-session, so nothing else would signal "we already made one."
  // Each failed retry was silently leaving behind another empty, orphaned
  // "Untitled Resume" row in the database.
  const [createdResumeId, setCreatedResumeId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // The live preview panel further down is `hidden` below the `lg`
  // breakpoint (it's designed as a side-by-side desktop layout), which
  // previously left mobile with no way to see the preview at all. This
  // drives a togglable mobile-only version of that same panel.
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  // Selectable templates for the switcher below — code-registered (modern/
  // classic) plus any active admin-created dynamic templates. Falls back to
  // just modern/classic (matching the previous hardcoded behavior) if the
  // fetch fails, so a flaky request never leaves the switcher empty.
  const [availableTemplates, setAvailableTemplates] = useState<PublicTemplateListItem[]>([
    { id: 'modern', slug: 'modern', name: 'Modern', category: 'free', family: 'modern', pointsCost: 0, thumbnailUrl: null, displayOrder: 0, isDynamic: false },
    { id: 'classic', slug: 'classic', name: 'Classic', category: 'free', family: 'classic', pointsCost: 0, thumbnailUrl: null, displayOrder: 1, isDynamic: false },
  ]);
  useEffect(() => {
    templatesApi
      .list()
      .then((data) => setAvailableTemplates(data.templates))
      .catch(() => {
        /* keep the modern/classic fallback above */
      });
  }, []);

  // Preserves the option this page's own "New Resume" dashboard button used
  // to provide directly (create a blank resume, go straight to the manual
  // editor) — that button now goes through this AI chat flow by default
  // instead, since it was the app's main entry point and having it skip the
  // AI builder entirely made the AI builder hard to find at all. This isn't
  // about removing manual entry as an option, only about making the AI flow
  // the default path rather than the hidden one.
  const [isStartingFromScratch, setIsStartingFromScratch] = useState(false);
  async function handleStartFromScratch() {
    setIsStartingFromScratch(true);
    try {
      const { resume } = await resumeApi.create({ title: 'My Resume' });
      navigate(`/resumes/${resume.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create a new resume. Please try again.');
      setIsStartingFromScratch(false);
    }
  }

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

  // Load existing resume if resumeId provided — this now actually runs
  // (previously the route defined its param as :id while this component
  // read useParams<{resumeId}>(), so resumeId was always undefined here and
  // this effect never fired at all). Restores the chat transcript alongside
  // the resume data, so navigating back to /resumes/:resumeId/chat picks up
  // the actual conversation instead of always starting from the greeting.
  useEffect(() => {
    if (!resumeId) return;
    resumeApi.get(resumeId).then(({ resume }) => {
      const canonicalSections = ensureCanonicalSectionFields(resume.sections);
      const sectionsWithSummaryEntry = ensureSummaryEntry(canonicalSections);
      setPreviewResume({
        ...(resume as unknown as Resume),
        sections: inferNameFieldsFromTitle(sectionsWithSummaryEntry, resume.title),
      });
      const saved = (resume as unknown as { chatMessages?: ChatMessage[] }).chatMessages;
      if (saved && saved.length > 0) setMessages(saved);
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
    // Defense-in-depth: the backend now rejects a genuinely-empty extraction
    // before it ever reaches here (see /resumes/... ai.routes.ts /import),
    // but this check costs nothing and means a future regression in that
    // validation fails visibly instead of silently claiming success with an
    // unchanged, still-sample preview — which is exactly the bug this closes.
    const hasUsableContent =
      (typeof extracted.title === 'string' && extracted.title.trim().length > 1) ||
      (extracted.sections?.some((s) => (s.entries?.length ?? 0) > 0) ?? false);

    if (!hasUsableContent) {
      setError("Couldn't extract details from that file — try pasting the text directly, or fill in your details manually.");
      return;
    }

    setPreviewResume((prev) => ({
      ...prev,
      ...(extracted.title ? { title: extracted.title } : {}),
      // Merge by type rather than replacing the array outright, so any
      // section the import didn't cover keeps showing its sample content
      // instead of disappearing — same policy used everywhere else a
      // partial AI-sourced update meets the working resume.
      ...(extracted.sections ? { sections: mergeResumeSections(prev.sections, extracted.sections) } : {}),
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
      let targetId = resumeId ?? createdResumeId;
      if (!targetId) {
        const { resume } = await resumeApi.create({
          title: previewResume.title?.trim() || 'Untitled Resume',
        });
        targetId = resume.id;
        setCreatedResumeId(targetId);
      }
      await resumeApi.update(targetId, {
        title: previewResume.title,
        theme: previewResume.theme,
        sections: previewResume.sections,
        chatMessages: messages,
      });
      navigate(`/resumes/${targetId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your resume. Please try again.');
      setIsFinishing(false);
    }
  }

  const currentTemplateId = (previewResume.theme as { templateId?: string })?.templateId ?? 'modern';

  // Switching templates here is deliberately ungated — premium/points gating
  // only applies at export time (see export.service.ts's assertCanExport),
  // consistent with how modern/classic switching always worked: anyone can
  // preview any template, but downloading a premium one requires owning it.
  // ResumePreview already re-renders on any resume.theme.templateId change
  // (it's in that component's effect dependency array), so updating this
  // state alone is enough to get a real-time preview switch — no new
  // plumbing needed beyond the state update itself.
  function setTemplate(templateId: string) {
    setPreviewResume((prev) => ({ ...prev, theme: { ...prev.theme, templateId } }));
  }

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-0px)] overflow-hidden">
        {/* Left: Chat Panel */}
        <div className="flex flex-col w-full lg:w-[420px] border-r border-border shrink-0">
          {/* Header */}
          <div className="flex flex-col gap-3 p-4 border-b border-border sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
                <ArrowLeft size={18} />
              </Button>
              <div className="min-w-0">
                <h2 className="font-semibold text-sm truncate">AI Resume Builder</h2>
                <p className="text-xs text-muted-foreground truncate">
                  Chat to build your resume
                  {!resumeId && (
                    <>
                      {' · '}
                      <button
                        type="button"
                        onClick={handleStartFromScratch}
                        disabled={isStartingFromScratch}
                        className="underline hover:text-foreground disabled:opacity-60"
                      >
                        {isStartingFromScratch ? 'Creating…' : 'start from scratch instead'}
                      </button>
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setShowMobilePreview((v) => !v)}
              >
                {showMobilePreview ? <EyeOff size={14} className="mr-1.5" /> : <Eye size={14} className="mr-1.5" />}
                {showMobilePreview ? 'Hide preview' : 'Preview'}
              </Button>
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

          {/* Mobile-only live preview — a collapsible version of the desktop
              panel further down, which is `hidden` below the `lg` breakpoint. */}
          {showMobilePreview && (
            <div
              className="lg:hidden relative overflow-hidden border-b border-border"
              style={{
                background: '#0b0b10',
                backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(139,92,246,0.07) 1px, transparent 0)',
                backgroundSize: '28px 28px',
              }}
            >
              <div className="relative z-10 flex items-center justify-between px-4 py-2 border-b border-white/5">
                <span className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.18em]">
                  Live Preview
                </span>
                <div className="flex items-center gap-0.5 overflow-x-auto max-w-[55vw] hide-scrollbar rounded border border-white/8 bg-white/5 px-0.5">
                  {availableTemplates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplate(t.id)}
                      aria-pressed={currentTemplateId === t.id}
                      className={`text-[10px] px-2 py-0.5 whitespace-nowrap transition-colors ${
                        currentTemplateId === t.id
                          ? 'bg-primary/80 text-white'
                          : 'text-white/25 hover:text-white/50'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative z-10 flex items-center justify-center overflow-auto p-4 max-h-[50vh]">
                <div className="overflow-x-auto max-w-full">
                  <ResumePreview resume={previewResume} scale={0.4} />
                </div>
              </div>
            </div>
          )}

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
              <div className="flex items-center gap-0.5 overflow-x-auto max-w-[240px] hide-scrollbar rounded border border-white/8 bg-white/5 px-0.5">
                {availableTemplates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id)}
                    aria-pressed={currentTemplateId === t.id}
                    className={`text-[10px] px-2 py-0.5 whitespace-nowrap transition-colors ${
                      currentTemplateId === t.id
                        ? 'bg-primary/80 text-white'
                        : 'text-white/25 hover:text-white/50'
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
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