import { useMemo, type CSSProperties } from 'react';

const NEON_COLORS = [
  'rgba(99, 102, 241, 0.18)', // indigo
  'rgba(168, 85, 247, 0.16)', // purple
  'rgba(236, 72, 153, 0.14)', // pink
  'rgba(34, 211, 238, 0.14)', // cyan
];

const NEON_BORDERS = [
  'rgba(129, 140, 248, 0.5)',
  'rgba(192, 132, 252, 0.5)',
  'rgba(244, 114, 182, 0.45)',
  'rgba(103, 232, 249, 0.45)',
];

interface SquareConfig {
  id: string;
  size: number;
  angle: number;
  colorIdx: number;
}

interface RingConfig {
  radius: number;
  duration: number;
  direction: 'cw' | 'ccw';
  sizeRange: [number, number];
  weight: number;
}

// Three concentric rings, each spinning at a different speed/direction, so
// the layered motion reads as continuous and alive rather than a single
// flat rotation. Squares within a ring are spaced evenly by angle (with only
// a small jitter) so they never drift into or on top of one another.
const RINGS: RingConfig[] = [
  { radius: 150, duration: 46, direction: 'cw', sizeRange: [14, 22], weight: 0.3 },
  { radius: 260, duration: 66, direction: 'ccw', sizeRange: [20, 32], weight: 0.35 },
  { radius: 370, duration: 88, direction: 'cw', sizeRange: [26, 40], weight: 0.35 },
];

/**
 * Ambient decorative layer for the welcome page hero — small glowing squares
 * that circulate continuously, non-stop, around the hero's center in three
 * spaced-out orbiting rings. Purely visual, aria-hidden, and
 * pointer-events-none so it never interferes with content or accessibility.
 *
 * Ring configs are generated once via useMemo (not on every render) but are
 * not seeded — fine here since this is a client-only SPA with no SSR/hydration
 * to keep in sync.
 */
export function FloatingSquares({ count = 18 }: { count?: number }) {
  const rings = useMemo(() => {
    return RINGS.map((ring, ringIdx) => {
      const n = Math.max(3, Math.round(count * ring.weight));
      const spacing = 360 / n;
      const squares: SquareConfig[] = Array.from({ length: n }, (_, i) => ({
        id: `${ringIdx}-${i}`,
        size: ring.sizeRange[0] + Math.random() * (ring.sizeRange[1] - ring.sizeRange[0]),
        // Even spacing keeps squares well apart; jitter is capped small so
        // they can never bunch up or overlap as they circulate.
        angle: spacing * i + (Math.random() - 0.5) * spacing * 0.3,
        colorIdx: (ringIdx + i) % NEON_COLORS.length,
      }));
      return { ...ring, squares };
    });
  }, [count]);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {rings.map((ring, ringIdx) => (
        <div
          key={ringIdx}
          className={`orbit-track orbit-track-${ring.direction}`}
          style={{ '--orbit-duration': `${ring.duration}s` } as CSSProperties}
        >
          {ring.squares.map((sq) => (
            <div
              key={sq.id}
              className="orbit-item"
              style={{ transform: `rotate(${sq.angle}deg) translateX(${ring.radius}px)` }}
            >
              <div
                className={`orbit-counter orbit-counter-${ring.direction === 'cw' ? 'ccw' : 'cw'}`}
                style={{ '--orbit-duration': `${ring.duration}s` } as CSSProperties}
              >
                {/* trailing glow echo, purely decorative */}
                <div
                  className="neon-square-ghost"
                  style={{
                    width: sq.size * 1.3,
                    height: sq.size * 1.3,
                    background: NEON_COLORS[sq.colorIdx],
                  }}
                />
                <div
                  className="neon-square"
                  style={{
                    width: sq.size,
                    height: sq.size,
                    background: NEON_COLORS[sq.colorIdx],
                    borderColor: NEON_BORDERS[sq.colorIdx],
                    boxShadow: `0 0 ${sq.size * 0.6}px ${NEON_COLORS[sq.colorIdx]}`,
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