import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { motion, useInView } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { FeatureItem } from './FeatureCard';

const ACCENT_HEX: Record<FeatureItem['accent'], string> = {
  indigo: '#818cf8',
  purple: '#c084fc',
  pink: '#f472b6',
  cyan: '#22d3ee',
};

const AUTO_ADVANCE_MS = 3400;
const SWIPE_THRESHOLD = 50; // px drag before it counts as a swipe
const MOBILE_BREAKPOINT = 640; // matches the rest of the app's mobile media queries

// Desktop vs. mobile sizing — kept as plain numbers (not just CSS) because
// CARD_SPACING and card width/height feed directly into the motion `x`
// offsets below; a CSS media query alone can't reach into that math.
const SIZES = {
  desktop: { cardSpacing: 230, cardW: 256, cardH: 320, stageHeight: 420 },
  mobile: { cardSpacing: 132, cardW: 176, cardH: 240, stageHeight: 340 },
};

// Signed distance from `index` to `current` on a circular track of length
// `total` — e.g. with 16 items, index 1 and current 15 are distance +2 apart,
// not 14, so wraparound never causes a card to fly the long way around.
function ringOffset(index: number, current: number, total: number) {
  let diff = index - current;
  if (diff > total / 2) diff -= total;
  if (diff < -total / 2) diff += total;
  return diff;
}

function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= breakpoint,
  );
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [breakpoint]);
  return isMobile;
}

// Small squares that circulate tightly around the tower core — same
// orbit-track/orbit-counter trick as the hero's FloatingSquares, just a
// much smaller radius so they read as "energy" hugging the pipe rings
// rather than ambient background dressing. Scales down for free on mobile
// since it's nested inside .feature-tower, which the CSS media query scales.
const SATELLITE_RINGS = [
  { radius: 95, duration: 9, direction: 'cw' as const, size: 7, count: 5, hex: '#818cf8' },
  { radius: 150, duration: 14, direction: 'ccw' as const, size: 9, count: 6, hex: '#22d3ee' },
];

function TowerSatellites() {
  const rings = useMemo(
    () =>
      SATELLITE_RINGS.map((ring) => ({
        ...ring,
        squares: Array.from({ length: ring.count }, (_, i) => (360 / ring.count) * i),
      })),
    [],
  );

  return (
    <div className="absolute inset-0" aria-hidden="true">
      {rings.map((ring, ringIdx) => (
        <div
          key={ringIdx}
          className={`orbit-track orbit-track-${ring.direction}`}
          style={{ '--orbit-duration': `${ring.duration}s` } as CSSProperties}
        >
          {ring.squares.map((angle, i) => (
            <div key={i} className="orbit-item" style={{ transform: `rotate(${angle}deg) translateX(${ring.radius}px)` }}>
              <div
                className={`orbit-counter orbit-counter-${ring.direction === 'cw' ? 'ccw' : 'cw'}`}
                style={{ '--orbit-duration': `${ring.duration}s` } as CSSProperties}
              >
                <div
                  className="satellite-square"
                  style={{
                    width: ring.size,
                    height: ring.size,
                    background: `${ring.hex}55`,
                    borderColor: `${ring.hex}90`,
                    boxShadow: `0 0 ${ring.size * 1.5}px ${ring.hex}80`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// The glowing pipe-tower the cards fan out from. Purely decorative, sits
// behind the cards (low z-index) at dead-center of the stage. Positioning +
// responsive scale live entirely in the `.feature-tower` CSS class so the
// mobile shrink is one media query, not JS branching.
function Tower() {
  return (
    <div className="feature-tower tower-glow" style={{ zIndex: 0 }} aria-hidden="true">
      {/* Bright core at dead-center — the "reactor" the rings and cards
          orbit around. Without this the rings read as thin outlines
          floating in space rather than energy circling something lit. */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full"
        style={{ background: 'radial-gradient(circle, #c7d2fe 0%, #818cf8 40%, transparent 75%)', filter: 'blur(3px)' }}
      />
      <div className="relative w-[6px] h-64 mx-auto rounded-full bg-gradient-to-b from-indigo-200 via-indigo-400/60 to-transparent" />
      <div className="pipe-ring pipe-ring-a" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />
      <div className="pipe-ring pipe-ring-b" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />
      <div className="pipe-ring pipe-ring-c" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />
      <TowerSatellites />
    </div>
  );
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
  const isMobile = useIsMobile();
  const { cardSpacing, cardW, cardH, stageHeight } = isMobile ? SIZES.mobile : SIZES.desktop;

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
  const VISIBLE_RANGE = isMobile ? 2 : 4;
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
        {/* Left rail, echoing the reference video's fixed sidebar list.
            Hidden below md — on mobile the card count + swipe hint at the
            bottom carries that same "what's inside" context instead. */}
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
          className="relative flex-1 overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing"
          style={{ perspective: isMobile ? 900 : 1400, height: stageHeight }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={() => (dragging.current = false)}
        >
          {/* Ambient haze behind the whole cluster — without this the tower
              and cards sit in flat black space instead of a lit scene. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 50% 48%, rgba(129,140,248,0.28), rgba(244,114,182,0.14) 42%, transparent 72%)',
            }}
            aria-hidden="true"
          />

          {/* Glowing tower the cards fan out from — sits behind everything */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={hasEntered ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            <Tower />
          </motion.div>

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
                className="absolute top-1/2 left-1/2"
                style={
                  {
                    width: cardW,
                    height: cardH,
                    marginLeft: -cardW / 2,
                    marginTop: -cardH / 2,
                    zIndex: 100 - abs,
                    pointerEvents: isFront ? 'auto' : 'none',
                  } as CSSProperties
                }
                initial={{ opacity: 0, y: 130, scale: 0.55 }}
                animate={
                  hasEntered
                    ? {
                        x: offset * cardSpacing,
                        y: 0,
                        // Side cards used to bottom out at 12% opacity / 9px
                        // blur, which made them read as empty dark
                        // rectangles instead of receded cards. Raised the
                        // floor and lowered the ceiling so they stay
                        // visibly card-shaped.
                        scale: Math.max(0.6, 1 - abs * 0.15),
                        rotateY: Math.max(-55, Math.min(55, offset * (isMobile ? -16 : -20))),
                        opacity: abs > VISIBLE_RANGE ? 0 : Math.max(0.32, 1 - abs * 0.2),
                        filter: `blur(${isFront ? 0 : Math.min(5, abs * 2)}px)`,
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
                  className="neon-carousel-card w-full h-full rounded-2xl p-4 sm:p-6 flex flex-col justify-between overflow-hidden"
                  style={{
                    background: `radial-gradient(circle at 30% 20%, ${hex}22, transparent 60%), linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015))`,
                    borderColor: `${hex}40`,
                    // Side cards now keep a dim version of their accent glow
                    // instead of losing it entirely — that's what reads as
                    // "still a lit card" rather than "gone dark".
                    boxShadow: isFront
                      ? `0 20px 60px -15px ${hex}55, 0 0 0 1px ${hex}30`
                      : `0 0 28px -8px ${hex}40`,
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center"
                      style={{ background: `${hex}20`, color: hex }}
                    >
                      <Icon size={isMobile ? 16 : 20} />
                    </div>
                    <span
                      className="text-[9px] sm:text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full"
                      style={{
                        color: feature.status === 'live' ? '#4ade80' : '#facc15',
                        background: feature.status === 'live' ? '#4ade8018' : '#facc1518',
                      }}
                    >
                      {feature.status === 'live' ? 'Live' : 'Coming soon'}
                    </span>
                  </div>

                  {/* Only the front card carries copy. Previously this used
                      a chromatic "glitch" split (cyan/pink duplicate layers)
                      that re-triggered every time a new card became front —
                      since autoplay rotates every 3.4s, that meant a decent
                      chance of catching the title mid RGB-split, which is
                      what was actually making it read as unreadable. Swapped
                      for a plain, fast fade — text is legible immediately. */}
                  {isFront && (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    >
                      <h3 className="text-base sm:text-xl font-bold uppercase tracking-wide text-white mb-1.5 sm:mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-white/55 leading-relaxed">{feature.description}</p>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Mobile-only count, replacing the hidden left rail's "01 / 16" */}
      <p className="md:hidden text-center text-xs text-white/25 font-mono mt-3">
        {String(current + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </p>

      {/* Prev / next controls */}
      <div className="flex items-center justify-center gap-4 mt-4 md:mt-6">
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