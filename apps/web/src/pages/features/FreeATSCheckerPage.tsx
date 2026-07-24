import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { SEO } from '../../components/seo/SEO';
import { aiApi, ApiError } from '../../lib/api';
import { SocialLinks } from '../../components/social/SocialLinks';

interface ATSResult {
  score: number;
  missingKeywords: string[];
  missingSections: string[];
  suggestions: string[];
}

function ringColor(score: number): string {
  if (score < 50) return '#f87171'; // red
  if (score < 75) return '#fbbf24'; // amber
  return '#4ade80'; // green
}

function ScoreRing({ score }: { score: number }) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(score, 0), 100) / 100) * circumference;
  const color = ringColor(score);

  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg viewBox="0 0 150 150" className="w-full h-full -rotate-90">
        <circle cx="75" cy="75" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle
          cx="75"
          cy="75"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-white">{Math.round(score)}</span>
        <span className="text-xs text-white/40">/ 100</span>
      </div>
    </div>
  );
}

export function FreeATSCheckerPage() {
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ATSResult | null>(null);

  async function handleCheck() {
    if (!resumeText.trim()) {
      setError('Paste your resume text first.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await aiApi.scoreATSPublic(resumeText, jobDescription.trim() || undefined);
      setResult(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong scoring your resume. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="welcome-page min-h-screen w-full overflow-x-hidden">
      <SEO
        title="Free ATS Resume Checker — Instant Score"
        description="75% of CVs are rejected by ATS software before a human reads them. Check your CV's ATS score free in 30 seconds. No account needed, instant results."
        canonical="/free-ats-checker"
      />

      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-black/30 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="font-semibold text-lg tracking-tight">
            <span className="text-gradient">Corvyx</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                Log in
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="bg-white text-black hover:bg-white/90">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-16 pb-24">
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight neon-glow-text mb-4">
            Free ATS Resume Checker
          </h1>
          <p className="text-white/60 max-w-xl mx-auto">
            Paste your resume — and optionally a job description — to get an instant ATS compatibility score.
            No account needed.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="resumeText" className="block text-sm font-medium text-white/70 mb-1.5">
              Paste your resume
            </label>
            <textarea
              id="resumeText"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              rows={12}
              placeholder="Paste the full text of your resume here…"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
            />
          </div>
          <div>
            <label htmlFor="jobDescription" className="block text-sm font-medium text-white/70 mb-1.5">
              Paste the job description (optional)
            </label>
            <textarea
              id="jobDescription"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={12}
              placeholder="Paste a job description to score against a specific role…"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-400 mb-4 text-center">
            {error}
          </p>
        )}

        <div className="flex justify-center mb-14">
          <Button
            size="lg"
            onClick={handleCheck}
            disabled={loading}
            className="bg-white text-black hover:bg-white/90 group"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="mr-1.5 animate-spin" />
                Checking…
              </>
            ) : (
              <>
                Check my ATS score
                <ArrowRight size={16} className="ml-1.5 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </Button>
        </div>

        {result && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
            <ScoreRing score={result.score} />

            {result.missingKeywords.length > 0 && (
              <div className="mt-8">
                <h2 className="text-sm font-semibold text-white/70 mb-3">Missing keywords</h2>
                <div className="flex flex-wrap gap-2">
                  {result.missingKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="text-xs px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-white/70"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.suggestions.length > 0 && (
              <div className="mt-8">
                <h2 className="text-sm font-semibold text-white/70 mb-3">Improvement suggestions</h2>
                <ul className="space-y-2">
                  {result.suggestions.slice(0, 3).map((s, i) => (
                    <li key={i} className="text-sm text-white/70 leading-relaxed flex gap-2">
                      <span className="text-indigo-300 mt-0.5">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-10 pt-8 border-t border-white/10 text-center">
              <p className="text-white/60 text-sm mb-4">
                Want the full analysis with keyword suggestions, job matching, and AI tailoring?
              </p>
              <Link to="/register">
                <Button className="bg-white text-black hover:bg-white/90 group">
                  Create your free Corvyx account
                  <ArrowRight size={16} className="ml-1.5 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-white/5 px-6 py-8 text-center text-xs text-white/30">
        <SocialLinks className="mb-4" />
        © {new Date().getFullYear()} Corvyx. Built for people building careers.
      </footer>
    </div>
  );
}
