import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass,
  Send,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  ArrowRight,
  TrendingUp,
  Target,
  Lightbulb,
  Flame,
  Clock,
  Info,
} from 'lucide-react';
import type { ResumeSummary } from '@careerforge/schema';
import { getLimits, type Tier } from '@careerforge/schema';
import {
  resumeApi,
  coachApi,
  ApiError,
  isPlanLimitError,
  type CareerCoachContext,
  type ActionItem,
  type CareerGrowthAnalysis,
} from '../../lib/api';
import { AppShell } from '../../components/layout/AppShell';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { UpgradePrompt } from '../../components/ui/UpgradePrompt';
import { SuggestionCapsules } from '../../components/ai/SuggestionCapsules';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

type CoachTab = 'chat' | 'analysis';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    "Hi! I'm your Corvyx career coach. Tell me what's on your mind — a decision you're weighing, a skill gap, negotiating an offer — and I'll give you direct, actionable advice.",
};

// Same 'cf-' prefix convention as the theme preference in store/ui.store.ts.
const CONTEXT_STORAGE_KEY = 'cf-coach-context';

const TABS: { id: CoachTab; label: string }[] = [
  { id: 'chat', label: 'Coach Chat' },
  { id: 'analysis', label: 'Career Analysis' },
];

const PRIORITY_STYLE: Record<ActionItem['priority'], { border: string; badge: string; icon: typeof Flame }> = {
  high: { border: 'border-l-rose-500', badge: 'text-rose-400 bg-rose-500/10', icon: Flame },
  medium: { border: 'border-l-amber-500', badge: 'text-amber-400 bg-amber-500/10', icon: Clock },
  low: { border: 'border-l-sky-500', badge: 'text-sky-400 bg-sky-500/10', icon: Info },
};

const IMPORTANCE_STYLE: Record<CareerGrowthAnalysis['skillGaps'][number]['importance'], string> = {
  critical: 'border-rose-500/40 bg-rose-500/5',
  important: 'border-amber-500/40 bg-amber-500/5',
  'nice-to-have': 'border-emerald-500/40 bg-emerald-500/5',
};

const IMPORTANCE_BADGE: Record<CareerGrowthAnalysis['skillGaps'][number]['importance'], string> = {
  critical: 'text-rose-400 bg-rose-500/10',
  important: 'text-amber-400 bg-amber-500/10',
  'nice-to-have': 'text-emerald-400 bg-emerald-500/10',
};

function ActionItemCard({ item }: { item: ActionItem }) {
  const style = PRIORITY_STYLE[item.priority];
  const Icon = style.icon;
  return (
    <div className={cn('rounded-xl border-l-4 bg-muted/40 p-3.5', style.border)}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize', style.badge)}>
          <Icon size={11} /> {item.priority}
        </span>
        <span className="text-[11px] text-muted-foreground shrink-0">{item.timeframe}</span>
      </div>
      <p className="text-sm font-medium mb-0.5">{item.title}</p>
      <p className="text-xs text-muted-foreground">{item.description}</p>
    </div>
  );
}

export function CareerCoachPage() {
  const { user } = useAuth();
  const planAllowsFeature = getLimits((user?.subscriptionTier ?? 'FREE') as Tier).careerCoach;

  const [tab, setTab] = useState<CoachTab>('chat');

  // ---------------------------------------------------------------------
  // Coach Chat tab
  // ---------------------------------------------------------------------
  const [contextOpen, setContextOpen] = useState(true);
  const [currentRole, setCurrentRole] = useState('');
  const [targetRoleCtx, setTargetRoleCtx] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Restore persisted context on mount, then collapse the bar automatically
  // if it was already filled in from a previous visit — a returning user
  // doesn't need the inputs open every time, only a first-time visitor does.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONTEXT_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { currentRole?: string; targetRole?: string; yearsExperience?: string };
      if (saved.currentRole) setCurrentRole(saved.currentRole);
      if (saved.targetRole) setTargetRoleCtx(saved.targetRole);
      if (saved.yearsExperience) setYearsExperience(saved.yearsExperience);
      if (saved.currentRole || saved.targetRole || saved.yearsExperience) setContextOpen(false);
    } catch {
      // Malformed/foreign localStorage value — ignore and start fresh.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify({ currentRole, targetRole: targetRoleCtx, yearsExperience }));
  }, [currentRole, targetRoleCtx, yearsExperience]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function buildContext(): CareerCoachContext {
    const ctx: CareerCoachContext = {};
    if (currentRole.trim()) ctx.currentRole = currentRole.trim();
    if (targetRoleCtx.trim()) ctx.targetRole = targetRoleCtx.trim();
    const years = Number(yearsExperience);
    if (yearsExperience.trim() && !Number.isNaN(years)) ctx.yearsExperience = years;
    return ctx;
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isSending) return;
    const newMessages = [...messages, { role: 'user' as const, content: text.trim() }];
    setMessages(newMessages);
    setInput('');
    setSuggestions([]);
    setIsSending(true);
    setChatError(null);
    try {
      const result = await coachApi.chat(newMessages, buildContext());
      setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);
      setSuggestions(result.suggestions ?? []);
      if (result.actionItems?.length) {
        // Newest first, so the sidebar always leads with what the coach
        // just recommended rather than burying it below earlier items.
        setActionItems((prev) => [...result.actionItems!, ...prev]);
      }
    } catch (err) {
      if (isPlanLimitError(err)) {
        setChatError(err.message);
      } else {
        setChatError(err instanceof ApiError ? err.message : 'Could not reach your coach right now. Please try again.');
      }
    } finally {
      setIsSending(false);
    }
  }

  function handleSend(e: FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  function handleClearChat() {
    setMessages([INITIAL_MESSAGE]);
    setSuggestions([]);
    setActionItems([]);
    setChatError(null);
  }

  // ---------------------------------------------------------------------
  // Career Analysis tab
  // ---------------------------------------------------------------------
  const [resumes, setResumes] = useState<ResumeSummary[] | null>(null);
  const [resumesError, setResumesError] = useState<string | null>(null);
  const [analysisResumeId, setAnalysisResumeId] = useState('');
  const [analysisTargetRole, setAnalysisTargetRole] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CareerGrowthAnalysis | null>(null);

  useEffect(() => {
    resumeApi
      .list()
      .then((data) => {
        setResumes(data.resumes);
        setAnalysisResumeId((prev) => prev || data.resumes[0]?.id || '');
      })
      .catch(() => setResumesError('Could not load your resumes.'));
  }, []);

  async function handleAnalyse() {
    if (!analysisResumeId) {
      setAnalysisError('Choose a resume first.');
      return;
    }
    if (!analysisTargetRole.trim()) {
      setAnalysisError('Enter a target role first.');
      return;
    }
    setAnalysing(true);
    setAnalysisError(null);
    try {
      const data = await coachApi.analyse(analysisResumeId, analysisTargetRole.trim());
      setAnalysis(data.analysis);
    } catch (err) {
      setAnalysisError(
        isPlanLimitError(err)
          ? err.message
          : err instanceof ApiError
          ? err.message
          : 'Could not analyze your career path right now. Please try again.',
      );
    } finally {
      setAnalysing(false);
    }
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Compass size={22} className="text-emerald-400" />
            Career Coach
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Talk through decisions with an AI career coach, or map the skill gaps and timeline between where you are and where you want to be.
          </p>
        </div>

        {!planAllowsFeature ? (
          <UpgradePrompt feature="Career Coach" requiredPlan="PREMIUM" />
        ) : (
        <>
        {/* Tab bar — same layoutId-animated pill pattern used across the AI tools */}
        <nav className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/50 mb-6 w-fit">
          {TABS.map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'relative flex items-center px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="coach-tab-pill"
                    className="absolute inset-0 bg-background rounded-lg shadow-sm border border-border/50"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{t.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Tab 1 — Coach Chat */}
        {tab === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
            <div>
              {/* Context bar */}
              <GlassCard className="p-0 overflow-hidden mb-4">
                <button
                  type="button"
                  onClick={() => setContextOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-5 py-3 text-sm"
                >
                  <span className="font-medium">
                    Your context
                    {!contextOpen && (currentRole || targetRoleCtx || yearsExperience) && (
                      <span className="text-muted-foreground font-normal ml-2">
                        {[currentRole, targetRoleCtx && `→ ${targetRoleCtx}`, yearsExperience && `${yearsExperience} yrs`]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                  </span>
                  {contextOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <AnimatePresence initial={false}>
                  {contextOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-5 pb-4">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">Current role</label>
                          <input
                            value={currentRole}
                            onChange={(e) => setCurrentRole(e.target.value)}
                            placeholder="e.g. Product Manager"
                            className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">Target role</label>
                          <input
                            value={targetRoleCtx}
                            onChange={(e) => setTargetRoleCtx(e.target.value)}
                            placeholder="e.g. Senior PM"
                            className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">Years of experience</label>
                          <input
                            type="number"
                            min={0}
                            value={yearsExperience}
                            onChange={(e) => setYearsExperience(e.target.value)}
                            placeholder="e.g. 5"
                            className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>

              {/* Chat panel */}
              <GlassCard className="p-0 overflow-hidden flex flex-col h-[60vh]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <p className="text-sm font-medium">Chat</p>
                  <button
                    type="button"
                    onClick={handleClearChat}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Trash2 size={13} /> Clear chat
                  </button>
                </div>

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
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
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

                  {chatError && <p className="text-xs text-destructive text-center">{chatError}</p>}
                  <div ref={bottomRef} />
                </div>

                {/* Action items — mobile only, shown below the chat */}
                {actionItems.length > 0 && (
                  <div className="lg:hidden border-t border-border p-4 space-y-2.5 max-h-56 overflow-y-auto">
                    <p className="text-xs font-medium text-muted-foreground">Action items</p>
                    {actionItems.map((item, i) => (
                      <ActionItemCard key={i} item={item} />
                    ))}
                  </div>
                )}

                <div className="px-4 pb-2">
                  <SuggestionCapsules suggestions={suggestions} onSelect={(s) => void sendMessage(s)} disabled={isSending} />
                </div>

                <form onSubmit={handleSend} className="p-4 border-t border-border flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask your coach anything…"
                    disabled={isSending}
                    className="flex-1 h-11 rounded-xl border border-input bg-background px-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  />
                  <Button type="submit" size="icon" disabled={isSending || !input.trim()}>
                    <Send size={16} />
                  </Button>
                </form>
              </GlassCard>
            </div>

            {/* Action items — desktop sidebar */}
            <div className="hidden lg:block sticky top-6 space-y-2.5">
              <p className="text-xs font-medium text-muted-foreground px-1">Action items</p>
              {actionItems.length === 0 ? (
                <GlassCard>
                  <p className="text-sm text-muted-foreground">
                    Concrete tasks your coach suggests will show up here as you chat.
                  </p>
                </GlassCard>
              ) : (
                actionItems.map((item, i) => <ActionItemCard key={i} item={item} />)
              )}
            </div>
          </div>
        )}

        {/* Tab 2 — Career Analysis */}
        {tab === 'analysis' && (
          <div>
            <GlassCard className="mb-6">
              {analysing ? (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  <Loader2 size={28} className="animate-spin text-emerald-400" />
                  <p className="text-sm text-muted-foreground">Mapping your career trajectory…</p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium">Resume</label>
                      {resumesError && <p className="text-sm text-destructive">{resumesError}</p>}
                      {resumes && resumes.length > 0 && (
                        <select
                          value={analysisResumeId}
                          onChange={(e) => setAnalysisResumeId(e.target.value)}
                          className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {resumes.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.title}
                            </option>
                          ))}
                        </select>
                      )}
                      {resumes?.length === 0 && <p className="text-sm text-muted-foreground">You don't have any resumes yet.</p>}
                      {resumes === null && !resumesError && <p className="text-sm text-muted-foreground">Loading your resumes…</p>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium">Target role</label>
                      <input
                        type="text"
                        value={analysisTargetRole}
                        onChange={(e) => setAnalysisTargetRole(e.target.value)}
                        placeholder="e.g. Engineering Manager"
                        className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>

                  {analysisError && <p className="text-sm text-destructive">{analysisError}</p>}

                  <Button onClick={handleAnalyse} disabled={resumes?.length === 0} className="w-full">
                    <Sparkles size={16} className="mr-1.5" /> Analyse my career path
                  </Button>
                </div>
              )}
            </GlassCard>

            {analysis && !analysing && (
              <div className="space-y-6">
                {/* Hero card */}
                <GlassCard>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-center mb-6">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Current level</p>
                      <p className="text-lg font-semibold">{analysis.currentLevel}</p>
                    </div>
                    <ArrowRight size={22} className="text-emerald-400 rotate-90 sm:rotate-0" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Target level</p>
                      <p className="text-lg font-semibold">{analysis.targetLevel}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Estimated transition time</p>
                      <p className="text-base font-medium">{analysis.estimatedTimeToTransition}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                        <TrendingUp size={12} /> Salary range
                      </p>
                      <p className="text-base font-medium">
                        {analysis.salaryRange.current} <ArrowRight size={13} className="inline mx-1 text-muted-foreground" /> {analysis.salaryRange.target}
                      </p>
                    </div>
                  </div>
                </GlassCard>

                {/* Skills gap grid */}
                {analysis.skillGaps.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-3">
                      <Target size={15} className="text-emerald-400" /> Skills gap
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {analysis.skillGaps.map((gap, i) => (
                        <div key={i} className={cn('rounded-xl border p-4', IMPORTANCE_STYLE[gap.importance])}>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-sm font-semibold">{gap.skill}</p>
                            <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize shrink-0', IMPORTANCE_BADGE[gap.importance])}>
                              {gap.importance}
                            </span>
                          </div>
                          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <Lightbulb size={13} className="mt-0.5 shrink-0" />
                            <span>{gap.howToLearn}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Roadmap timeline */}
                {analysis.roadmap.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Roadmap</h3>
                    <GlassCard>
                      <div className="space-y-0">
                        {analysis.roadmap.map((phase, i) => (
                          <div key={i} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className="w-7 h-7 rounded-full bg-emerald-500/15 border-2 border-emerald-500/50 flex items-center justify-center text-xs font-semibold text-emerald-400 shrink-0">
                                {i + 1}
                              </div>
                              {i < analysis.roadmap.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
                            </div>
                            <div className={cn('pb-6', i === analysis.roadmap.length - 1 && 'pb-0')}>
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <p className="text-sm font-semibold">{phase.phase}</p>
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium text-muted-foreground bg-muted">{phase.duration}</span>
                              </div>
                              <ul className="space-y-1">
                                {phase.goals.map((goal, gi) => (
                                  <li key={gi} className="text-sm text-muted-foreground">
                                    • {goal}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  </div>
                )}

                {/* Top recommendations */}
                {analysis.topRecommendations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Top recommendations</h3>
                    <GlassCard>
                      <ol className="space-y-3">
                        {analysis.topRecommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <span className="text-sm">{rec}</span>
                          </li>
                        ))}
                      </ol>
                    </GlassCard>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        </>
        )}
      </div>
    </AppShell>
  );
}
