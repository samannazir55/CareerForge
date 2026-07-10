import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { templatesApi } from '../../lib/api';

interface TemplateLivePreviewProps {
  templateId: string;
  className?: string;
}

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

// Cache rendered preview HTML per templateId for the lifetime of the tab.
// The marketplace can list 1000+ templates and switching search/category
// filters re-mounts cards constantly — without this, toggling a filter back
// and forth would re-fetch and re-render the same iframe HTML repeatedly.
const previewCache = new Map<string, string>();

/**
 * Renders the ACTUAL template — real HTML/CSS filled in with a realistic
 * sample resume — inside a sandboxed iframe, scaled down to fit its
 * container. Replaces the old fake "stack of gray blocks" placeholder that
 * gave shoppers no idea what a template actually looked like before they
 * spent points on it.
 *
 * Lazy: nothing is fetched until the card scrolls into view, and once
 * fetched the HTML is cached — needed so a marketplace grid with hundreds
 * of templates doesn't fire hundreds of render requests on page load.
 */
export function TemplateLivePreview({ templateId, className = '' }: TemplateLivePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [visible, setVisible] = useState(false);
  const [scale, setScale] = useState(0.3);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  // Only start loading once this card is near the viewport.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '250px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Scale the fixed A4-width iframe down to whatever width this card
  // actually has, so the same component works in a small grid card or a
  // larger modal without a `scale` prop to keep in sync by hand.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      if (width > 0) setScale(width / A4_WIDTH_PX);
    };
    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;

    const cached = previewCache.get(templateId);
    if (cached) {
      if (iframeRef.current) iframeRef.current.srcdoc = cached;
      setState('idle');
      return;
    }

    let cancelled = false;
    setState('loading');
    templatesApi
      .preview(templateId)
      .then((html) => {
        if (cancelled) return;
        previewCache.set(templateId, html);
        if (iframeRef.current) iframeRef.current.srcdoc = html;
        setState('idle');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [visible, templateId]);

  const iframeStyle: CSSProperties = {
    width: A4_WIDTH_PX,
    height: A4_HEIGHT_PX,
    border: 'none',
    transformOrigin: 'top left',
    transform: `scale(${scale})`,
    pointerEvents: 'none',
    background: 'white',
  };

  return (
    <div ref={containerRef} className={`relative w-full h-full overflow-hidden bg-white ${className}`}>
      {visible ? (
        // sandbox="" (no flags) is safe: template HTML is pure HTML+CSS,
        // never scripts. See ResumePreview.tsx for why allow-scripts +
        // allow-same-origin must never both be added here.
        <iframe ref={iframeRef} title="Template preview" sandbox="" style={iframeStyle} aria-label="Template preview with sample resume data" />
      ) : (
        <div className="w-full h-full bg-muted/40 animate-pulse" />
      )}
      {visible && state === 'loading' && (
        <div className="absolute inset-0 bg-muted/20 animate-pulse" />
      )}
      {state === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center text-center text-xs text-muted-foreground bg-white p-2">
          Preview unavailable
        </div>
      )}
    </div>
  );
}
