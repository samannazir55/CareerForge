import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { SEO } from '../../components/seo/SEO';

export interface FeaturePageContent {
  /** URL slug, e.g. "resume-builder" — page lives at /features/{slug}. */
  slug: string;
  /** H1 / hero heading. */
  title: string;
  /** One-line hero subhead. */
  tagline: string;
  /** <title>/meta description — keep under ~155 chars. */
  seoDescription: string;
  /** 2-4 sentence "what it is" paragraph, dense and factual for both
   * human readers and AI crawlers. */
  overview: string;
  /** "How it works" steps. */
  steps: { title: string; description: string }[];
  /** Short bullet list of who this is for. */
  whoItsFor: string[];
  /** Optional note about plan availability, e.g. "Premium feature". */
  planNote?: string;
  /** Optional secondary CTA, e.g. linking to the free ATS checker tool. */
  secondaryCta?: { label: string; to: string };
}

export function FeaturePageLayout({ content }: { content: FeaturePageContent }) {
  return (
    <div className="welcome-page min-h-screen w-full overflow-x-hidden">
      <SEO title={content.title} description={content.seoDescription} canonical={`/features/${content.slug}`} />

      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-black/30 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="font-semibold text-lg tracking-tight">
            <span className="text-gradient">Corvyx</span>
          </Link>
          <div className="flex items-center gap-3">
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
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight neon-glow-text mb-3">{content.title}</h1>
        <p className="text-white/60 text-lg mb-10">{content.tagline}</p>

        <section className="mb-14">
          <p className="text-white/70 leading-relaxed">{content.overview}</p>
          {content.planNote && (
            <p className="mt-4 text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/10 text-indigo-300">
              {content.planNote}
            </p>
          )}
        </section>

        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-6">How it works</h2>
          <div className="space-y-6">
            {content.steps.map((s, i) => (
              <div key={s.title} className="flex gap-4">
                <div className="shrink-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm font-semibold text-white/70">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{s.title}</h3>
                  <p className="text-white/60 text-sm leading-relaxed">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-4">Who it's for</h2>
          <ul className="space-y-2">
            {content.whoItsFor.map((w) => (
              <li key={w} className="text-white/70 leading-relaxed flex gap-2">
                <span className="text-indigo-300 mt-1">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col sm:flex-row items-center gap-3">
          <Link to="/register">
            <Button size="lg" className="bg-white text-black hover:bg-white/90 group">
              Start building free
              <ArrowRight size={16} className="ml-1.5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
          {content.secondaryCta && (
            <Link to={content.secondaryCta.to}>
              <Button size="lg" variant="outline" className="border-white/15 text-white/90 hover:bg-white/10">
                {content.secondaryCta.label}
              </Button>
            </Link>
          )}
        </section>
      </main>
    </div>
  );
}
