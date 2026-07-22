import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { SEO } from '../../components/seo/SEO';
import { getPost, getRelatedPosts, CATEGORY_LABELS } from '../../blog';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPost(slug) : undefined;

  if (!post) {
    return (
      <div className="welcome-page min-h-screen w-full flex flex-col items-center justify-center px-6 text-center">
        <SEO title="Post not found" description="This blog post doesn't exist." canonical="/blog" />
        <h1 className="text-3xl font-bold mb-3">Post not found</h1>
        <p className="text-white/50 mb-8">That article doesn't exist, or may have been moved.</p>
        <Link to="/blog">
          <Button className="bg-white text-black hover:bg-white/90">Back to the blog</Button>
        </Link>
      </div>
    );
  }

  const related = getRelatedPosts(post.slug, 3);

  return (
    <div className="welcome-page min-h-screen w-full overflow-x-hidden">
      <SEO title={post.title} description={post.description} canonical={`/blog/${post.slug}`} />

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

      <div className="max-w-6xl mx-auto px-6 pt-10 pb-6">
        <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors">
          <ArrowLeft size={14} /> Back to the blog
        </Link>
      </div>

      {/* Article header */}
      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl mx-auto px-6 mb-10"
      >
        <span className="inline-block text-[11px] font-medium uppercase tracking-wide px-2.5 py-1 rounded-full bg-white/10 text-white/70 mb-4">
          {CATEGORY_LABELS[post.category]}
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight neon-glow-text mb-4">{post.title}</h1>
        <p className="text-white/60 text-base sm:text-lg mb-5">{post.description}</p>
        <div className="flex items-center gap-3 text-sm text-white/40">
          <span>{post.author}</span>
          <span>·</span>
          <span>{formatDate(post.date)}</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Clock size={13} /> {post.readTime} min read
          </span>
        </div>
      </motion.header>

      {/* Body + sidebar TOC */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-12">
          <article
            className="prose-blog max-w-2xl"
            // Safe: content is our own controlled markdown files compiled at
            // build time, not user input — never fed with anything sourced
            // from a request.
            dangerouslySetInnerHTML={{ __html: post.html }}
          />

          {post.toc.length > 0 && (
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-3">On this page</p>
                <nav className="flex flex-col gap-2 text-sm border-l border-white/10">
                  {post.toc.map((entry) => (
                    <a
                      key={entry.id}
                      href={`#${entry.id}`}
                      className={`text-white/50 hover:text-white transition-colors border-l-2 border-transparent hover:border-indigo-400 -ml-px ${
                        entry.level === 3 ? 'pl-7' : 'pl-4'
                      }`}
                    >
                      {entry.text}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          )}
        </div>
      </section>

      {/* Related articles */}
      {related.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-20">
          <h2 className="text-xl font-bold mb-6">Related articles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {related.map((r) => (
              <Link
                key={r.slug}
                to={`/blog/${r.slug}`}
                className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-white/20 hover:bg-white/[0.05] transition-colors"
              >
                <span className="text-[11px] font-medium uppercase tracking-wide text-white/40 mb-2">
                  {CATEGORY_LABELS[r.category]}
                </span>
                <h3 className="font-semibold text-white text-sm leading-snug mb-2 group-hover:text-indigo-300 transition-colors">
                  {r.title}
                </h3>
                <p className="text-xs text-white/50 line-clamp-2">{r.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA banner */}
      <section className="relative px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto text-center rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-6 sm:p-12"
        >
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Build your resume with AI — free</h2>
          <p className="text-white/50 text-sm mb-8 max-w-md mx-auto">
            Chat your resume into existence, tailor it to any job, and export it polished.
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
