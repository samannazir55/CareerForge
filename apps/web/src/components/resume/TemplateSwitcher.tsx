import { useEffect, useMemo, useState } from 'react';
import { Lock, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PublicTemplateListItem } from '@careerforge/schema';
import { templatesApi } from '../../lib/api';

interface TemplateSwitcherProps {
  currentTemplateId: string;
  onSelect: (templateId: string) => void;
}

// Matches the modern/classic fallback the AI chat builder's own switcher
// uses if the fetch fails, so this never renders empty.
const FALLBACK_TEMPLATES: PublicTemplateListItem[] = [
  { id: 'modern', slug: 'modern', name: 'Modern', category: 'free', family: 'modern', pointsCost: 0, thumbnailUrl: null, displayOrder: 0, isDynamic: false },
  { id: 'classic', slug: 'classic', name: 'Classic', category: 'free', family: 'classic', pointsCost: 0, thumbnailUrl: null, displayOrder: 1, isDynamic: false },
];

// How many templates to show inline before handing off to the Marketplace.
// With 1500+ AI-generated templates now in the catalog, rendering every one
// as a button here would make this panel unusably long (and slow to mount)
// — the Marketplace already exists as the real browse-and-preview surface,
// with actual previews, search, and family/category filters, so this strip
// is just a handful of quick options plus a way there.
const INLINE_LIMIT = 7;

/**
 * Lets the user try out any available template — free or premium — on
 * their actual resume data. Selecting a template only changes what's
 * previewed; it is NOT gated here. Premium templates can always be
 * previewed, matching the product rule that viewing is free and only
 * downloading a premium template requires points or a paid plan (enforced
 * server-side in export.service.ts, surfaced as an error on the Export
 * buttons if the user tries to download one they haven't unlocked).
 */
export function TemplateSwitcher({ currentTemplateId, onSelect }: TemplateSwitcherProps) {
  const [templates, setTemplates] = useState<PublicTemplateListItem[]>(FALLBACK_TEMPLATES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    templatesApi
      .list()
      .then((data) => setTemplates(data.templates))
      .catch(() => {
        /* keep the modern/classic fallback above */
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Show the first INLINE_LIMIT templates (already sorted by displayOrder
  // from the API, so the two free code templates lead), but always keep
  // whatever template is currently selected visible even if it would
  // otherwise fall past the cutoff — losing the active-state highlight the
  // moment you picked something outside the first few would be confusing.
  const { visibleTemplates, hasMore } = useMemo(() => {
    const head = templates.slice(0, INLINE_LIMIT);
    const activeIsVisible = head.some((t) => t.id === currentTemplateId);
    const activeTemplate = templates.find((t) => t.id === currentTemplateId);
    const visible = activeIsVisible || !activeTemplate ? head : [...head.slice(0, INLINE_LIMIT - 1), activeTemplate];
    return { visibleTemplates: visible, hasMore: templates.length > INLINE_LIMIT };
  }, [templates, currentTemplateId]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Template</p>
        {isLoading && <span className="text-[10px] text-muted-foreground">Loading…</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {visibleTemplates.map((t) => {
          const isActive = t.id === currentTemplateId;
          const isPremium = t.category === 'premium';
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              aria-pressed={isActive}
              title={isPremium ? `${t.name} — premium (${t.pointsCost} pts to download)` : t.name}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-colors ${
                isActive
                  ? 'bg-indigo-500 text-white border-indigo-500'
                  : 'bg-background border-input text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {t.isDynamic && <Sparkles size={11} className={isActive ? 'text-white' : 'text-violet-400'} />}
              {t.name}
              {isPremium && <Lock size={10} className={isActive ? 'text-white/80' : 'text-amber-500'} />}
            </button>
          );
        })}
        {hasMore && (
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-medium border border-dashed border-input text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            View More
            <ArrowRight size={11} />
          </Link>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Preview any template for free — premium ones need points or a paid plan to download.
        {hasMore && ' Browse the full catalog and see a real preview of each one in the Marketplace.'}
      </p>
    </div>
  );
}
