import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ShieldCheck, Lock, Unlock, Coins, X } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { pointsApi, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

interface TemplateItem {
  id: string;
  name: string;
  category: 'free' | 'premium';
  cost: number;
}

/**
 * Faux-document preview — a stack of muted blocks shaped like a resume's
 * header/lines/section, scaled differently per category so free and
 * premium templates read as visually distinct without needing real
 * preview images (the backend has none; previewClass is only a CSS
 * class string with no visual definition behind it).
 */
function TemplatePreview({ category }: { category: TemplateItem['category'] }) {
  return (
    <div
      className={cn(
        'w-full h-full bg-card rounded-md shadow-sm border border-border/50 flex flex-col p-4',
        category === 'premium' && 'border-amber-300/40',
      )}
    >
      <div className="w-1/2 h-4 bg-muted-foreground/20 rounded mb-4" />
      <div className="w-full h-2 bg-muted-foreground/10 rounded mb-2" />
      <div className="w-3/4 h-2 bg-muted-foreground/10 rounded mb-6" />
      <div className="w-1/3 h-3 bg-muted-foreground/20 rounded mb-3" />
      <div className="w-full h-16 bg-muted-foreground/5 rounded mb-4" />
      <div className="w-1/3 h-3 bg-muted-foreground/20 rounded mb-3" />
      <div className="w-full h-10 bg-muted-foreground/5 rounded" />
    </div>
  );
}

export function MarketplacePage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [balance, setBalance] = useState(0);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchased, setPurchased] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'free' | 'premium'>('All');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);

  useEffect(() => {
    Promise.all([pointsApi.getTemplates(), pointsApi.get()])
      .then(([tData, pData]) => {
        setTemplates(tData.templates as TemplateItem[]);
        setBalance(pData.balance);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load templates.'));
  }, []);

  // Matches export.service.ts's assertCanExport: any paid tier unlocks every
  // premium template. Previously only PREMIUM was checked here, which would
  // have shown templates as locked to a paying PROFESSIONAL subscriber even
  // though they're now actually entitled to download them.
  const isPremiumUser = user?.subscriptionTier === 'PREMIUM' || user?.subscriptionTier === 'PROFESSIONAL';

  const categories: Array<'All' | 'free' | 'premium'> = ['All', 'free', 'premium'];

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, selectedCategory]);

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
      setSelectedTemplate(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Purchase failed.');
    } finally {
      setPurchasing(null);
    }
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
                const isOwned = purchased.has(template.id) || template.category === 'free' || isPremiumUser;
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
                      <TemplatePreview category={template.category} />

                      <div className="absolute top-3 left-3 flex flex-col gap-2">
                        <div className="bg-background/90 backdrop-blur text-xs font-bold px-2 py-1 rounded-md shadow-sm flex items-center gap-1">
                          <ShieldCheck size={12} className="text-emerald-500" />
                          ATS-ready
                        </div>
                      </div>
                      <div className="absolute top-3 right-3">
                        {isOwned ? (
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
                          {isOwned ? 'Use Template' : 'View Details'}
                        </Button>
                      </div>
                    </div>

                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="font-bold text-lg leading-tight mb-2">{template.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1 capitalize">
                        {template.category} template
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                        <span className="capitalize">{template.category}</span>
                        {!isOwned && (
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
              onClick={() => setSelectedTemplate(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg glass-panel rounded-3xl overflow-hidden shadow-2xl"
            >
              <button
                onClick={() => setSelectedTemplate(null)}
                className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
              <div className="aspect-[2/1] bg-muted p-6">
                <TemplatePreview category={selectedTemplate.category} />
              </div>
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-2">{selectedTemplate.name}</h3>
                <p className="text-muted-foreground mb-6 capitalize">
                  {selectedTemplate.category} template, ATS-friendly layout.
                </p>

                {purchased.has(selectedTemplate.id) || selectedTemplate.category === 'free' || isPremiumUser ? (
                  <Button className="w-full" size="lg">
                    Use This Template
                  </Button>
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
