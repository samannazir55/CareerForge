import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  Sparkles,
  FileText,
  LayoutTemplate,
  Download,
  History,
  Target,
  FileSearch,
  Mail,
  Share2,
  Coins,
  UserCircle,
  KeyRound,
  MessagesSquare,
  Linkedin,
  ClipboardList,
  Compass,
  ArrowRight,
  Clock,
  Menu,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { FloatingSquares } from '../../components/welcome/FloatingSquares';
import { CoverflowGallery } from '../../components/welcome/CoverflowGallery';
import { type FeatureItem } from '../../components/welcome/FeatureCard';
import { Button } from '../../components/ui/Button';
import { ALL_POSTS, CATEGORY_LABELS } from '../../blog';
import { SocialLinks } from '../../components/social/SocialLinks';

const FEATURES: FeatureItem[] = [
  { icon: Sparkles, title: 'AI Chat Resume Builder', description: 'Build your resume by chatting — the AI gathers your story and drafts it live.', status: 'live', accent: 'indigo' },
  { icon: FileText, title: 'Schema-Driven Editor', description: 'Unlimited custom sections — awards, patents, volunteer work, anything you need.', status: 'live', accent: 'purple' },
  { icon: LayoutTemplate, title: 'Template Marketplace', description: 'Free and premium templates, unlocked with points or a subscription.', status: 'live', accent: 'pink' },
  { icon: Download, title: 'PDF & DOCX Export', description: 'Pixel-faithful exports rendered server-side — what you see is what you download.', status: 'live', accent: 'cyan' },
  { icon: History, title: 'Version History', description: 'Every save is a snapshot. Compare, restore, never lose a draft.', status: 'live', accent: 'indigo' },
  { icon: Target, title: 'ATS Score Analysis', description: 'AI-scored compatibility with applicant tracking systems, with concrete fixes.', status: 'live', accent: 'purple' },
  { icon: FileSearch, title: 'Job Description Matching', description: 'Paste a job post — see exactly how well you match and what to adjust.', status: 'live', accent: 'pink' },
  { icon: Mail, title: 'AI Cover Letters', description: 'Generated from your resume and the job post, tuned to the tone you want.', status: 'live', accent: 'cyan' },
  { icon: Share2, title: 'Shareable Resume Links', description: 'A public link to your resume — enable or disable it anytime.', status: 'live', accent: 'indigo' },
  { icon: Coins, title: 'Points & Rewards', description: 'Earn points for profile completion and activity, spend them on premium templates.', status: 'live', accent: 'purple' },
  { icon: UserCircle, title: 'Career Profile', description: 'A living knowledge base of your career facts that powers every AI feature.', status: 'live', accent: 'pink' },
  { icon: KeyRound, title: 'Google & GitHub Sign-In', description: 'One-click auth, plus email/password with OTP verification.', status: 'live', accent: 'cyan' },
  { icon: MessagesSquare, title: 'Interview Preparation', description: 'AI mock interviews tailored to your target role, with feedback.', status: 'live', accent: 'indigo' },
  { icon: Linkedin, title: 'LinkedIn Optimizer', description: 'Turn your resume into a profile that actually gets recruiter attention.', status: 'live', accent: 'purple' },
  { icon: ClipboardList, title: 'Job Application Tracker', description: 'Track every application, status, and follow-up in one board.', status: 'live', accent: 'pink' },
  { icon: Compass, title: 'AI Career Coach', description: 'Ongoing guidance on your career path, skills gaps, and next moves.', status: 'live', accent: 'cyan' },
];

export function WelcomePage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const recentPosts = ALL_POSTS.slice(0, 3);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.9]);
  const heroBlurPx = useTransform(scrollYProgress, [0, 1], [0, 8]);
  const heroFilter = useTransform(heroBlurPx, (b) => `blur(${b}px)`);
  const bgY = useTransform(scrollYProgress, [0, 1], [0, -100]);

  const { scrollYProgress: navProgress } = useScroll({ target: pageRef, offset: ['start start', '200px start'] });
  const navBg = useTransform(navProgress, [0, 1], ['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.45)']);
  const navBlurPx = useTransform(navProgress, [0, 1], [6, 18]);
  const navBackdrop = useTransform(navBlurPx, (b) => `blur(${b}px)`);

  // Deliberately no auto-redirect here: the welcome page always renders,
  // regardless of auth status. Clicking through to "Get Started" or "I have
  // an account" (i.e. /register or /login) is what sends an already
  // signed-in, verified user straight on to /dashboard — see the guard at
  // the top of those two pages.

  return (
    <div ref={pageRef} className="welcome-page min-h-screen w-full overflow-x-hidden">
      {/* Top nav */}
      <motion.header
        style={{ backgroundColor: navBg, backdropFilter: navBackdrop }}
        className="sticky top-0 z-30 border-b border-white/5"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 py-4">
          <span className="font-semibold text-lg tracking-tight">
            <span className="text-gradient">Corvyx</span>
          </span>

          {/* Full nav — visible from md up, where there's room for all 5 items */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/blog">
              <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                Blog
              </Button>
            </Link>
            <Link to="/about">
              <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                About
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

          {/* Mobile nav — below md, only the primary CTA + a hamburger toggle
              stay in the header row, so there's never a horizontal overflow
              pushing "Get started" off-screen. */}
          <div className="flex md:hidden items-center gap-2">
            <Link to="/register">
              <Button size="sm" className="bg-white text-black hover:bg-white/90">
                Get started
              </Button>
            </Link>
            <button
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileNavOpen}
              className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden border-t border-white/5 bg-black/80 backdrop-blur-xl px-4 py-3 flex flex-col gap-1">
            <Link to="/blog" onClick={() => setMobileNavOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10">
                Blog
              </Button>
            </Link>
            <Link to="/about" onClick={() => setMobileNavOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10">
                About
              </Button>
            </Link>
            <Link to="/pricing" onClick={() => setMobileNavOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10">
                Pricing
              </Button>
            </Link>
            <Link to="/login" onClick={() => setMobileNavOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10">
                Log in
              </Button>
            </Link>
          </div>
        )}
      </motion.header>

      {/* Hero */}
      <section ref={heroRef} className="relative min-h-[88vh] flex items-center justify-center px-6 pt-10 pb-24">
        <motion.div style={{ y: bgY }} className="absolute inset-0">
          <FloatingSquares count={18} />
        </motion.div>

        <motion.div
          style={{ opacity: heroOpacity, y: heroY, scale: heroScale, filter: heroFilter }}
          className="relative z-10 max-w-3xl mx-auto text-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 mb-6"
          >
            <Sparkles size={12} className="text-indigo-300" />
            Land it. Don't just apply.
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-6xl font-bold tracking-tight neon-glow-text mb-5"
          >
            Build a resume that
            <br />
            <span className="text-gradient">actually gets you hired</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white/60 text-base sm:text-lg max-w-xl mx-auto mb-9"
          >
            Corvyx is an AI career platform — chat your resume into existence, optimize it
            against real job posts, and export it polished. One platform, your whole career.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link to="/register">
              <Button size="lg" className="bg-white text-black hover:bg-white/90 group">
                Start building free
                <ArrowRight size={16} className="ml-1.5 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="border-white/15 text-white/90 hover:bg-white/10">
                I have an account
              </Button>
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="text-xs text-white/30 mt-6"
          >
            No credit card required · Free templates included
          </motion.p>
        </motion.div>
      </section>

      {/* Feature coverflow */}
      <section className="relative px-6 pb-28">
        <div className="max-w-6xl mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Everything your career needs</h2>
            <p className="text-white/50 text-sm max-w-md mx-auto">
              Some of this is live today. Some is on the way. All of it lives in one place.
            </p>
          </motion.div>
        </div>

        <div className="max-w-5xl mx-auto">
          <CoverflowGallery features={FEATURES} />
        </div>
      </section>

      {/* From the blog */}
      {recentPosts.length > 0 && (
        <section className="relative px-6 pb-24">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
              className="flex items-end justify-between mb-8"
            >
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-2">From the blog</h2>
                <p className="text-white/50 text-sm">Resume tips, interview prep, and career advice.</p>
              </div>
              <Link to="/blog" className="hidden sm:flex items-center gap-1 text-sm text-white/60 hover:text-white transition-colors">
                View all <ArrowRight size={14} />
              </Link>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {recentPosts.map((post, i) => (
                <motion.div
                  key={post.slug}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                >
                  <Link
                    to={`/blog/${post.slug}`}
                    className="group flex flex-col h-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-white/20 hover:bg-white/[0.05] transition-colors"
                  >
                    <span className="text-[11px] font-medium uppercase tracking-wide text-white/40 mb-2">
                      {CATEGORY_LABELS[post.category]}
                    </span>
                    <h3 className="font-semibold text-white text-sm leading-snug mb-2 group-hover:text-indigo-300 transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-xs text-white/50 line-clamp-2 mb-4 flex-1">{post.description}</p>
                    <span className="flex items-center gap-1 text-[11px] text-white/40">
                      <Clock size={11} /> {post.readTime} min read
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="relative px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          whileHover={{ boxShadow: '0 0 60px rgba(129,140,248,0.25)' }}
          className="max-w-3xl mx-auto text-center rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-12"
        >
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to forge your next role?</h2>
          <p className="text-white/50 text-sm mb-8 max-w-md mx-auto">
            Create an account in under a minute and have a draft resume before your coffee gets cold.
          </p>
          <Link to="/register">
            <Button size="lg" className="bg-white text-black hover:bg-white/90 group">
              Get started — it's free
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
        <SocialLinks className="mb-4" />
        © {new Date().getFullYear()} Corvyx. Built for people building careers.
      </footer>
    </div>
  );
}