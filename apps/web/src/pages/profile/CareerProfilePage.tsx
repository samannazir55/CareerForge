import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Briefcase, GraduationCap, Zap, Target,
  Award, Globe, Plus, RefreshCw,
} from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { ProfileCompletionRing } from '../../components/profile/ProfileCompletionRing';
import { FactCard } from '../../components/profile/FactCard';
import { useProfileStore } from '../../store/profile.store';
import { fetchProfile, deleteFact } from '../../lib/profileApi';
import type { ProfileFactCategory } from '@careerforge/schema';

const CATEGORY_CONFIG: Array<{
  key: ProfileFactCategory;
  label: string;
  icon: React.ReactNode;
  emptyLabel: string;
}> = [
  { key: 'IDENTITY', label: 'Identity', icon: <User size={16} />, emptyLabel: 'Add your name, contact info, and headline' },
  { key: 'EXPERIENCE', label: 'Work Experience', icon: <Briefcase size={16} />, emptyLabel: 'Add your work history' },
  { key: 'EDUCATION', label: 'Education', icon: <GraduationCap size={16} />, emptyLabel: 'Add your education' },
  { key: 'SKILL', label: 'Skills', icon: <Zap size={16} />, emptyLabel: 'Add your skills' },
  { key: 'PROJECT', label: 'Projects', icon: <Globe size={16} />, emptyLabel: 'Add your projects' },
  { key: 'CERTIFICATION', label: 'Certifications', icon: <Award size={16} />, emptyLabel: 'Add certifications' },
  { key: 'GOAL', label: 'Career Goals', icon: <Target size={16} />, emptyLabel: 'Tell us your career goals' },
];

export function CareerProfilePage() {
  const navigate = useNavigate();
  const { profile, isLoading, error, setProfile, setLoading, setError, optimisticDeleteFact } =
    useProfileStore();
  const [activeCategory, setActiveCategory] = useState<ProfileFactCategory>('IDENTITY');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProfile();
      setProfile(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setProfile]);

  useEffect(() => {
    if (!profile) loadProfile();
  }, [profile, loadProfile]);

  const handleDelete = async (key: string) => {
    optimisticDeleteFact(key);
    try {
      await deleteFact(key);
    } catch {
      loadProfile();
    }
  };

  const activeFacts = (profile?.facts ?? []).filter((f) => f.category === activeCategory);
  const config = CATEGORY_CONFIG.find((c) => c.key === activeCategory);

  return (
    <AppShell>
      <div className="min-h-full bg-background p-6 md:p-10">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Career Profile</h1>
              <p className="text-muted-foreground mt-1">
                Your career knowledge base — the AI reads this before every conversation.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadProfile}
              disabled={isLoading}
              aria-label="Refresh profile"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </Button>
          </div>

          {profile && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel rounded-3xl p-6 flex flex-col sm:flex-row items-center gap-6"
            >
              <ProfileCompletionRing score={profile.completeness.score} size={88} strokeWidth={7} />
              <div className="flex-1 text-center sm:text-left">
                <p className="font-bold text-lg">
                  {profile.completeness.score}% complete
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {profile.completeness.score >= 80
                    ? 'Excellent! Your profile gives the AI everything it needs.'
                    : profile.completeness.score >= 50
                    ? 'Good start — a few more details will sharpen AI suggestions.'
                    : 'Add more information so the AI can assist you effectively.'}
                </p>
                {profile.completeness.missingHighPriority.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {profile.completeness.missingHighPriority.slice(0, 3).map((item) => (
                      <li key={item} className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button
                onClick={() => navigate('/profile/setup')}
                className="shrink-0"
              >
                {profile.completeness.score === 0 ? 'Start setup' : 'Complete profile'}
              </Button>
            </motion.div>
          )}

          {isLoading && !profile && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-panel rounded-2xl p-4 h-16 animate-pulse bg-muted/40" />
              ))}
            </div>
          )}

          {error && !isLoading && (
            <div className="glass-panel rounded-2xl p-6 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="ghost" size="sm" className="mt-3" onClick={loadProfile}>
                Try again
              </Button>
            </div>
          )}

          {profile && !isLoading && (
            <div className="flex flex-col lg:flex-row gap-6">
              <nav className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible lg:w-52 shrink-0 pb-2 lg:pb-0">
                {CATEGORY_CONFIG.map(({ key, label, icon }) => {
                  const count = profile.facts.filter((f) => f.category === key).length;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveCategory(key)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors w-full text-left ${
                        activeCategory === key
                          ? 'bg-foreground text-background'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                      }`}
                    >
                      {icon}
                      <span className="flex-1">{label}</span>
                      {count > 0 && (
                        <span className={`text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center ${
                          activeCategory === key ? 'bg-background/20' : 'bg-muted'
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    {config?.icon}
                    {config?.label}
                  </h2>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('/profile/setup')}
                  >
                    <Plus size={14} className="mr-1.5" />
                    Add via AI
                  </Button>
                </div>

                <AnimatePresence mode="popLayout">
                  {activeFacts.length > 0 ? (
                    <div className="space-y-3">
                      {activeFacts.map((fact) => (
                        <FactCard
                          key={fact.key}
                          fact={fact}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="glass-panel rounded-2xl p-12 text-center"
                    >
                      <div className="text-muted-foreground/40 mb-4 flex justify-center">
                        {config?.icon && <span className="scale-[3] block">{config.icon}</span>}
                      </div>
                      <p className="text-sm text-muted-foreground">{config?.emptyLabel}</p>
                      <Button
                        size="sm"
                        className="mt-4"
                        onClick={() => navigate('/profile/setup')}
                      >
                        Add with AI assistant
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
