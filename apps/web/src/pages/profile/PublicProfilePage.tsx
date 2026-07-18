import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Linkedin, Github, Twitter, Globe, MapPin, Eye, ArrowUpRight, FileText } from 'lucide-react';
import { fetchPublicProfile } from '../../lib/profileApi';
import { sharingApi, ApiError } from '../../lib/api';
import { FloatingSquares } from '../../components/welcome/FloatingSquares';
import type { PublicProfile } from '@careerforge/schema';

/**
 * Publicly accessible at /u/:slug — no auth, no AppShell. Uses the same
 * dark/neon visual language as WelcomePage (via the shared .welcome-page
 * CSS scope) rather than the app's light glassmorphism shell, since this
 * is the identity a user hands to a recruiter, not an in-app screen.
 */
export function PublicProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);
    setNotFound(false);
    fetchPublicProfile(slug)
      .then(setProfile)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) {
          setNotFound(true);
        }
      })
      .finally(() => setIsLoading(false));
  }, [slug]);

  if (isLoading) {
    return (
      <div className="welcome-page min-h-screen w-full flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="welcome-page min-h-screen w-full flex flex-col items-center justify-center px-6 text-center">
        <p className="text-2xl font-bold mb-2">This profile isn't available</p>
        <p className="text-white/50 text-sm mb-8 max-w-sm">
          The link may be mistyped, or the person hasn't published a public portfolio.
        </p>
        <Link to="/" className="text-sm text-white/70 hover:text-white underline underline-offset-4">
          Go to Corvyx
        </Link>
      </div>
    );
  }

  const initial = (profile.fullName ?? '?').trim().charAt(0).toUpperCase();

  const socialLinks = [
    { url: profile.linkedinUrl, icon: Linkedin, label: 'LinkedIn' },
    { url: profile.githubUrl, icon: Github, label: 'GitHub' },
    { url: profile.twitterUrl, icon: Twitter, label: 'Twitter' },
    { url: profile.website, icon: Globe, label: 'Website' },
  ].filter((s): s is { url: string; icon: typeof Linkedin; label: string } => Boolean(s.url));

  return (
    <div className="welcome-page min-h-screen w-full overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <FloatingSquares count={10} />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-16 sm:py-24">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <div className="mx-auto mb-5 h-24 w-24 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-3xl font-bold shadow-lg shadow-indigo-500/20">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.fullName ?? 'Profile photo'} className="h-full w-full object-cover" />
            ) : (
              <span>{initial}</span>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-1.5">{profile.fullName ?? 'Someone at Corvyx'}</h1>

          {profile.headline && <p className="text-white/70 text-base sm:text-lg mb-2">{profile.headline}</p>}

          {profile.location && (
            <p className="text-white/40 text-sm flex items-center justify-center gap-1.5 mb-4">
              <MapPin size={13} /> {profile.location}
            </p>
          )}

          {profile.isPublic && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Available for opportunities
            </span>
          )}

          {socialLinks.length > 0 && (
            <div className="flex items-center justify-center gap-2.5 mt-1">
              {socialLinks.map(({ url, icon: Icon, label }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          )}
        </motion.section>

        {/* About */}
        {profile.bio && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5 }}
            className="mb-14"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40 mb-3">About</h2>
            <p className="text-white/80 leading-relaxed whitespace-pre-line">{profile.bio}</p>
          </motion.section>
        )}

        {/* Resumes */}
        {profile.publicResumes.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5 }}
            className="mb-14"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">Resumes</h2>
              {profile.totalResumeViews > 0 && (
                <span className="text-xs text-white/30 flex items-center gap-1.5">
                  <Eye size={12} /> {profile.totalResumeViews} total views
                </span>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {profile.publicResumes.map((resume) => (
                <a
                  key={resume.id}
                  href={sharingApi.publicUrl(resume.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.06] hover:border-white/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="h-9 w-9 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-indigo-300" />
                    </div>
                    <ArrowUpRight size={15} className="text-white/30 group-hover:text-white/70 transition-colors" />
                  </div>
                  <p className="font-semibold text-sm mb-1">{resume.title}</p>
                  <p className="text-xs text-white/40 mb-3">{resume.templateName} template</p>
                  <p className="text-xs text-white/30 flex items-center gap-1.5">
                    <Eye size={12} /> {resume.viewCount} view{resume.viewCount === 1 ? '' : 's'}
                  </p>
                </a>
              ))}
            </div>
          </motion.section>
        )}

        {/* Skills */}
        {profile.skills.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5 }}
            className="mb-14"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40 mb-3">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/80"
                >
                  {skill}
                </span>
              ))}
            </div>
          </motion.section>
        )}

        {/* Footer */}
        <footer className="text-center pt-8 border-t border-white/5">
          <Link to="/" className="text-xs text-white/30 hover:text-white/60 transition-colors">
            Built with <span className="text-gradient font-semibold">Corvyx</span>
          </Link>
        </footer>
      </div>
    </div>
  );
}
