import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ArrowLeft, ArrowRight, Compass, PenLine, Sparkles, Target, Upload, type LucideIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { LogoMark } from '../ui/LogoMark';
import { useAuth } from '../../context/AuthContext';
import { authApi, resumeApi, ApiError } from '../../lib/api';
import { upsertFact } from '../../lib/profileApi';
import { cn } from '../../lib/utils';

type GoalId = 'land_job' | 'promotion' | 'career_change' | 'stay_prepared';
type ExperienceId = 'student' | '0-2' | '3-5' | '6-10' | '10+';
type BuildOptionId = 'ai' | 'import' | 'scratch';

interface BuildOption {
  id: BuildOptionId;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  /** Static route to send the user to. The "scratch" option has none —
   * it creates a blank resume first, then routes to its generated id. */
  route?: string;
}

const TOTAL_STEPS = 5;

const GOAL_OPTIONS: { id: GoalId; emoji: string; title: string; subtitle: string }[] = [
  { id: 'land_job', emoji: '🎯', title: 'Land a new job', subtitle: "I'm actively job hunting" },
  { id: 'promotion', emoji: '📈', title: 'Get a promotion', subtitle: 'I want to move up where I am' },
  { id: 'career_change', emoji: '🔄', title: 'Change careers', subtitle: "I'm switching to a new field" },
  { id: 'stay_prepared', emoji: '💼', title: 'Stay prepared', subtitle: 'I like to keep my resume current' },
];

const EXPERIENCE_OPTIONS: { id: ExperienceId; label: string }[] = [
  { id: 'student', label: 'Student / Graduate' },
  { id: '0-2', label: '0-2 years' },
  { id: '3-5', label: '3-5 years' },
  { id: '6-10', label: '6-10 years' },
  { id: '10+', label: '10+ years' },
];

const BUILD_OPTIONS: BuildOption[] = [
  {
    id: 'ai',
    icon: Sparkles,
    title: 'Start with AI',
    subtitle: 'Chat with our AI and it builds your resume from your answers.',
    route: '/resumes/new/chat',
  },
  {
    id: 'import',
    icon: Upload,
    title: 'Import existing CV',
    subtitle: "Upload your current CV and we'll parse it.",
    route: '/resumes/new/chat?import=true',
  },
  {
    id: 'scratch',
    icon: PenLine,
    title: 'Start from scratch',
    subtitle: "I'll fill it in myself.",
  },
];

const TIPS = [
  { icon: Compass, title: 'Use the AI coach to map your path' },
  { icon: Target, title: 'Tailor your resume for each job' },
  { icon: Sparkles, title: 'Practice interviews before the real thing' },
];

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center mb-8">
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">{title}</h2>
      <p className="text-white/50 text-sm sm:text-base">{subtitle}</p>
    </div>
  );
}

const slideVariants = {
  enter: (dir: 1 | -1) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: 1 | -1) => ({ x: dir > 0 ? -48 : 48, opacity: 0 }),
};

/**
 * Full-screen, first-time-only onboarding walkthrough. Mounted by
 * DashboardPage whenever `user.hasCompletedOnboarding` is false; unmounts
 * itself the moment that flips to true (via refreshUser), so it never needs
 * an onClose prop. Not dismissible by clicking outside — only "Skip for
 * now" or finishing step 5 will close it.
 */
export function OnboardingModal() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [selectedGoal, setSelectedGoal] = useState<GoalId | null>(null);
  const [selectedExperience, setSelectedExperience] = useState<ExperienceId | null>(null);
  const [selectedBuildPath, setSelectedBuildPath] = useState<BuildOption | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const advanceTimeoutRef = useRef<number | null>(null);

  // Lock body scroll while the full-screen modal is up.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) window.clearTimeout(advanceTimeoutRef.current);
    };
  }, []);

  // Confetti burst the moment the final step appears.
  useEffect(() => {
    if (step !== 4) return;
    const end = Date.now() + 1200;
    const colors = ['#818cf8', '#a855f7', '#ec4899', '#22d3ee'];
    (function frame() {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, [step]);

  function goNext() {
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function goBack() {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }

  function queueAdvance() {
    if (advanceTimeoutRef.current) window.clearTimeout(advanceTimeoutRef.current);
    advanceTimeoutRef.current = window.setTimeout(goNext, 400);
  }

  function selectGoal(id: GoalId) {
    setSelectedGoal(id);
    queueAdvance();
  }

  function selectExperience(id: ExperienceId) {
    setSelectedExperience(id);
    queueAdvance();
  }

  function selectBuildPath(option: BuildOption) {
    setSelectedBuildPath(option);
    queueAdvance();
  }

  // Best-effort — saving these facts should never block onboarding from
  // completing (e.g. a brand-new account may not have a verified email yet,
  // which the profile-facts API requires).
  async function persistSelections() {
    const tasks: Promise<unknown>[] = [];
    if (selectedGoal) {
      tasks.push(
        upsertFact({
          category: 'GOAL',
          key: 'goal:onboarding',
          value: { goal: selectedGoal },
          confidenceScore: 90,
          source: 'USER_CONFIRMED',
        }),
      );
    }
    if (selectedExperience) {
      tasks.push(
        upsertFact({
          category: 'PREFERENCE',
          key: 'preference:experience_level',
          value: { experienceLevel: selectedExperience },
          confidenceScore: 90,
          source: 'USER_CONFIRMED',
        }),
      );
    }
    if (tasks.length) {
      const results = await Promise.allSettled(tasks);
      results.forEach((result) => {
        if (result.status === 'rejected') {
          console.warn('Could not save an onboarding selection to the career profile:', result.reason);
        }
      });
    }
  }

  async function completeAndSync() {
    await persistSelections();
    await authApi.completeOnboarding();
    await refreshUser();
  }

  async function handleSkip() {
    setIsFinishing(true);
    setFinishError(null);
    try {
      await completeAndSync();
    } catch (err) {
      setFinishError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsFinishing(false);
    }
  }

  async function handleFinish() {
    setIsFinishing(true);
    setFinishError(null);
    try {
      await completeAndSync();
      if (selectedBuildPath?.id === 'scratch') {
        const { resume } = await resumeApi.create({ title: 'Untitled Resume' });
        navigate(`/resumes/${resume.id}`);
      } else if (selectedBuildPath?.route) {
        navigate(selectedBuildPath.route);
      }
    } catch (err) {
      setFinishError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsFinishing(false);
    }
  }

  return (
    <div
      className="welcome-page fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Corvyx onboarding"
    >
      {/* Progress bar */}
      <div className="fixed top-0 inset-x-0 h-1 bg-white/10 z-[101]">
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400"
          animate={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      {step > 0 && step < 4 && (
        <button
          onClick={goBack}
          disabled={isFinishing}
          className="fixed top-6 left-6 z-[101] inline-flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
        >
          <ArrowLeft size={14} /> Back
        </button>
      )}

      {step >= 1 && (
        <button
          onClick={handleSkip}
          disabled={isFinishing}
          className="fixed bottom-6 left-6 z-[101] text-xs text-white/40 hover:text-white/70 underline-offset-4 hover:underline transition-colors disabled:opacity-40"
        >
          Skip for now
        </button>
      )}

      <div className="relative w-full max-w-2xl">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: 'easeInOut' }}
          >
            {step === 0 && (
              <div className="text-center px-2">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="mx-auto mb-8 w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30"
                >
                  <LogoMark size={40} className="text-white" animate />
                </motion.div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight neon-glow-text mb-4">
                  Welcome to Corvyx — let&apos;s set you up for success.
                </h1>
                <p className="text-white/60 text-base sm:text-lg mb-10 max-w-md mx-auto">
                  Takes 2 minutes. We&apos;ll personalise your experience.
                </p>
                <Button size="lg" onClick={goNext} className="bg-white text-black hover:bg-white/90 group">
                  Let&apos;s go
                  <ArrowRight size={16} className="ml-1.5 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </div>
            )}

            {step === 1 && (
              <div className="px-2">
                <StepHeader title="What's your goal?" subtitle="This helps us tailor tips and suggestions to you." />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {GOAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => selectGoal(opt.id)}
                      className={cn(
                        'text-left p-5 rounded-2xl border transition-all',
                        selectedGoal === opt.id
                          ? 'border-indigo-400/70 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]',
                      )}
                    >
                      <span className="text-3xl mb-3 block">{opt.emoji}</span>
                      <p className="font-semibold mb-1">{opt.title}</p>
                      <p className="text-sm text-white/50">{opt.subtitle}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="px-2">
                <StepHeader title="Your experience level" subtitle="We'll calibrate suggestions to where you are." />
                <div className="flex flex-wrap gap-3 justify-center">
                  {EXPERIENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => selectExperience(opt.id)}
                      className={cn(
                        'px-5 py-3 rounded-full border text-sm font-medium transition-all',
                        selectedExperience === opt.id
                          ? 'border-purple-400/70 bg-purple-500/15 text-white shadow-lg shadow-purple-500/10'
                          : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25 hover:text-white',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="px-2">
                <StepHeader title="Build your first resume" subtitle="Pick how you'd like to start — you can always change it later." />
                <div className="space-y-3">
                  {BUILD_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => selectBuildPath(opt)}
                        className={cn(
                          'w-full flex items-center gap-4 text-left p-5 rounded-2xl border transition-all',
                          selectedBuildPath?.id === opt.id
                            ? 'border-cyan-400/70 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                            : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]',
                        )}
                      >
                        <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                          <Icon size={22} className="text-indigo-300" />
                        </div>
                        <div>
                          <p className="font-semibold mb-0.5">{opt.title}</p>
                          <p className="text-sm text-white/50">{opt.subtitle}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="text-center px-2">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight neon-glow-text mb-3">
                  You&apos;re ready to forge your career.
                </h1>
                <p className="text-white/60 mb-10">A few tips before you dive in.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 text-left">
                  {TIPS.map((tip) => {
                    const Icon = tip.icon;
                    return (
                      <div key={tip.title} className="p-5 rounded-2xl border border-white/10 bg-white/[0.03]">
                        <Icon size={20} className="text-indigo-300 mb-3" />
                        <p className="text-sm font-medium">{tip.title}</p>
                      </div>
                    );
                  })}
                </div>
                <Button
                  size="lg"
                  onClick={handleFinish}
                  disabled={isFinishing}
                  className="bg-white text-black hover:bg-white/90 group"
                >
                  {isFinishing ? 'Setting things up…' : 'Go to dashboard'}
                  {!isFinishing && <ArrowRight size={16} className="ml-1.5 transition-transform group-hover:translate-x-0.5" />}
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {finishError && <p className="mt-6 text-center text-sm text-red-400">{finishError}</p>}
      </div>
    </div>
  );
}