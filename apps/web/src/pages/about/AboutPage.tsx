import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { SEO } from '../../components/seo/SEO';
import { SocialLinks } from '../../components/social/SocialLinks';

interface FeatureBlock {
  title: string;
  description: string;
  href?: string;
}

// Kept in sync with the real, live feature set (see FEATURES in
// WelcomePage.tsx and llms.txt) — this page is read by AI crawlers as a
// factual description of the product, so it should never claim a feature
// that isn't actually shipped.
const FEATURE_BLOCKS: FeatureBlock[] = [
  {
    title: 'AI Resume Builder',
    description:
      'Build a resume by chatting — the AI asks about your experience, education, and skills one topic at a time and drafts each section live as you answer.',
    href: '/features/resume-builder',
  },
  {
    title: 'ATS Resume Checker',
    description:
      'Scores a resume for compatibility with the applicant tracking systems recruiters use, and points out exactly which keywords and sections are missing.',
    href: '/features/ats-checker',
  },
  {
    title: 'Job Description Matching & Resume Tailoring',
    description:
      'Paste a job posting and see how closely a resume matches it, then generate a tailored copy rewritten toward that specific role without inventing experience.',
  },
  {
    title: 'AI Cover Letter Generator',
    description: 'Produces a cover letter from a resume and a target job description, in a tone you choose.',
  },
  {
    title: 'Interview Preparation',
    description:
      'Generates role-specific interview questions, gives AI feedback on your answers, and tracks progress across practice sessions.',
    href: '/features/interview-prep',
  },
  {
    title: 'LinkedIn Profile Optimizer',
    description: "Rewrites a LinkedIn headline, About section, and experience bullets to improve a profile's recruiter search visibility.",
    href: '/features/linkedin-optimizer',
  },
  {
    title: 'AI Career Coach',
    description: 'Ongoing chat-based coaching on career direction, skill gaps, and next moves.',
    href: '/features/career-coach',
  },
  {
    title: 'Job Application Tracker',
    description: 'A kanban board that tracks every application through Wishlist, Applied, Interview, and Offer stages.',
    href: '/features/job-tracker',
  },
  {
    title: 'Job Search',
    description: 'Real job listings with one-click add to the tracker and instant resume tailoring for any listing.',
  },
  {
    title: 'Public Career Portfolio',
    description: 'A shareable public profile page showcasing resumes, skills, and career highlights.',
  },
  {
    title: 'Template Marketplace',
    description: 'A library of free and premium resume templates, exportable as pixel-faithful PDF or DOCX.',
  },
];

const AUDIENCE = [
  'Recent graduates entering the job market',
  'Professionals making a career change',
  'Developers, designers, marketers, and product managers looking for new roles',
  "Anyone who hasn't updated their resume in years",
  'Anyone who wants AI to do the heavy lifting on their job search',
];

export function AboutPage() {
  return (
    <div className="welcome-page min-h-screen w-full overflow-x-hidden">
      <SEO
        title="About Corvyx"
        description="Corvyx is an AI-powered career platform combining resume building, ATS checking, interview prep, job tracking, LinkedIn optimization and career coaching in one place."
        canonical="/about"
      />

      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-black/30 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="font-semibold text-lg tracking-tight">
            <span className="text-gradient">Corvyx</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/blog">
              <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                Blog
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                Pricing
              </Button>
            </Link>
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
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight neon-glow-text mb-8">
          About Corvyx — The AI Career Platform
        </h1>

        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-4">What is Corvyx?</h2>
          <p className="text-white/70 leading-relaxed">
            Corvyx is an AI-powered career platform built for job seekers, career changers, and professionals
            who want to stay ahead. Unlike single-purpose resume builders, Corvyx covers the entire job search
            lifecycle in one place: building your resume, tailoring it to specific jobs, checking it against
            ATS filters, preparing for interviews, optimizing your LinkedIn profile, tracking applications,
            and getting ongoing career coaching from AI.
          </p>
        </section>

        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-6">What Corvyx does</h2>
          <div className="space-y-6">
            {FEATURE_BLOCKS.map((f) => (
              <div key={f.title}>
                <h3 className="text-lg font-semibold text-white mb-1.5">
                  {f.href ? (
                    <Link to={f.href} className="hover:text-indigo-300 transition-colors underline decoration-white/20 underline-offset-4">
                      {f.title}
                    </Link>
                  ) : (
                    f.title
                  )}
                </h3>
                <p className="text-white/60 text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-4">Who is Corvyx for?</h2>
          <ul className="space-y-2">
            {AUDIENCE.map((a) => (
              <li key={a} className="text-white/70 leading-relaxed flex gap-2">
                <span className="text-indigo-300 mt-1">•</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-4">Corvyx vs other resume builders</h2>
          <p className="text-white/70 leading-relaxed">
            Unlike resume builders that focus only on templates, Corvyx combines resume building with ATS
            checking, interview prep, job tracking, LinkedIn optimization, and career coaching, so a person's
            whole job search lives in one place instead of being split across separate tools. Unlike using a
            general-purpose AI chat assistant directly, Corvyx is purpose-built for careers, with structured
            resume templates, ATS analysis, and job-specific tailoring built in rather than assembled by hand
            in a chat window.
          </p>
        </section>

        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-4">Pricing</h2>
          <div className="space-y-4">
            <p className="text-white/70 leading-relaxed">
              <span className="font-semibold text-white">Free</span> — 3 resumes, 2 templates, basic ATS
              scoring, and 5 AI messages a day. No credit card required.
            </p>
            <p className="text-white/70 leading-relaxed">
              <span className="font-semibold text-white">Professional ($9/month)</span> — 10 resumes, the full
              template library, full ATS analysis, cover letters, the job tracker, interview prep, and job
              search.
            </p>
            <p className="text-white/70 leading-relaxed">
              <span className="font-semibold text-white">Premium ($19/month)</span> — unlimited resumes and AI
              usage, plus the LinkedIn optimizer and AI career coach.
            </p>
            <p className="text-white/40 text-xs">
              See live, current pricing and full feature breakdowns on the{' '}
              <Link to="/pricing" className="underline hover:text-white/70">
                pricing page
              </Link>
              .
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">Get started</h2>
          <p className="text-white/70 leading-relaxed mb-6">
            Create a free account and have a draft resume before your coffee gets cold.
          </p>
          <Link to="/register">
            <Button size="lg" className="bg-white text-black hover:bg-white/90 group">
              Start building free
              <ArrowRight size={16} className="ml-1.5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
        </section>
      </main>

      <footer className="border-t border-white/5 px-6 py-8 text-center text-xs text-white/30">
        <SocialLinks className="mb-4" />
        © {new Date().getFullYear()} Corvyx. Built for people building careers.
      </footer>
    </div>
  );
}
