import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Save,
  Award,
  Target,
} from 'lucide-react';
import type { ResumeSummary } from '@careerforge/schema';
import { resumeApi, interviewApi, ApiError, type InterviewQuestion, type AnswerEvaluation } from '../../lib/api';
import { AppShell } from '../../components/layout/AppShell';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { ProfileCompletionRing } from '../../components/profile/ProfileCompletionRing';
import { cn } from '../../lib/utils';

type Step = 'setup' | 'practice' | 'results';

const QUESTION_COUNT_OPTIONS = [5, 10, 15] as const;

const CATEGORY_LABEL: Record<InterviewQuestion['category'], string> = {
  behavioural: 'Behavioural',
  technical: 'Technical',
  situational: 'Situational',
  culture: 'Culture fit',
};

const CATEGORY_STYLE: Record<InterviewQuestion['category'], string> = {
  behavioural: 'text-indigo-400 bg-indigo-500/10',
  technical: 'text-sky-400 bg-sky-500/10',
  situational: 'text-amber-400 bg-amber-500/10',
  culture: 'text-fuchsia-400 bg-fuchsia-500/10',
};

const DIFFICULTY_STYLE: Record<InterviewQuestion['difficulty'], string> = {
  easy: 'text-emerald-400 bg-emerald-500/10',
  medium: 'text-amber-400 bg-amber-500/10',
  hard: 'text-rose-400 bg-rose-500/10',
};

/** Tallies how often each string appears across every evaluated question's
 * `pick(evaluation)` array and returns the 3 most common — same "most
 * common, not everything" summary policy as the backend's /interview/session
 * endpoint, kept here too so Step 3 can render instantly without waiting on
 * a round trip. */
function topItems(questions: InterviewQuestion[], evaluations: Record<string, AnswerEvaluation>, pick: (e: AnswerEvaluation) => string[]): string[] {
  const counts = new Map<string, number>();
  for (const q of questions) {
    const evaluation = evaluations[q.id];
    if (!evaluation) continue;
    for (const item of pick(evaluation)) counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([item]) => item);
}

export function InterviewPrepPage() {
  const [step, setStep] = useState<Step>('setup');

  // Setup state
  const [resumes, setResumes] = useState<ResumeSummary[] | null>(null);
  const [resumesError, setResumesError] = useState<string | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [generating, setGenerating] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Practice state
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [evaluations, setEvaluations] = useState<Record<string, AnswerEvaluation>>({});
  const [answerDraft, setAnswerDraft] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [evaluateError, setEvaluateError] = useState<string | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [idealAnswerOpen, setIdealAnswerOpen] = useState(false);

  // Results state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedSummary, setSavedSummary] = useState<string | null>(null);

  useEffect(() => {
    resumeApi
      .list()
      .then((data) => {
        setResumes(data.resumes);
        setSelectedResumeId((prev) => prev || data.resumes[0]?.id || '');
      })
      .catch(() => setResumesError('Could not load your resumes.'));
  }, []);

  // Reset the per-question UI (hint/ideal-answer collapsibles, answer draft)
  // whenever the current question changes.
  useEffect(() => {
    const q = questions[currentIndex];
    setAnswerDraft(q ? answers[q.id] ?? '' : '');
    setHintOpen(false);
    setIdealAnswerOpen(false);
    setEvaluateError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, questions]);

  async function handleGenerate() {
    if (!selectedResumeId) {
      setSetupError('Choose a resume first.');
      return;
    }
    if (!jobDescription.trim()) {
      setSetupError('Paste the job description first.');
      return;
    }
    setGenerating(true);
    setSetupError(null);
    try {
      const data = await interviewApi.generateQuestions(selectedResumeId, jobDescription.trim(), questionCount);
      setQuestions(data.questions);
      setCurrentIndex(0);
      setAnswers({});
      setEvaluations({});
      setSavedSummary(null);
      setSaveError(null);
      setStep('practice');
    } catch (err) {
      setSetupError(err instanceof ApiError ? err.message : 'Could not generate questions right now. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmitAnswer() {
    const question = questions[currentIndex];
    if (!question) return;
    if (!answerDraft.trim()) {
      setEvaluateError('Write an answer before submitting.');
      return;
    }
    setEvaluating(true);
    setEvaluateError(null);
    try {
      const data = await interviewApi.evaluateAnswer(question.question, answerDraft.trim(), jobDescription.trim());
      setAnswers((prev) => ({ ...prev, [question.id]: answerDraft.trim() }));
      setEvaluations((prev) => ({ ...prev, [question.id]: data.evaluation }));
    } catch (err) {
      setEvaluateError(err instanceof ApiError ? err.message : 'Could not evaluate that answer right now. Please try again.');
    } finally {
      setEvaluating(false);
    }
  }

  function handleNext() {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((i) => i + 1);
    } else {
      setStep('results');
    }
  }

  async function handleSaveSession() {
    if (!selectedResumeId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const data = await interviewApi.saveSession({
        resumeId: selectedResumeId,
        jobDescription: jobDescription.trim(),
        questions,
        answers,
      });
      setSavedSummary(data.summary);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Could not save this session right now. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePracticeAgain() {
    setGenerating(true);
    setSetupError(null);
    try {
      const data = await interviewApi.generateQuestions(selectedResumeId, jobDescription.trim(), questionCount);
      setQuestions(data.questions);
      setCurrentIndex(0);
      setAnswers({});
      setEvaluations({});
      setSavedSummary(null);
      setSaveError(null);
      setStep('practice');
    } catch (err) {
      setSetupError(err instanceof ApiError ? err.message : 'Could not generate new questions right now. Please try again.');
      setStep('setup');
    } finally {
      setGenerating(false);
    }
  }

  const currentQuestion = questions[currentIndex];
  const currentEvaluation = currentQuestion ? evaluations[currentQuestion.id] : undefined;
  const progressCount = currentIndex + (currentEvaluation ? 1 : 0);
  const progressPct = questions.length ? Math.round((progressCount / questions.length) * 100) : 0;

  const answeredEvaluations = questions.map((q) => evaluations[q.id]).filter((e): e is AnswerEvaluation => !!e);
  const overallScore = answeredEvaluations.length
    ? Math.round(answeredEvaluations.reduce((sum, e) => sum + e.score, 0) / answeredEvaluations.length)
    : 0;
  const categoryBreakdown = (['behavioural', 'technical', 'situational', 'culture'] as const)
    .map((category) => {
      const scores = questions.filter((q) => q.category === category && evaluations[q.id]).map((q) => evaluations[q.id].score);
      if (!scores.length) return null;
      return { category, avg: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length), count: scores.length };
    })
    .filter((v): v is { category: InterviewQuestion['category']; avg: number; count: number } => !!v);
  const topStrengths = topItems(questions, evaluations, (e) => e.strengths);
  const topImprovements = topItems(questions, evaluations, (e) => e.improvements);

  return (
    <AppShell>
      <div className="p-4 sm:p-8 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <MessageSquare size={22} className="text-indigo-400" />
            Interview Prep
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Practice with AI-generated questions tailored to your resume and a job description, and get feedback on every answer.
          </p>
        </div>

        {/* Step 1 — Setup */}
        {step === 'setup' && (
          <GlassCard>
            {generating ? (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <Loader2 size={28} className="animate-spin text-indigo-400" />
                <p className="text-sm text-muted-foreground">Preparing your interview…</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Resume</label>
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
                      className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                    placeholder="Paste the job description here…"
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Number of questions</label>
                  <div className="flex items-center gap-2">
                    {QUESTION_COUNT_OPTIONS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setQuestionCount(n)}
                        className={cn(
                          'h-10 px-4 rounded-xl text-sm font-medium border transition-colors',
                          questionCount === n
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent',
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {setupError && <p className="text-sm text-destructive">{setupError}</p>}

                <Button onClick={handleGenerate} disabled={resumes?.length === 0} className="w-full">
                  <Sparkles size={16} className="mr-1.5" /> Generate Questions
                </Button>
              </div>
            )}
          </GlassCard>
        )}

        {/* Step 2 — Practice */}
        {step === 'practice' && currentQuestion && (
          <div>
            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600"
                  initial={false}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <GlassCard>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', CATEGORY_STYLE[currentQuestion.category])}>
                      {CATEGORY_LABEL[currentQuestion.category]}
                    </span>
                    <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold capitalize', DIFFICULTY_STYLE[currentQuestion.difficulty])}>
                      {currentQuestion.difficulty}
                    </span>
                  </div>

                  <h2 className="text-lg font-semibold mb-3">{currentQuestion.question}</h2>

                  <button
                    type="button"
                    onClick={() => setHintOpen((o) => !o)}
                    className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 mb-4"
                  >
                    {hintOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    Hint
                  </button>
                  <AnimatePresence initial={false}>
                    {hintOpen && (
                      <motion.p
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="text-sm text-muted-foreground bg-muted/50 rounded-xl p-3 mb-4 overflow-hidden"
                      >
                        {currentQuestion.tip}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {!currentEvaluation ? (
                    <div className="space-y-3">
                      <textarea
                        value={answerDraft}
                        onChange={(e) => setAnswerDraft(e.target.value)}
                        rows={8}
                        disabled={evaluating}
                        placeholder="Type your answer here…"
                        className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      />
                      {evaluateError && <p className="text-sm text-destructive">{evaluateError}</p>}
                      <Button onClick={handleSubmitAnswer} disabled={evaluating} className="w-full">
                        {evaluating ? (
                          <>
                            <Loader2 size={16} className="animate-spin mr-1.5" /> Evaluating your answer…
                          </>
                        ) : (
                          'Submit Answer'
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-xl bg-muted/40 p-4 whitespace-pre-wrap text-sm text-muted-foreground">{answers[currentQuestion.id]}</div>

                      <div className="flex items-center gap-4">
                        <ProfileCompletionRing score={currentEvaluation.score} size={72} strokeWidth={6} />
                        <div>
                          <p className="text-sm font-medium">Answer score</p>
                          <p className="text-xs text-muted-foreground">Out of 100</p>
                        </div>
                      </div>

                      {currentEvaluation.strengths.length > 0 && (
                        <div>
                          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-400 mb-1.5">
                            <CheckCircle2 size={15} /> Strengths
                          </p>
                          <ul className="space-y-1">
                            {currentEvaluation.strengths.map((s, i) => (
                              <li key={i} className="text-sm text-muted-foreground pl-1">
                                • {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {currentEvaluation.improvements.length > 0 && (
                        <div>
                          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-400 mb-1.5">
                            <AlertTriangle size={15} /> Improvements
                          </p>
                          <ul className="space-y-1">
                            {currentEvaluation.improvements.map((s, i) => (
                              <li key={i} className="text-sm text-muted-foreground pl-1">
                                • {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {currentEvaluation.idealAnswer && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setIdealAnswerOpen((o) => !o)}
                            className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300"
                          >
                            {idealAnswerOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            See ideal answer
                          </button>
                          <AnimatePresence initial={false}>
                            {idealAnswerOpen && (
                              <motion.p
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="text-sm text-muted-foreground bg-muted/50 rounded-xl p-3 mt-2 overflow-hidden"
                              >
                                {currentEvaluation.idealAnswer}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      <Button onClick={handleNext} className="w-full">
                        {currentIndex + 1 < questions.length ? (
                          <>
                            Next Question <ArrowRight size={16} className="ml-1.5" />
                          </>
                        ) : (
                          'See Results'
                        )}
                      </Button>
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* Step 3 — Results */}
        {step === 'results' && (
          <div className="space-y-6">
            <GlassCard className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Overall score</p>
              <div className="flex justify-center mb-2">
                <ProfileCompletionRing score={overallScore} size={110} strokeWidth={8} />
              </div>
              <p className="text-sm text-muted-foreground">
                Across {answeredEvaluations.length} of {questions.length} questions
              </p>
            </GlassCard>

            {categoryBreakdown.length > 0 && (
              <GlassCard>
                <h3 className="text-sm font-semibold mb-4">Breakdown by category</h3>
                <div className="space-y-3">
                  {categoryBreakdown.map(({ category, avg, count }) => (
                    <div key={category} className="flex items-center gap-3">
                      <span className={cn('w-28 shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold text-center', CATEGORY_STYLE[category])}>
                        {CATEGORY_LABEL[category]}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600" style={{ width: `${avg}%` }} />
                      </div>
                      <span className="w-16 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                        {avg}/100 <span className="text-xs">({count})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {topStrengths.length > 0 && (
                <GlassCard>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400 mb-3">
                    <Award size={16} /> Top strengths
                  </h3>
                  <ul className="space-y-1.5">
                    {topStrengths.map((s, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        • {s}
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              )}
              {topImprovements.length > 0 && (
                <GlassCard>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-amber-400 mb-3">
                    <Target size={16} /> Focus areas
                  </h3>
                  <ul className="space-y-1.5">
                    {topImprovements.map((s, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        • {s}
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              )}
            </div>

            {saveError && <p className="text-sm text-destructive">{saveError}</p>}
            {savedSummary && (
              <p className="text-sm text-emerald-400 bg-emerald-500/10 rounded-xl p-3">{savedSummary}</p>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleSaveSession} disabled={saving || !!savedSummary} className="flex-1">
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-1.5" /> Saving…
                  </>
                ) : (
                  <>
                    <Save size={16} className="mr-1.5" /> {savedSummary ? 'Session Saved' : 'Save Session'}
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handlePracticeAgain} disabled={generating} className="flex-1">
                {generating ? (
                  <Loader2 size={16} className="animate-spin mr-1.5" />
                ) : (
                  <RotateCcw size={16} className="mr-1.5" />
                )}
                Practice Again
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
