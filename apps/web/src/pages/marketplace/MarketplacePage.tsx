import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ShieldCheck, Lock, Unlock, Coins, X, FilePlus, FileText } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { TemplateLivePreview } from '../../components/preview/TemplateLivePreview';
import { pointsApi, resumeApi, ApiError } from '../../lib/api';
import { TEMPLATE_FAMILIES } from '@careerforge/schema';
import type { ResumeSummary } from '@careerforge/schema';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

interface TemplateItem {
  id: string;
  name: string;
  category: 'free' | 'premium';
  family: string;
  cost: number;
  owned: boolean;
}

export function MarketplacePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [balance, setBalance] = useState(0);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  // Optimistic overlay only — the source of truth is template.owned from the
  // server (backed by template_purchases), refetched fresh on every page
  // load. This just avoids waiting on a refetch right after a purchase.
  const [purchased, setPurchased] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'free' | 'premium' | 'owned'>('All');
  const [selectedFamily, setSelectedFamily] = useState<'All' | string>('All');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);

  // "Use this template" flow: pick which existing resume to apply it to, or
  // start a new one. null = not open; resumes: null = still loading.
  const [resumePicker, setResumePicker] = useState<{ resumes: ResumeSummary[] | null; applyingTo: string | null } | null>(null);

  useEffect(() => {
    Promise.all([pointsApi.getTemplates(), pointsApi.get()])
      .then(([tData, pData]) => {
        setTemplates(tData.templates as TemplateItem[]);
        setBalance(pData.balance);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load templates.'));
  }, []);

  // Matches export.service.ts's assertCanExport: any paid tier unlocks every
  // premium template. The server already bakes this into template.owned,
  // but keeping the local checks too means a stale/failed template fetch
  // doesn't wrongly show a paying subscriber's own templates as locked.
  const isPremiumUser = user?.subscriptionTier === 'PREMIUM' || user?.subscriptionTier === 'PROFESSIONAL';

  function isOwned(template: TemplateItem): boolean {
    return template.owned || purchased.has(template.id) || template.category === 'free' || isPremiumUser;
  }

  const categories: Array<'All' | 'free' | 'premium' | 'owned'> = ['All', 'free', 'premium', 'owned'];

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === 'All' ||
        (selectedCategory === 'owned' ? isOwned(t) : t.category === selectedCategory);
      const matchesFamily = selectedFamily === 'All' || t.family === selectedFamily;
      return matchesSearch && matchesCategory && matchesFamily;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isOwned closes over purchased/isPremiumUser, both listed
  }, [templates, searchQuery, selectedCategory, selectedFamily, purchased, isPremiumUser]);

  async function handlePurchase(template: TemplateItem) {
    if (balance < template.cost) {
      setError(`You need ${template.cost} points but only have ${balance}.`);
      return;
    }
    setPurchasing(template.id);
    setError(null);
    try {
      await pointsApi.purchaseTemplate(template.id);
      setPurchased((prev) => new Set([...prev, template.id]));
      setBalance((b) => b - template.cost);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Purchase failed.');
    } finally {
      setPurchasing(null);
    }
  }

  // Opens the "which resume?" step inside the unlock modal. Requires
  // `selectedTemplate` to already be set (this only ever runs from inside
  // that modal), and lazily loads the resume list the first time it's opened.
  function handleStartUsingTemplate() {
    setResumePicker({ resumes: null, applyingTo: null });
    resumeApi
      .list()
      .then((data) => setResumePicker((s) => (s ? { ...s, resumes: data.resumes } : s)))
      .catch(() => {
        setError('Could not load your resumes.');
        setResumePicker(null);
      });
  }

  // resumeId=null means "create a brand new resume and apply the template
  // to it". Otherwise applies to an existing resume the user picked.
  //
  // Fetches the resume's CURRENT full theme before patching in the new
  // templateId, rather than PATCHing { theme: { templateId } } alone —
  // UpdateResumeRequestSchema's theme field replaces the whole theme object,
  // and its accentColor/fontFamily zod defaults would silently overwrite
  // any custom accent color the user had already picked for that resume.
  async function applyTemplateToResume(resumeId: string | null) {
    if (!selectedTemplate) return;
    setResumePicker((s) => (s ? { ...s, applyingTo: resumeId ?? 'new' } : s));
    setError(null);
    try {
      let targetId = resumeId;
      let theme;
      if (targetId) {
        const { resume } = await resumeApi.get(targetId);
        theme = resume.theme;
      } else {
        const { resume } = await resumeApi.create({ title: 'Untitled Resume' });
        targetId = resume.id;
        theme = resume.theme;
      }
      await resumeApi.update(targetId, { theme: { ...theme, templateId: selectedTemplate.id } });
      navigate(`/resumes/${targetId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not apply this template.');
      setResumePicker((s) => (s ? { ...s, applyingTo: null } : s));
    }
  }

  function closeModal() {
    setSelectedTemplate(null);
    setResumePicker(null);
  }

  return (
    <AppShell>
      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Template Store</h1>
            <p className="text-muted-foreground text-base sm:text-lg">
              {isPremiumUser ? 'All templates unlocked with your Premium plan.' : `${balance} points available`}
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              type="text"
              placeholder="Search templates…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 w-full md:w-64 transition-all"
            />
          </div>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors capitalize',
                selectedCategory === cat
                  ? 'bg-foreground text-background'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Design family pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <button
            onClick={() => setSelectedFamily('All')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border',
              selectedFamily === 'All'
                ? 'bg-indigo-500 text-white border-indigo-500'
                : 'bg-transparent border-border text-muted-foreground hover:text-foreground',
            )}
          >
            All styles
          </button>
          {TEMPLATE_FAMILIES.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFamily(f.id)}
              title={f.description}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border',
                selectedFamily === f.id
                  ? 'bg-indigo-500 text-white border-indigo-500'
                  : 'bg-transparent border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {/* Grid */}
        {templates.length === 0 && !error ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[1/1.5] rounded-2xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No templates match your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence>
              {filteredTemplates.map((template, i) => {
                const owned = isOwned(template);
                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    key={template.id}
                    className="group glass-panel rounded-2xl overflow-hidden flex flex-col cursor-pointer hover:border-primary/30 transition-all"
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div className="aspect-[1/1.2] bg-muted relative overflow-hidden p-4">
                      <TemplateLivePreview templateId={template.id} className="rounded-md shadow-sm border border-border/50" />

                      <div className="absolute top-3 left-3 flex flex-col gap-2">
                        <div className="bg-background/90 backdrop-blur text-xs font-bold px-2 py-1 rounded-md shadow-sm flex items-center gap-1">
                          <ShieldCheck size={12} className="text-emerald-500" />
                          ATS-ready
                        </div>
                      </div>
                      <div className="absolute top-3 right-3">
                        {owned ? (
                          <div className="bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm flex items-center gap-1">
                            <Unlock size={12} /> Owned
                          </div>
                        ) : (
                          <div className="bg-background/90 backdrop-blur text-xs font-bold px-2 py-1 rounded-md shadow-sm flex items-center gap-1">
                            {template.cost === 0 ? (
                              'Free'
                            ) : (
                              <>
                                <Coins size={12} className="text-amber-500" /> {template.cost}
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button variant="primary" className="shadow-xl">
                          {owned ? 'Use Template' : 'View Details'}
                        </Button>
                      </div>
                    </div>

                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="font-bold text-lg leading-tight mb-2">{template.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-1 capitalize">
                        {template.category} template
                      </p>
                      <p className="text-xs text-muted-foreground mb-4 flex-1">
                        {TEMPLATE_FAMILIES.find((f) => f.id === template.family)?.label ?? template.family}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                        <span className="capitalize">{template.category}</span>
                        {!owned && (
                          <span className="flex items-center gap-1">
                            <Lock size={12} /> Locked
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Unlock Modal */}
      <AnimatePresence>
        {selectedTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={closeModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg glass-panel rounded-3xl overflow-hidden shadow-2xl"
            >
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
              <div className="aspect-[2/1] bg-muted p-6">
                <TemplateLivePreview templateId={selectedTemplate.id} className="rounded-md shadow-sm border border-border/50" />
              </div>
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-2">{selectedTemplate.name}</h3>
                <p className="text-muted-foreground mb-6 capitalize">
                  {selectedTemplate.category} template, ATS-friendly layout.
                </p>

                {isOwned(selectedTemplate) ? (
                  resumePicker ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                        Apply to which resume?
                      </p>
                      {resumePicker.resumes === null ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Loading your resumes…</p>
                      ) : (
                        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                          {resumePicker.resumes.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => applyTemplateToResume(r.id)}
                              disabled={resumePicker.applyingTo !== null}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-accent/50 transition-colors text-left disabled:opacity-60"
                            >
                              <FileText size={15} className="text-muted-foreground shrink-0" />
                              <span className="text-sm font-medium truncate flex-1">{r.title}</span>
                              {resumePicker.applyingTo === r.id && (
                                <span className="text-xs text-muted-foreground shrink-0">Applying…</span>
                              )}
                            </button>
                          ))}
                          <button
                            onClick={() => applyTemplateToResume(null)}
                            disabled={resumePicker.applyingTo !== null}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-dashed border-input hover:border-primary/40 hover:bg-accent/50 transition-colors text-left disabled:opacity-60"
                          >
                            <FilePlus size={15} className="text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium flex-1">
                              {resumePicker.applyingTo === 'new' ? 'Creating…' : 'Create a new resume'}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button className="w-full" size="lg" onClick={handleStartUsingTemplate}>
                      Use This Template
                    </Button>
                  )
                ) : (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => handlePurchase(selectedTemplate)}
                    disabled={purchasing === selectedTemplate.id || balance < selectedTemplate.cost}
                  >
                    {purchasing === selectedTemplate.id ? (
                      'Unlocking…'
                    ) : balance < selectedTemplate.cost ? (
                      `Need ${selectedTemplate.cost - balance} more points`
                    ) : (
                      <>
                        <Coins size={16} className="mr-1.5" />
                        Unlock for {selectedTemplate.cost} points
                      </>
                    )}
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
