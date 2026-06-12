import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Star, Lock, Unlock, Crown, Zap, Coins,
  Search, Filter, ArrowRight, Loader2, CheckCircle2
} from 'lucide-react';
import { useAppStore } from '../context/AppStore';
import { templateApi, cvApi } from '../services/api';
import { Button } from '../components/ui/Button';
import { titleCase } from '../lib/utils';
import type { BackendTemplate } from '../types';
import { useAuth } from '../context/AuthContext';

// Metadata overlay for backend templates (enriches the raw DB templates with UI info)
const TEMPLATE_META: Record<string, { description: string; atsScore: number; points: number; tags: string[] }> = {
  modern:         { description: 'Clean, sidebar-driven layout. ATS-optimised and widely accepted.', atsScore: 92, points: 0,   tags: ['Popular', 'ATS-Friendly'] },
  classic:        { description: 'Timeless serif design trusted by hiring managers globally.',         atsScore: 95, points: 0,   tags: ['Classic', 'ATS-Friendly'] },
  startup_bold:   { description: 'High-contrast creative layout that commands attention.',            atsScore: 78, points: 80,  tags: ['Creative', 'Bold'] },
  executive_pro:  { description: 'Premium executive design. Understated power.',                      atsScore: 96, points: 150, tags: ['Executive', 'Premium'] },
  silicon_valley: { description: 'Tech-forward minimalist. Built for engineering roles.',             atsScore: 91, points: 120, tags: ['Tech', 'Minimal'] },
  academic:       { description: 'Structured for research, publications, and academia.',              atsScore: 94, points: 100, tags: ['Academic', 'Detailed'] },
  finance_pro:    { description: 'Conservative, data-forward layout for finance professionals.',      atsScore: 97, points: 100, tags: ['Finance', 'ATS-Friendly'] },
  healthcare:     { description: 'Clean and credentialed. Built for clinical and medical roles.',     atsScore: 93, points: 120, tags: ['Healthcare', 'Clean'] },
};

function getMeta(id: string) {
  return (
    TEMPLATE_META[id] || {
      description: 'Professional resume template.',
      atsScore: 88,
      points: 50,
      tags: ['Professional'],
    }
  );
}

interface TemplateCardProps {
  template: BackendTemplate;
  owned: boolean;
  onSelect: (template: BackendTemplate) => void;
  onUnlock: (template: BackendTemplate) => void;
  isProcessing: boolean;
}

function TemplateCard({ template, owned, onSelect, onUnlock, isProcessing }: TemplateCardProps) {
  const meta = getMeta(template.id);
  const isFree = !template.is_premium;
  const canUse = isFree || owned;

  // Vibrant gradient per template
  const gradients: Record<string, string> = {
    modern:         'from-indigo-500/20 to-blue-500/20',
    classic:        'from-slate-500/20 to-gray-500/20',
    startup_bold:   'from-orange-500/20 to-rose-500/20',
    executive_pro:  'from-emerald-500/20 to-teal-500/20',
    silicon_valley: 'from-cyan-500/20 to-sky-500/20',
    academic:       'from-violet-500/20 to-purple-500/20',
    finance_pro:    'from-amber-500/20 to-yellow-500/20',
    healthcare:     'from-green-500/20 to-lime-500/20',
  };
  const gradient = gradients[template.id] || 'from-indigo-500/20 to-purple-500/20';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-panel rounded-3xl overflow-hidden group hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300"
    >
      {/* Preview area */}
      <div className={`relative aspect-[3/4] bg-gradient-to-br ${gradient} flex items-center justify-center`}>
        {/* Mock resume lines */}
        <div className="w-2/3 space-y-2 opacity-60 group-hover:opacity-80 transition-opacity">
          <div className="h-3 bg-current rounded-full w-full opacity-40" />
          <div className="h-2 bg-current rounded-full w-3/4 opacity-25" />
          <div className="h-1 bg-current rounded-full w-full opacity-15 mt-2" />
          <div className="h-1 bg-current rounded-full w-5/6 opacity-15" />
          <div className="h-1 bg-current rounded-full w-4/6 opacity-15" />
          <div className="h-1 bg-current rounded-full w-full opacity-10 mt-2" />
          <div className="h-1 bg-current rounded-full w-5/6 opacity-10" />
        </div>

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {isFree && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold">Free</span>
          )}
          {template.is_premium && !owned && (
            <span className="px-2.5 py-1 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center gap-1">
              <Crown size={10} /> Premium
            </span>
          )}
          {owned && (
            <span className="px-2.5 py-1 rounded-full bg-indigo-500 text-white text-xs font-bold flex items-center gap-1">
              <CheckCircle2 size={10} /> Owned
            </span>
          )}
        </div>

        {/* ATS score */}
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-background/80 backdrop-blur px-2 py-1 rounded-full">
          <Zap size={10} className="text-amber-500" />
          <span className="text-xs font-bold">{meta.atsScore}%</span>
        </div>
      </div>

      {/* Info area */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-base">{template.name}</h3>
          {template.is_premium && !isFree && (
            <div className="flex items-center gap-1 text-amber-500 text-xs font-bold flex-none">
              <Coins size={12} />
              {meta.points}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{meta.description}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-4">
          {meta.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full font-medium">
              {tag}
            </span>
          ))}
        </div>

        {/* Action buttons */}
        {canUse ? (
          <Button variant="brand" size="sm" className="w-full" onClick={() => onSelect(template)} disabled={isProcessing}>
            {isProcessing ? <Loader2 size={14} className="animate-spin mr-1" /> : <ArrowRight size={14} className="mr-1" />}
            Use This Template
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
            onClick={() => onUnlock(template)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 size={14} className="animate-spin mr-1" />
            ) : (
              <Lock size={14} className="mr-1" />
            )}
            Unlock — {meta.points} pts
          </Button>
        )}
      </div>
    </motion.div>
  );
}

interface MarketplacePageProps {
  onTemplateSelected: (templateId: string) => void;
  onNavigateToEditor: () => void;
}

export function MarketplacePage({ onTemplateSelected, onNavigateToEditor }: MarketplacePageProps) {
  const { user } = useAuth();
  const { pointsBalance, hasTemplate, unlockTemplate } = useAppStore();
  const [templates, setTemplates] = useState<BackendTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'free' | 'premium'>('all');
  const [unlockModal, setUnlockModal] = useState<BackendTemplate | null>(null);

  useEffect(() => {
    templateApi.list()
      .then(setTemplates)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = templates.filter((t) => {
    const matchSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter =
      activeFilter === 'all' ||
      (activeFilter === 'free' && !t.is_premium) ||
      (activeFilter === 'premium' && t.is_premium);
    return matchSearch && matchFilter;
  });

  const handleSelect = async (template: BackendTemplate) => {
    if (processingId) return;
    setProcessingId(template.id);
    try {
      if (!user) { onTemplateSelected(template.id); return; }
      // Create a new blank CV with this template
      const cv = await cvApi.create({
        title: `${template.name} — ${new Date().toLocaleDateString()}`,
        template_id: template.id,
        data: {
          fullName: user.fullName || '',
          email: user.email || '',
          jobTitle: '',
          summary: '',
          accentColor: '#2c3e50',
          textColor: '#333333',
          fontFamily: 'Helvetica, Arial, sans-serif',
        },
      });
      onTemplateSelected(template.id);
      // Pass CV to editor via callback
      onNavigateToEditor();
    } catch (err) {
      console.error('Error creating CV:', err);
      alert('Failed to create resume. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleUnlock = (template: BackendTemplate) => {
    setUnlockModal(template);
  };

  const confirmUnlock = (template: BackendTemplate) => {
    const meta = getMeta(template.id);
    const success = unlockTemplate(template.id, meta.points);
    if (success) {
      setUnlockModal(null);
    } else {
      alert(`Not enough points. You need ${meta.points} pts but have ${pointsBalance}.`);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-indigo-500 mx-auto" />
          <p className="text-muted-foreground text-sm">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background overflow-y-auto">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-ai">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Template Marketplace</h1>
            <p className="text-muted-foreground max-w-lg">
              Choose from professional, ATS-optimized resume templates. Use points to unlock premium designs.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
                <Coins size={14} className="text-amber-500" />
                <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">{pointsBalance} pts available</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-0 z-20 border-b border-border glass-panel">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          {/* Filter pills */}
          <div className="flex gap-2">
            {(['all', 'free', 'premium'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                  activeFilter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {f === 'premium' && <Crown size={10} className="inline mr-1" />}
                {titleCase(f)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Template grid */}
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-8">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Filter size={32} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">No templates match your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                owned={hasTemplate(template.id) || !template.is_premium}
                onSelect={handleSelect}
                onUnlock={handleUnlock}
                isProcessing={processingId === template.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Unlock confirmation modal */}
      {unlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel rounded-3xl p-8 max-w-sm w-full border border-amber-500/20"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
              <Unlock size={22} className="text-amber-500" />
            </div>
            <h2 className="text-xl font-bold mb-2">Unlock {unlockModal.name}?</h2>
            <p className="text-muted-foreground text-sm mb-6">
              This will spend <strong className="text-amber-500">{getMeta(unlockModal.id).points} points</strong> from your balance of{' '}
              <strong>{pointsBalance} pts</strong>.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setUnlockModal(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white border-0"
                onClick={() => confirmUnlock(unlockModal)}
              >
                <Coins size={14} className="mr-1.5" />
                Unlock Now
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
