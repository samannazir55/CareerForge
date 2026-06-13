import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Star, ShieldCheck, Crown, X, ArrowRight, Unlock, Eye, Download, CheckCircle2, Lock } from 'lucide-react';
import { getTemplates, createCV, unlockTemplate, getUnlockedTemplates } from '../../services/api';
import { Template } from '../../types';
import { useAuth } from '../../context/AuthContext';

const CATEGORY_COLORS: Record<string, string> = {
  professional: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  simple: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  creative: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  executive: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  academic: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  modern: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
};

const ATS_SCORES: Record<string, number> = {
  modern: 98, classic: 99, startup_bold: 92, executive: 97, academic: 96,
};

const TemplateThumbnail = ({ template }: { template: Template }) => {
  const accent: Record<string, string> = {
    professional: '#3B82F6', simple: '#1F2937', creative: '#EC4899',
    executive: '#F59E0B', academic: '#6D5FFA', modern: '#0EA5E9',
  };
  const c = accent[template.category] || '#6D5FFA';
  return (
    <div className="w-full h-full bg-white dark:bg-gray-900 rounded-lg p-3 flex flex-col gap-2">
      <div className="h-3 rounded" style={{ background: c, width: '55%' }} />
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
      <div className="mt-1.5 h-px" style={{ background: c, opacity: 0.3 }} />
      {[1,2,3].map(i => <div key={i} className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded" style={{ width: `${70+i*8}%` }} />)}
      <div className="mt-1 flex gap-1">
        {[1,2,3].map(i => <div key={i} className="h-1.5 rounded flex-1" style={{ background: c, opacity: 0.15+i*0.1 }} />)}
      </div>
    </div>
  );
};

// ─── Download gate modal ──────────────────────────────────────────────────────
const DownloadGate = ({
  template, onUnlock, onUpgrade, onClose, unlocking
}: {
  template: Template;
  onUnlock: () => void;
  onUpgrade: () => void;
  onClose: () => void;
  unlocking: boolean;
}) => (
  <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm glass rounded-3xl overflow-hidden shadow-2xl">
    <div className="p-7">
      <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
        <X size={16} />
      </button>

      <div className="flex justify-center mb-5">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
          <Lock size={22} />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-center mb-2">Unlock to download</h2>
      <p className="text-[13px] text-muted-foreground text-center mb-6 leading-relaxed">
        <strong className="text-foreground">{template.name}</strong> is a premium template.
        Unlock it to download your resume as PDF or DOCX.
      </p>

      <div className="space-y-2.5">
        <button onClick={onUnlock} disabled={unlocking}
          className="w-full py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          {unlocking ? 'Unlocking…' : <><Unlock size={14} /> Unlock Template (1 credit)</>}
        </button>
        <button onClick={onUpgrade}
          className="w-full py-3 rounded-xl bg-gradient-violet text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          <Crown size={14} /> Upgrade to Premium — All templates free
        </button>
        <button onClick={onClose}
          className="w-full py-3 rounded-xl border border-border text-muted-foreground text-sm hover:bg-muted transition-colors">
          Cancel
        </button>
      </div>
    </div>
  </motion.div>
);

// ─── Main component ────────────────────────────────────────────────────────────
export const MarketplacePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState<Template | null>(null);
  const [showDownloadGate, setShowDownloadGate] = useState(false);
  const [gateTemplate, setGateTemplate] = useState<Template | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    Promise.all([
      getTemplates(),
      user ? getUnlockedTemplates() : Promise.resolve([]),
    ]).then(([tmpl, unl]) => {
      setTemplates(tmpl);
      setUnlocked(unl);
    }).catch(console.error).finally(() => setLoading(false));
  }, [user]);

  const categories = ['All', ...Array.from(new Set(templates.map(t => t.category).filter(Boolean)))];

  const filtered = useMemo(() => templates.filter(t => {
    const q = !search || t.name.toLowerCase().includes(search.toLowerCase());
    const c = category === 'All' || t.category === category;
    return q && c;
  }), [templates, search, category]);

  const hasAccess = (t: Template): boolean => {
    if (!t.is_premium) return true;
    if (!user) return false;
    if (user.subscription_plan === 'premium') return true;
    return unlocked.includes(t.id);
  };

  const handlePreview = async (t: Template) => {
    // All users can preview — just open the editor with this template
    if (!user) { navigate('/login'); return; }
    if (processing) return;
    setProcessing(t.id);
    try {
      const res = await createCV({
        title: `${t.name} — Preview`,
        template_id: t.id,
        data: { fullName: user.full_name || '', email: user.email } as any,
      });
      navigate('/editor', { state: { existingCV: res, forceTemplate: t.id } });
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setProcessing(null);
      setSelected(null);
    }
  };

  const handleDownloadAttempt = (t: Template) => {
    if (hasAccess(t)) {
      // Send to editor where they can download freely
      handlePreview(t);
    } else {
      setGateTemplate(t);
      setShowDownloadGate(true);
      setSelected(null);
    }
  };

  const handleUnlock = async () => {
    if (!gateTemplate || !user) return;
    setUnlocking(true);
    try {
      await unlockTemplate(gateTemplate.id);
      setUnlocked(prev => [...prev, gateTemplate.id]);
      setShowDownloadGate(false);
      // Refresh user to update credits
      await handlePreview(gateTemplate);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Unlock failed. Check your credits.');
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-10 space-y-7">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight mb-1">Template Store</h1>
            <p className="text-muted-foreground text-[15px]">
              Preview any template for free. Download unlocks for premium designs.
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
            <input type="text" placeholder="Search templates…" value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-[14px] focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/40 w-full md:w-64 transition-all" />
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-all border ${
                category === cat ? 'bg-foreground text-background border-foreground' : 'bg-card border-border text-muted-foreground hover:text-foreground'
              }`}>
              {cat === 'All' ? cat : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* "Try before you buy" banner */}
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-violet-500/8 border border-violet-500/15">
          <Eye size={16} className="text-violet-500 flex-shrink-0" />
          <p className="text-[13px] text-muted-foreground">
            <strong className="text-foreground">Preview any template — no restrictions.</strong>{' '}
            Only PDF/DOCX download requires unlocking premium templates.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="aspect-[3/4] rounded-2xl bg-muted/50 animate-pulse" />)}
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <AnimatePresence>
              {filtered.map((t, i) => {
                const access = hasAccess(t);
                const isProcessing = processing === t.id;
                return (
                  <motion.div layout key={t.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.22, delay: i * 0.04 }}
                    className="group glass rounded-2xl overflow-hidden flex flex-col cursor-pointer card-hover"
                    onClick={() => setSelected(t)}>
                    {/* Thumbnail */}
                    <div className="aspect-[3/4] relative overflow-hidden bg-muted/50 p-3">
                      <TemplateThumbnail template={t} />

                      {/* Top badges */}
                      <div className="absolute top-2.5 left-2.5">
                        <div className="flex items-center gap-1 px-2 py-1 bg-background/90 backdrop-blur rounded-lg text-[11px] font-bold shadow-sm">
                          <ShieldCheck size={10} className="text-emerald-500" />
                          ATS {ATS_SCORES[t.id] || 94}
                        </div>
                      </div>
                      <div className="absolute top-2.5 right-2.5 flex flex-col gap-1">
                        {t.is_premium && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-white rounded-lg text-[11px] font-bold shadow-sm">
                            <Crown size={9} /> PRO
                          </div>
                        )}
                        {!t.is_premium && (
                          <div className="px-2 py-1 bg-emerald-500 text-white rounded-lg text-[11px] font-bold shadow-sm">Free</div>
                        )}
                        {t.is_premium && access && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/90 text-white rounded-lg text-[10px] font-bold">
                            <CheckCircle2 size={9} /> Unlocked
                          </div>
                        )}
                      </div>

                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2.5 rounded-lg">
                        <button onClick={e => { e.stopPropagation(); handlePreview(t); }}
                          disabled={isProcessing}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-violet text-white rounded-xl text-[12px] font-semibold shadow-sm">
                          {isProcessing ? '…' : <><Eye size={12} /> Preview</>}
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleDownloadAttempt(t); }}
                          disabled={isProcessing}
                          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold shadow-sm ${
                            access ? 'bg-emerald-500 text-white' : 'bg-card border border-border text-foreground'
                          }`}>
                          {access ? <><Download size={12} /> Use</> : <><Lock size={12} /> Unlock</>}
                        </button>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-[14px] leading-tight">{t.name}</h3>
                        {t.is_premium && !access && <Lock size={12} className="text-muted-foreground flex-shrink-0 mt-0.5" />}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${CATEGORY_COLORS[t.category] || 'bg-muted text-muted-foreground'}`}>
                          {t.category?.charAt(0).toUpperCase() + t.category?.slice(1)}
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Star size={10} className="text-amber-500 fill-amber-500" />
                          {t.is_premium ? '4.9' : '4.7'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/75 backdrop-blur-md" onClick={() => setSelected(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md glass rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-7">
                <button onClick={() => setSelected(null)}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <X size={16} />
                </button>

                <div className="flex items-start gap-3 mb-4">
                  <div>
                    <h2 className="text-xl font-semibold mb-2">{selected.name}</h2>
                    <div className="flex items-center gap-2 text-[12px]">
                      <span className={`px-2 py-1 rounded-lg font-medium ${CATEGORY_COLORS[selected.category] || 'bg-muted text-muted-foreground'}`}>
                        {selected.category?.charAt(0).toUpperCase() + selected.category?.slice(1)}
                      </span>
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <ShieldCheck size={12} /> ATS {ATS_SCORES[selected.id] || 94}
                      </span>
                      {selected.is_premium && hasAccess(selected) && (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 size={12} /> Unlocked
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {selected.is_premium && (
                  <div className={`flex items-center gap-2 mb-5 p-3 rounded-xl border ${
                    hasAccess(selected)
                      ? 'bg-emerald-500/10 border-emerald-500/20'
                      : 'bg-amber-500/10 border-amber-500/20'
                  }`}>
                    {hasAccess(selected) ? (
                      <><CheckCircle2 size={14} className="text-emerald-500" />
                        <span className="text-[13px] text-emerald-600 dark:text-emerald-400 font-medium">You have full access to this template.</span></>
                    ) : (
                      <><Crown size={14} className="text-amber-500" />
                        <span className="text-[13px] text-amber-600 dark:text-amber-400 font-medium">
                          Preview free · Unlock to download (1 credit)
                        </span></>
                    )}
                  </div>
                )}

                <p className="text-[14px] text-muted-foreground mb-7 leading-relaxed">
                  A professionally designed, ATS-optimized template. You can preview it for free — unlock to download as PDF or DOCX.
                </p>

                <div className="flex gap-3">
                  <button onClick={() => handlePreview(selected)} disabled={processing === selected.id}
                    className="flex-1 py-3 rounded-xl bg-gradient-violet text-white text-[14px] font-semibold hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2">
                    {processing === selected.id ? 'Opening…' : <><Eye size={14} /> Preview</>}
                  </button>
                  {selected.is_premium && !hasAccess(selected) ? (
                    <button onClick={() => handleDownloadAttempt(selected)}
                      className="flex-1 py-3 rounded-xl bg-amber-500 text-white text-[14px] font-semibold hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2">
                      <Unlock size={14} /> Unlock
                    </button>
                  ) : (
                    <button onClick={() => handlePreview(selected)} disabled={processing === selected.id}
                      className="flex-1 py-3 rounded-xl border border-border bg-card text-[14px] font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2">
                      <Download size={14} /> Use & Export
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Download gate modal */}
        {showDownloadGate && gateTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/75 backdrop-blur-md" onClick={() => setShowDownloadGate(false)} />
            <DownloadGate
              template={gateTemplate}
              onUnlock={handleUnlock}
              onUpgrade={() => { setShowDownloadGate(false); navigate('/dashboard'); }}
              onClose={() => setShowDownloadGate(false)}
              unlocking={unlocking}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
