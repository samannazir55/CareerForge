import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Linkedin,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Briefcase,
  AlertTriangle,
  Lightbulb,
  RotateCcw,
} from 'lucide-react';
import type { ResumeSummary } from '@careerforge/schema';
import { getLimits, type Tier } from '@careerforge/schema';
import { resumeApi, linkedinApi, ApiError, isPlanLimitError, type LinkedInOptimization } from '../../lib/api';
import { AppShell } from '../../components/layout/AppShell';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { UpgradePrompt } from '../../components/ui/UpgradePrompt';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

const HEADLINE_MAX = 220;
const SUMMARY_MAX = 2600;

type Tab = 'headline' | 'experience' | 'skills' | 'recommendations';

const TABS: { id: Tab; label: string }[] = [
  { id: 'headline', label: 'Headline & About' },
  { id: 'experience', label: 'Experience' },
  { id: 'skills', label: 'Skills' },
  { id: 'recommendations', label: 'Recommendations' },
];

// Section badges on the Recommendations tab are keyed off whatever string
// the model returns (e.g. "Headline", "About", "Skills") rather than a
// closed enum, so colors are assigned by cycling through a fixed palette
// keyed on a hash of the string instead of an exact-match lookup table —
// new section names the model invents still get a consistent, readable
// badge instead of falling through to an unstyled default.
const BADGE_PALETTE = [
  'text-indigo-400 bg-indigo-500/10',
  'text-sky-400 bg-sky-500/10',
  'text-fuchsia-400 bg-fuchsia-500/10',
  'text-emerald-400 bg-emerald-500/10',
  'text-orange-400 bg-orange-500/10',
];
function badgeStyleFor(section: string): string {
  let hash = 0;
  for (let i = 0; i < section.length; i++) hash = (hash * 31 + section.charCodeAt(i)) >>> 0;
  return BADGE_PALETTE[hash % BADGE_PALETTE.length];
}

/** Small "Copy"/"Copied" button that copies `text` to the clipboard and
 * flips its own label/icon for a moment — self-contained so callers don't
 * each need to wire up their own timeout-reset state. */
function CopyButton({ text, label = 'Copy', className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className={className}>
      {copied ? <Check size={14} className="mr-1.5 text-emerald-400" /> : <Copy size={14} className="mr-1.5" />}
      {copied ? 'Copied' : label}
    </Button>
  );
}

export function LinkedInOptimizerPage() {
  const { user } = useAuth();
  const planAllowsFeature = getLimits((user?.subscriptionTier ?? 'FREE') as Tier).linkedinOptimizer;

  // Setup state
  const [resumes, setResumes] = useState<ResumeSummary[] | null>(null);
  const [resumesError, setResumesError] = useState<string | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [optimizing, setOptimizing] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [planLimitError, setPlanLimitError] = useState<string | null>(null);

  // Result state
  const [optimization, setOptimization] = useState<LinkedInOptimization | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('headline');
  const [headlineDraft, setHeadlineDraft] = useState('');
  const [summaryDraft, setSummaryDraft] = useState('');
  const [skillChecked, setSkillChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    resumeApi
      .list()
      .then((data) => {
        setResumes(data.resumes);
        setSelectedResumeId((prev) => prev || data.resumes[0]?.id || '');
      })
      .catch(() => setResumesError('Could not load your resumes.'));
  }, []);

  async function handleOptimize() {
    if (!selectedResumeId) {
      setSetupError('Choose a resume first.');
      return;
    }
    setOptimizing(true);
    setSetupError(null);
    setPlanLimitError(null);
    try {
      const data = await linkedinApi.optimize(selectedResumeId, targetRole.trim() || undefined);
      setOptimization(data.optimization);
      setHeadlineDraft(data.optimization.headline);
      setSummaryDraft(data.optimization.summary);
      setSkillChecked(Object.fromEntries(data.optimization.skills.map((s) => [s, true])));
      setActiveTab('headline');
    } catch (err) {
      if (isPlanLimitError(err)) {
        setPlanLimitError(err.message);
      } else {
        setSetupError(err instanceof ApiError ? err.message : 'Could not optimize your LinkedIn profile right now. Please try again.');
      }
    } finally {
      setOptimizing(false);
    }
  }

  const selectedSkills = optimization?.skills.filter((s) => skillChecked[s]) ?? [];

  function copyAllText(): string {
    if (!optimization) return '';
    const parts: string[] = [];
    parts.push(`Headline:\n${headlineDraft}`);
    parts.push(`About:\n${summaryDraft}`);
    if (optimization.experienceBlurbs.length) {
      const experience = optimization.experienceBlurbs
        .map((exp) => `${exp.title} — ${exp.company}\n${exp.bullets.map((b) => `• ${b}`).join('\n')}`)
        .join('\n\n');
      parts.push(`Experience:\n${experience}`);
    }
    if (optimization.skills.length) {
      parts.push(`Skills:\n${optimization.skills.join(', ')}`);
    }
    return parts.join('\n\n');
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-8 max-w-4xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Linkedin size={22} className="text-sky-400" />
              LinkedIn Optimizer
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Turn your resume into a keyword-rich LinkedIn headline, About section, experience bullets, and skills — plus a quick audit of profile gaps.
            </p>
          </div>
          {optimization && (
            <CopyButton text={copyAllText()} label="Copy all to clipboard" className="shrink-0" />
          )}
        </div>

        {!planAllowsFeature ? (
          <UpgradePrompt feature="LinkedIn Optimizer" requiredPlan="PREMIUM" />
        ) : planLimitError ? (
          <UpgradePrompt feature="LinkedIn Optimizer" requiredPlan="PREMIUM" message={planLimitError} />
        ) : (
        <>
        {/* Setup */}
        <GlassCard className="mb-6">
          {optimizing ? (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <Loader2 size={28} className="animate-spin text-sky-400" />
              <p className="text-sm text-muted-foreground">Optimizing your LinkedIn profile…</p>
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
                <label className="text-sm font-medium">
                  Target role <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Senior Product Manager"
                  className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {setupError && <p className="text-sm text-destructive">{setupError}</p>}

              <Button onClick={handleOptimize} disabled={resumes?.length === 0} className="w-full">
                <Sparkles size={16} className="mr-1.5" /> Optimize my LinkedIn
              </Button>
            </div>
          )}
        </GlassCard>

        {/* Results */}
        {optimization && !optimizing && (
          <div>
            {/* Tab bar — same layoutId-animated pill pattern as AppShell's nav */}
            <nav className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/50 mb-6 overflow-x-auto">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'relative flex items-center px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                      isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="linkedin-tab-pill"
                        className="absolute inset-0 bg-background rounded-lg shadow-sm border border-border/50"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {/* Tab 1 — Headline & About */}
                {activeTab === 'headline' && (
                  <div className="space-y-6">
                    <GlassCard>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium">Headline</label>
                        <CopyButton text={headlineDraft} />
                      </div>
                      <textarea
                        value={headlineDraft}
                        onChange={(e) => setHeadlineDraft(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base font-medium resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <p className={cn('text-xs mt-1.5 text-right', headlineDraft.length > HEADLINE_MAX ? 'text-destructive' : 'text-muted-foreground')}>
                        {headlineDraft.length} / {HEADLINE_MAX}
                      </p>
                    </GlassCard>

                    <GlassCard>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium">About</label>
                        <CopyButton text={summaryDraft} />
                      </div>
                      <textarea
                        value={summaryDraft}
                        onChange={(e) => setSummaryDraft(e.target.value)}
                        rows={12}
                        className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <p className={cn('text-xs mt-1.5 text-right', summaryDraft.length > SUMMARY_MAX ? 'text-destructive' : 'text-muted-foreground')}>
                        {summaryDraft.length} / {SUMMARY_MAX}
                      </p>
                    </GlassCard>
                  </div>
                )}

                {/* Tab 2 — Experience */}
                {activeTab === 'experience' && (
                  <div className="space-y-6">
                    {optimization.experienceBlurbs.length === 0 && (
                      <p className="text-sm text-muted-foreground">No experience bullets were generated.</p>
                    )}
                    {optimization.experienceBlurbs.map((exp, i) => (
                      <GlassCard key={i}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-start gap-2">
                            <Briefcase size={18} className="text-sky-400 mt-0.5 shrink-0" />
                            <div>
                              <h3 className="text-base font-semibold">{exp.title}</h3>
                              <p className="text-sm text-muted-foreground">{exp.company}</p>
                            </div>
                          </div>
                          <CopyButton text={exp.bullets.map((b) => `• ${b}`).join('\n')} label="Copy all bullets" className="shrink-0" />
                        </div>
                        <ul className="space-y-2">
                          {exp.bullets.map((bullet, bi) => (
                            <li key={bi} className="flex items-start justify-between gap-2 text-sm">
                              <span className="text-muted-foreground">• {bullet}</span>
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(bullet)}
                                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Copy bullet"
                              >
                                <Copy size={14} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </GlassCard>
                    ))}
                  </div>
                )}

                {/* Tab 3 — Skills */}
                {activeTab === 'skills' && (
                  <GlassCard>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold">Top skills to add</h3>
                      <CopyButton text={selectedSkills.join(', ')} label="Copy selected skills" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {optimization.skills.map((skill) => (
                        <label
                          key={skill}
                          className={cn(
                            'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer transition-colors',
                            skillChecked[skill] ? 'border-sky-500/50 bg-sky-500/10 text-foreground' : 'border-input bg-background text-muted-foreground',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={!!skillChecked[skill]}
                            onChange={(e) => setSkillChecked((prev) => ({ ...prev, [skill]: e.target.checked }))}
                            className="accent-sky-500"
                          />
                          <span className="truncate">{skill}</span>
                        </label>
                      ))}
                    </div>
                  </GlassCard>
                )}

                {/* Tab 4 — Recommendations */}
                {activeTab === 'recommendations' && (
                  <div className="space-y-4">
                    {optimization.recommendations.length === 0 && (
                      <p className="text-sm text-muted-foreground">No specific recommendations — your profile inputs looked solid.</p>
                    )}
                    {optimization.recommendations.map((rec, i) => (
                      <GlassCard key={i}>
                        <span className={cn('inline-block px-2.5 py-1 rounded-full text-xs font-semibold mb-3', badgeStyleFor(rec.section))}>
                          {rec.section}
                        </span>
                        <p className="flex items-start gap-1.5 text-sm text-amber-400 mb-2">
                          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                          <span>{rec.issue}</span>
                        </p>
                        <p className="flex items-start gap-1.5 text-sm text-emerald-400">
                          <Lightbulb size={15} className="mt-0.5 shrink-0" />
                          <span>{rec.fix}</span>
                        </p>
                      </GlassCard>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <Button variant="outline" onClick={() => setOptimization(null)} className="w-full mt-6">
              <RotateCcw size={16} className="mr-1.5" /> Start Over
            </Button>
          </div>
        )}
        </>
        )}
      </div>
    </AppShell>
  );
}
