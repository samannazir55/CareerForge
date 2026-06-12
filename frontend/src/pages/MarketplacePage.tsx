import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Star,
  ShieldCheck,
  Lock,
  Unlock,
  Coins } from
'lucide-react';
import { TEMPLATES, TemplateDef } from '../data/templates';
import { useAppStore } from '../context/AppStore';
import { Button } from '../components/ui/Button';
interface MarketplaceProps {
  onNavigate: (view: 'builder') => void;
}
export function Marketplace({ onNavigate }: MarketplaceProps) {
  const { ownedTemplateIds, pointsBalance, unlockTemplate, subscriptionTier } =
  useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDef | null>(
    null
  );
  const categories = [
  'All',
  ...Array.from(new Set(TEMPLATES.map((t) => t.category)))];

  const filteredTemplates = useMemo(() => {
    return TEMPLATES.filter((t) => {
      const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
      selectedCategory === 'All' || t.category === selectedCategory;
      return matchesSearch && matchesCategory;
    }).sort((a, b) => b.popularity - a.popularity);
  }, [searchQuery, selectedCategory]);
  const handleUnlock = (template: TemplateDef) => {
    if (unlockTemplate(template.id, template.cost)) {
      setSelectedTemplate(null);
    } else {
      alert('Not enough points! Visit the Dashboard to upgrade your plan.');
    }
  };
  return (
    <div className="min-h-full bg-background p-6 md:p-10 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">
              Template Store
            </h1>
            <p className="text-muted-foreground text-lg">
              Discover premium, ATS-optimized designs for your next career move.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={18} />
              
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 w-full md:w-64 transition-all" />
              
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
          {categories.map((cat) =>
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-foreground text-background' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}>
            
              {cat}
            </button>
          )}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {filteredTemplates.map((template, i) => {
              const isOwned = ownedTemplateIds.includes(template.id);
              const isFreeForUser =
              template.cost === 0 || subscriptionTier === 'premium';
              return (
                <motion.div
                  layout
                  initial={{
                    opacity: 0,
                    y: 20
                  }}
                  animate={{
                    opacity: 1,
                    y: 0
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.9
                  }}
                  transition={{
                    duration: 0.3,
                    delay: i * 0.05
                  }}
                  key={template.id}
                  className="group glass-panel rounded-2xl overflow-hidden flex flex-col cursor-pointer hover:border-primary/30 transition-all"
                  onClick={() => setSelectedTemplate(template)}>
                  
                  {/* Preview Image Placeholder */}
                  <div className="aspect-[1/1.2] bg-muted relative overflow-hidden p-4">
                    <div
                      className={`w-full h-full bg-card rounded-md shadow-sm border border-border/50 flex flex-col p-4 ${template.colorTheme === 'blue' ? 'border-blue-200 bg-blue-50/30' : ''}`}>
                      
                      <div className="w-1/2 h-4 bg-muted-foreground/20 rounded mb-4" />
                      <div className="w-full h-2 bg-muted-foreground/10 rounded mb-2" />
                      <div className="w-3/4 h-2 bg-muted-foreground/10 rounded mb-6" />
                      <div className="w-1/3 h-3 bg-muted-foreground/20 rounded mb-3" />
                      <div className="w-full h-16 bg-muted-foreground/5 rounded mb-4" />
                    </div>

                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex flex-col gap-2">
                      <div className="bg-background/90 backdrop-blur text-xs font-bold px-2 py-1 rounded-md shadow-sm flex items-center gap-1">
                        <ShieldCheck size={12} className="text-emerald-500" />
                        ATS {template.atsScore}
                      </div>
                    </div>
                    <div className="absolute top-3 right-3">
                      {isOwned ?
                      <div className="bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm flex items-center gap-1">
                          <Unlock size={12} /> Owned
                        </div> :

                      <div className="bg-background/90 backdrop-blur text-xs font-bold px-2 py-1 rounded-md shadow-sm flex items-center gap-1">
                          {isFreeForUser ?
                        'Free' :

                        <>
                              <Coins size={12} className="text-amber-500" />{' '}
                              {template.cost}
                            </>
                        }
                        </div>
                      }
                    </div>

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button variant="primary" className="shadow-xl">
                        {isOwned ? 'Use Template' : 'View Details'}
                      </Button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg leading-tight">
                        {template.name}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
                      {template.description}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                      <span>{template.category}</span>
                      <span className="flex items-center gap-1">
                        <Star
                          size={12}
                          className="text-amber-500 fill-amber-500" />
                        {' '}
                        {template.popularity}%
                      </span>
                    </div>
                  </div>
                </motion.div>);

            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Unlock Modal */}
      <AnimatePresence>
        {selectedTemplate &&
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            exit={{
              opacity: 0
            }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setSelectedTemplate(null)} />
          
            <motion.div
            initial={{
              opacity: 0,
              scale: 0.95,
              y: 20
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0
            }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: 20
            }}
            className="relative w-full max-w-lg glass-panel rounded-3xl overflow-hidden shadow-2xl border-border">
            
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">
                      {selectedTemplate.name}
                    </h2>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="px-2 py-1 bg-muted rounded-md font-medium">
                        {selectedTemplate.category}
                      </span>
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <ShieldCheck size={14} /> ATS{' '}
                        {selectedTemplate.atsScore}
                      </span>
                    </div>
                  </div>
                  {!ownedTemplateIds.includes(selectedTemplate.id) &&
                <div className="flex flex-col items-end">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">
                        Cost
                      </span>
                      <div className="flex items-center gap-1.5 text-xl font-bold text-amber-500">
                        <Coins size={20} />
                        {selectedTemplate.cost}
                      </div>
                    </div>
                }
                </div>

                <p className="text-muted-foreground mb-8 leading-relaxed">
                  {selectedTemplate.description}
                </p>

                <div className="flex gap-3">
                  <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedTemplate(null)}>
                  
                    Cancel
                  </Button>

                  {ownedTemplateIds.includes(selectedTemplate.id) ?
                <Button
                  className="flex-1"
                  onClick={() => onNavigate('builder')}>
                  
                      Use Template
                    </Button> :

                <Button
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 hover:opacity-90"
                  onClick={() => handleUnlock(selectedTemplate)}>
                  
                      <Unlock size={16} className="mr-2" />
                      {subscriptionTier === 'premium' ?
                  'Unlock (Free with Premium)' :
                  `Unlock for ${selectedTemplate.cost} Points`}
                    </Button>
                }
                </div>
              </div>
            </motion.div>
          </div>
        }
      </AnimatePresence>
    </div>);

}