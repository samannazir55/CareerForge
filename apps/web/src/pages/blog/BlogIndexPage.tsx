import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { SEO } from '../../components/seo/SEO';
import { getPostsByCategory, CATEGORY_LABELS, type BlogCategory } from '../../blog';

const TABS: Array<{ value: BlogCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'resume', label: 'Resume' },
  { value: 'interview', label: 'Interview' },
  { value: 'career', label: 'Career' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'job-search', label: 'Job Search' },
  { value: 'ai-tools', label: 'AI Tools' },
];

// Cover-image placeholder: a gradient keyed off category, since posts don't
// ship real cover art. Keeps every card visually distinct without needing
// an image asset per post.
const CATEGORY_GRADIENT: Record<BlogCategory, string> = {
  resume: 'from-indigo-500/30 via-indigo-500/10 to-transparent',
  interview: 'from-purple-500/30 via-purple-500/10 to-transparent',
  career: 'from-pink-500/30 via-pink-500/10 to-transparent',
  linkedin: 'from-cyan-500/30 via-cyan-500/10 to-transparent',
  'job-search': 'from-emerald-500/30 via-emerald-500/10 to-transparent',
  'ai-tools': 'from-amber-500/30 via-amber-500/10 to-transparent',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function BlogIndexPage() {
  const [activeCategory, setActiveCategory] = useState<BlogCategory | 'all'>('all');
  const posts = getPostsByCategory(activeCategory);

  return (
    <div className="welcome-page min-h-screen w-full overflow-x-hidden">
      <SEO
        title="Career Advice Blog"
        description="Actionable resume tips, interview prep guides, LinkedIn advice and career growth strategies from the Corvyx team."
        canonical="/blog"
      />

      {/* Top nav — same treatment as WelcomePage's sticky header */}
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

      {/* Hero */}
      <section className="relative px-6 pt-16 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto text-center"
        >
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight neon-glow-text mb-4">
            The <span className="text-gradient">Corvyx</span> Career Blog
          </h1>
          <p className="text-white/60 text-base sm:text-lg max-w-xl mx-auto">
            Actionable advice on resumes, interviews, job searching, and career growth.
          </p>
        </motion.div>
      </section>

      {/* Category tabs */}
      <div className="max-w-6xl mx-auto px-6 mb-10">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveCategory(tab.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeCategory === tab.value
                  ? 'bg-white text-black border-white'
                  : 'border-white/15 text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Post grid */}
      <section className="max-w-6xl mx-auto px-6 pb-28">
        {posts.length === 0 ? (
          <p className="text-center text-white/50 py-16">No posts in this category yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post, i) => (
              <motion.div
                key={post.slug}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: (i % 3) * 0.05 }}
              >
                <Link
                  to={`/blog/${post.slug}`}
                  className="group flex flex-col h-full rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden hover:border-white/20 hover:bg-white/[0.05] transition-colors"
                >
                  <div className={`h-32 w-full bg-gradient-to-br ${CATEGORY_GRADIENT[post.category]} flex items-end p-4`}>
                    <span className="text-[11px] font-medium uppercase tracking-wide px-2.5 py-1 rounded-full bg-black/40 text-white/80 backdrop-blur-sm">
                      {CATEGORY_LABELS[post.category]}
                    </span>
                  </div>
                  <div className="flex flex-col flex-1 p-5">
                    <h2 className="font-semibold text-white mb-2 leading-snug group-hover:text-indigo-300 transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-sm text-white/50 mb-4 line-clamp-3 flex-1">{post.description}</p>
                    <div className="flex items-center gap-3 text-xs text-white/40">
                      <span>{formatDate(post.date)}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {post.readTime} min read
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Final CTA */}
      <section className="relative px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto text-center rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-6 sm:p-12"
        >
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to put this into practice?</h2>
          <p className="text-white/50 text-sm mb-8 max-w-md mx-auto">
            Build a resume with Corvyx's AI in minutes — free, no credit card required.
          </p>
          <Link to="/register">
            <Button size="lg" className="bg-white text-black hover:bg-white/90 group whitespace-nowrap">
              <span className="sm:hidden">Get started</span>
              <span className="hidden sm:inline">Get started — it's free</span>
              <ArrowRight size={16} className="ml-1.5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
        </motion.div>
      </section>

      <footer className="border-t border-white/5 px-6 py-8 text-center text-xs text-white/30">
        <div className="flex items-center justify-center gap-4 mb-3">
          <Link to="/privacy" className="hover:text-white/60">Privacy</Link>
          <Link to="/terms" className="hover:text-white/60">Terms</Link>
          <Link to="/refund-policy" className="hover:text-white/60">Refunds</Link>
        </div>
        © {new Date().getFullYear()} Corvyx. Built for people building careers.
      </footer>
    </div>
  );
}
