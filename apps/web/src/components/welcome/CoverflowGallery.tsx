import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { motion, useInView } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { FeatureItem } from './FeatureCard';

const ACCENT_HEX: Record<FeatureItem['accent'], string> = {
  indigo: '#818cf8',
  purple: '#c084fc',
  pink: '#f472b6',
  cyan: '#22d3ee',
};

const CARD_SPACING = 230; // px between each card's center, along x
const AUTO_ADVANCE_MS = 3400;
const SWIPE_THRESHOLD = 50; // px drag before it counts as a swipe

// Signed distance from `index` to `current` on a circular track of length
// `total` — e.g. with 16 items, index 1 and current 15 are distance +2 apart,
// not 14, so wraparound never causes a card to fly the long way around.
function ringOffset(index: number, current: number, total: number) {
  let diff = index - current;
  if (diff > total / 2) diff -= total;
  if (diff < -total / 2) diff += total;
  return diff;
}

interface CoverflowGalleryProps {
  features: FeatureItem[];
}

export function CoverflowGallery({ features }: CoverflowGalleryProps) {
  const total = features.length;
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const dragStartX = useRef(0);
  const dragging = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  // Once true, stays true forever — cards rise up into their fanned
  // positions the first time the gallery scrolls into view, and never
  // replay that entrance on subsequent navigation.
  const hasEntered = useInView(stageRef, { once: true, margin: '-100px' });

  const goTo = useCallback(
    (i: number) => setCurrent(((i % total) + total) % total),
    [total],
  );
  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Autoplay — pauses while the person is dragging or hovering the gallery.
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setCurrent((c) => (c + 1) % total), AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [paused, total]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    setPaused(true);
    dragStartX.current = e.clientX;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    const delta = e.clientX - dragStartX.current;
    if (delta > SWIPE_THRESHOLD) prev();
    else if (delta < -SWIPE_THRESHOLD) next();
    setTimeout(() => setPaused(false), 1200);
  };

  // Only render cards near the front — distant cards would be fully
  // transparent/blurred-out anyway, so skip them for cheaper rendering.
  const VISIBLE_RANGE = 4;
  const visibleIndices = Array.from({ length: total }, (_, i) => i).filter(
    (i) => Math.abs(ringOffset(i, current, total)) <= VISIBLE_RANGE,
  );

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-stretch gap-6">
        {/* Left rail, echoing the reference video's fixed sidebar list */}
        <div className="hidden md:flex flex-col justify-center gap-4 w-40 shrink-0 pl-2">
          <p className="text-[11px] tracking-[0.2em] text-white/35 uppercase mb-1">What's inside</p>
          <button
            onClick={() => goTo(features.findIndex((f) => f.status === 'live'))}
            className="text-left text-sm text-white/60 hover:text-white transition-colors"
          >
            → Live features
          </button>
          <button
            onClick={() => goTo(features.findIndex((f) => f.status === 'soon'))}
            className="text-left text-sm text-white/60 hover:text-white transition-colors"
          >
            → Coming soon
          </button>
          <p className="text-xs text-white/25 mt-4 font-mono">
            {String(current + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </p>
        </div>

        {/* Coverflow stage */}
        <div
          ref={stageRef}
          className="relative flex-1 h-[420px] overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing"
          style={{ perspective: '1400px' }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={() => (dragging.current = false)}
        >
          {visibleIndices.map((i) => {
            const feature = features[i];
            const offset = ringOffset(i, current, total);
            const abs = Math.abs(offset);
            const isFront = offset === 0;
            const hex = ACCENT_HEX[feature.accent];
            const Icon = feature.icon;

            return (
              <motion.div
                key={i}
                className="absolute top-1/2 left-1/2 w-64 h-80 -ml-32 -mt-40"
                style={{ zIndex: 100 - abs, pointerEvents: isFront ? 'auto' : 'none' } as CSSProperties}
                initial={{ opacity: 0, y: 130, scale: 0.55 }}
                animate={
                  hasEntered
                    ? {
                        x: offset * CARD_SPACING,
                        y: 0,
                        scale: Math.max(0.58, 1 - abs * 0.16),
                        rotateY: Math.max(-55, Math.min(55, offset * -20)),
                        opacity: abs > VISIBLE_RANGE ? 0 : Math.max(0.12, 1 - abs * 0.26),
                        filter: `blur(${isFront ? 0 : Math.min(9, abs * 3)}px)`,
                      }
                    : { opacity: 0, y: 130, scale: 0.55 }
                }
                transition={{
                  type: 'spring',
                  stiffness: 260,
                  damping: 32,
                  delay: hasEntered ? 0 : 0.1 + abs * 0.06,
                }}
                onClick={() => !isFront && goTo(i)}
              >
                <div
                  className="coverflow-card-surface w-full h-full rounded-2xl p-6 flex flex-col justify-between overflow-hidden"
                  style={{
                    background: `radial-gradient(circle at 30% 20%, ${hex}22, transparent 60%), linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015))`,
                    borderColor: `${hex}40`,
                    boxShadow: isFront ? `0 20px 60px -15px ${hex}55, 0 0 0 1px ${hex}30` : 'none',
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="h-11 w-11 rounded-xl flex items-center justify-center"
                      style={{ background: `${hex}20`, color: hex }}
                    >
                      <Icon size={20} />
                    </div>
                    <span
                      className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full"
                      style={{
                        color: feature.status === 'live' ? '#4ade80' : '#facc15',
                        background: feature.status === 'live' ? '#4ade8018' : '#facc1518',
                      }}
                    >
                      {feature.status === 'live' ? 'Live' : 'Coming soon'}
                    </span>
                  </div>

                  {/* Only the front card carries legible copy — side cards are
                      intentionally blurred past the point of reading, matching
                      the reference video. */}
                  {isFront && (
                    <div key={i}>
                      <h3 className="glitch-text text-xl font-bold uppercase tracking-wide text-white mb-2" data-text={feature.title}>
                        {feature.title}
                      </h3>
                      <p className="text-sm text-white/55 leading-relaxed">{feature.description}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Prev / next controls */}
      <div className="flex items-center justify-center gap-4 mt-6">
        <button
          onClick={prev}
          aria-label="Previous feature"
          className="h-9 w-9 rounded-full border border-white/15 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={next}
          aria-label="Next feature"
          className="h-9 w-9 rounded-full border border-white/15 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}