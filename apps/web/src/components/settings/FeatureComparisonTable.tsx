import { PLAN_LIMITS, type Tier } from '@careerforge/schema';
import { Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';

const TIERS: { id: Tier; label: string }[] = [
  { id: 'FREE', label: 'Free' },
  { id: 'PROFESSIONAL', label: 'Professional' },
  { id: 'PREMIUM', label: 'Premium' },
];

function fmtCount(n: number, suffix?: string): string {
  if (n === Infinity) return 'Unlimited';
  if (n === 0) return '✗';
  return suffix ? `${n}${suffix}` : String(n);
}

function BoolCell({ value }: { value: boolean }) {
  return value ? (
    <Check size={16} className="text-emerald-400 mx-auto" />
  ) : (
    <X size={16} className="text-muted-foreground/50 mx-auto" />
  );
}

// Row definitions read straight from PLAN_LIMITS wherever the value is
// self-explanatory, with a few tier-specific display strings (e.g.
// "All 570", "Basic"/"Full") for numbers that don't mean anything as a
// bare integer. Keeping this file the single place the *display* of a
// limit lives, while PLAN_LIMITS itself (imported, never re-typed) stays
// the single place the *value* of a limit lives — the same split
// SettingsPage.tsx already uses for pricing vs. feature gates.
const ROWS: { label: string; render: (tier: Tier) => string | JSX.Element }[] = [
  { label: 'Resumes', render: (t) => fmtCount(PLAN_LIMITS[t].maxResumes) },
  {
    label: 'Templates',
    render: (t) => (PLAN_LIMITS[t].maxTemplates === Infinity ? 'All 570' : String(PLAN_LIMITS[t].maxTemplates)),
  },
  { label: 'PDF Export', render: () => <BoolCell value={true} /> },
  { label: 'DOCX Export', render: (t) => <BoolCell value={PLAN_LIMITS[t].docxExport} /> },
  { label: 'ATS Scoring', render: (t) => (PLAN_LIMITS[t].fullATS ? 'Full' : 'Basic') },
  { label: 'AI Chat', render: (t) => fmtCount(PLAN_LIMITS[t].aiMessagesPerDay, '/day') },
  { label: 'Cover Letters', render: (t) => fmtCount(PLAN_LIMITS[t].coverLettersPerMonth, '/month') },
  { label: 'Resume Tailoring', render: (t) => fmtCount(PLAN_LIMITS[t].tailoringPerMonth, '/month') },
  { label: 'Job Tracker', render: (t) => fmtCount(PLAN_LIMITS[t].maxJobTracker) },
  { label: 'Find Jobs', render: (t) => <BoolCell value={PLAN_LIMITS[t].findJobs} /> },
  { label: 'Interview Prep', render: (t) => fmtCount(PLAN_LIMITS[t].interviewSessionsPerMonth, '/month') },
  { label: 'LinkedIn Optimizer', render: (t) => <BoolCell value={PLAN_LIMITS[t].linkedinOptimizer} /> },
  { label: 'Career Coach', render: (t) => <BoolCell value={PLAN_LIMITS[t].careerCoach} /> },
  { label: 'Shareable Links', render: (t) => <BoolCell value={PLAN_LIMITS[t].shareableLinks} /> },
  { label: 'Public Portfolio', render: (t) => <BoolCell value={PLAN_LIMITS[t].publicPortfolio} /> },
  { label: 'Points on signup', render: (t) => String(PLAN_LIMITS[t].pointsOnSignup) },
  { label: 'Monthly points', render: (t) => String(PLAN_LIMITS[t].pointsPerMonth) },
];

export function FeatureComparisonTable({ currentTier }: { currentTier: Tier }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50 bg-muted/30">
            <th className="text-left font-medium py-3 px-4 text-muted-foreground">Feature</th>
            {TIERS.map((t) => (
              <th
                key={t.id}
                className={cn(
                  'text-center font-semibold py-3 px-4',
                  t.id === currentTier && 'text-indigo-400',
                )}
              >
                {t.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {ROWS.map((row) => (
            <tr key={row.label} className="hover:bg-muted/20">
              <td className="py-2.5 px-4 text-muted-foreground">{row.label}</td>
              {TIERS.map((t) => (
                <td
                  key={t.id}
                  className={cn('py-2.5 px-4 text-center', t.id === currentTier && 'bg-indigo-500/5 font-medium')}
                >
                  {row.render(t.id)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
